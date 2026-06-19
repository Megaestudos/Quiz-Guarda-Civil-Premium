const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
admin.initializeApp();

// Configurações globais de região
setGlobalOptions({ region: 'southamerica-east1' });

// Utilitário Data BRT (UTC-3)
function getTodayBRT() {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() - 3);
  return d.toISOString().split('T')[0];
}

const db = admin.firestore();
const GEMINI_KEY = defineSecret('GEMINI_KEY');

function assertAdmin(request) {
  if (!request.auth?.token?.admin) {
    throw new HttpsError('permission-denied', 'Acesso restrito ao administrador.');
  }
}

function timestampToIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeAuthUser(userRecord, firestoreData = {}) {
  const createdAt = userRecord.metadata?.creationTime || timestampToIso(firestoreData.createdAt);
  const lastLogin = userRecord.metadata?.lastSignInTime || timestampToIso(firestoreData.lastLogin);

  return {
    uid: userRecord.uid,
    email: userRecord.email || firestoreData.email || '',
    displayName: userRecord.displayName || firestoreData.displayName || '',
    disabled: !!userRecord.disabled,
    createdAt,
    lastLogin,
    providers: (userRecord.providerData || []).map(provider => provider.providerId),
    emailVerified: !!userRecord.emailVerified,
    plan: firestoreData.plan || 'free',
    status: firestoreData.status || (userRecord.disabled ? 'blocked' : 'active'),
    quiz_xp: firestoreData.quiz_xp || 0,
    quiz_streak: firestoreData.quiz_streak || 0,
    quiz_best_record: firestoreData.quiz_best_record || null,
    quiz_topic_stats: firestoreData.quiz_topic_stats || null,
    lastStudyPlanDate: firestoreData.lastStudyPlanDate || null,
    lastLessonGenDate: firestoreData.lastLessonGenDate || null,
    lastEssayEvalDate: firestoreData.lastEssayEvalDate || null
  };
}

async function listAllAuthUsers() {
  const users = [];
  let nextPageToken;

  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    users.push(...result.users);
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  return users;
}

// ==========================================
// 0. ADMIN: USUÁRIOS REAIS DO FIREBASE AUTH
// ==========================================
exports.listUsersV2 = onCall({ maxInstances: 5 }, async (request) => {
  assertAdmin(request);

  const authUsers = await listAllAuthUsers();
  const firestoreUsersSnap = await db.collection('users').get();
  const firestoreByUid = {};

  firestoreUsersSnap.forEach(doc => {
    firestoreByUid[doc.id] = doc.data() || {};
  });

  return authUsers.map(userRecord => normalizeAuthUser(userRecord, firestoreByUid[userRecord.uid]));
});

exports.createUserV2 = onCall({ maxInstances: 5 }, async (request) => {
  assertAdmin(request);

  const { email, password, displayName } = request.data || {};
  if (!email || typeof email !== 'string') {
    throw new HttpsError('invalid-argument', 'E-mail obrigatório.');
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new HttpsError('invalid-argument', 'Senha mínima de 6 caracteres.');
  }

  const userRecord = await admin.auth().createUser({
    email: email.trim(),
    password,
    displayName: displayName || 'Aluno Cursista',
    disabled: false
  });

  await db.collection('users').doc(userRecord.uid).set({
    email: userRecord.email,
    displayName: userRecord.displayName || 'Aluno Cursista',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    plan: 'premium',
    status: 'active'
  }, { merge: true });

  return { success: true, uid: userRecord.uid };
});

exports.toggleUserStatus = onCall({ maxInstances: 5 }, async (request) => {
  assertAdmin(request);

  const { uid, disabled } = request.data || {};
  if (!uid || typeof uid !== 'string') {
    throw new HttpsError('invalid-argument', 'UID obrigatório.');
  }
  if (uid === request.auth.uid && disabled === true) {
    throw new HttpsError('failed-precondition', 'Você não pode bloquear o próprio administrador logado.');
  }

  await admin.auth().updateUser(uid, { disabled: !!disabled });
  await db.collection('users').doc(uid).set({
    status: disabled ? 'blocked' : 'active',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { success: true };
});

// ==========================================
// 1. PROFESSOR AI (PLANO DE ESTUDOS)
// ==========================================
exports.askProfessorAI = onCall({ maxInstances: 10, secrets: [GEMINI_KEY] }, async (request) => {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  
  if (!request.auth) throw new HttpsError('unauthenticated', 'É necessário estar logado.');
  
  const { flow, message, context: arrayParams } = request.data || {};
  const uid = request.auth.uid;
  
  if (!message || typeof message !== 'string' || message.trim() === '') {
    throw new HttpsError('invalid-argument', 'Mensagem vazia.');
  }

  const apiKey = GEMINI_KEY.value();
  if (!apiKey) throw new HttpsError('failed-precondition', 'ALERTA_SEGREDO: GEMINI_KEY não configurada.');

  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  const userData = userDoc.data() || {};
  const todayStr = getTodayBRT();

  if (flow === 'study_plan') {
    if (userData.lastStudyPlanDate === todayStr) {
      throw new HttpsError('resource-exhausted', 'limite_study_plan');
    }
  }

  const SYSTEM_PROMPT = `Você é o Professor AI cirúrgico do PlenAula.
Sua missão é ser extremamente direto, economizando palavras e indo direto ao ponto.
No fluxo de 'study_plan':
1. Assim que o usuário informar o concurso, valide imediatamente o status do Edital (informe se está aberto ou use o último como base).
2. Monte o cronograma de forma pragmática e tabular ou em tópicos curtos.
3. Não use introduções longas, saudações repetitivas ou despedidas motivacionais extensas. Seja clínico.
4. Responda apenas o que foi solicitado. Use o mínimo de palavras possível para entregar o máximo de valor estrutural.`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest', systemInstruction: SYSTEM_PROMPT });

  try {
    let history = [];
    if (Array.isArray(arrayParams)) {
      history = arrayParams.map(c => ({
        role: (c.role === 'ai' || c.role === 'assistant') ? 'model' : 'user',
        parts: [{ text: c.content }]
      }));
    }

    if (history.length > 0 && history[history.length - 1].role === 'user' && history[history.length - 1].parts[0].text === message) {
        history.pop();
    }

    let validHistory = [];
    if (history.length > 0 && history[0].role === 'model') {
        validHistory.push({ role: 'user', parts: [{ text: 'Olá, vamos iniciar.' }] });
    }
    for (let msg of history) {
        if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === msg.role) {
            validHistory[validHistory.length - 1].parts[0].text += '\n\n' + msg.parts[0].text;
        } else {
            validHistory.push(msg);
        }
    }
    if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === 'user') {
       validHistory.pop();
    }

    const chat = model.startChat({ history: validHistory });
    const result = await chat.sendMessage(message);
    const text = result.response.text();

    if (flow === 'study_plan') {
       await userRef.set({ lastStudyPlanDate: todayStr }, { merge: true });
    }

    return { reply: text, uses: 1 };

  } catch (error) {
    console.error(error);
    throw new HttpsError('internal', 'ERRO_API_GEMINI: ' + (error.message || 'Desconhecido'));
  }
});


// ==========================================
// 2. GERAÇÃO DE AULA DE REDAÇÃO (JSON RÍGIDO E CACHE GLOBAL)
// ==========================================
exports.generateEssayLesson = onCall({ maxInstances: 10, timeoutSeconds: 60, secrets: [GEMINI_KEY] }, async (request) => {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  if (!request.auth) throw new HttpsError('unauthenticated', 'É necessário estar logado.');

  let { topic } = request.data || {};
  if (!topic || typeof topic !== 'string') throw new HttpsError('invalid-argument', 'Tema inválido.');
  topic = topic.trim();
  
  const uid = request.auth.uid;
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  const userData = userDoc.data() || {};
  const todayStr = getTodayBRT();

  // Verificar Cache Global
  const topicHash = topic.toLowerCase().replace(/[^a-z0-9]/gi, '_');
  const cacheRef = db.collection('global_essay_lessons').doc(topicHash);
  const cacheDoc = await cacheRef.get();

  let lessonData;

  if (cacheDoc.exists) {
     lessonData = cacheDoc.data();
  } else {
     // Limite Diário (Apenas para geração AI que gasta token)
     if (userData.lastLessonGenDate === todayStr) {
        throw new HttpsError('resource-exhausted', 'limite_lesson');
     }

     // Gerar nova via IA
     const apiKey = GEMINI_KEY.value();
     if (!apiKey) throw new HttpsError('failed-precondition', 'Chave de API ausente.');
     
     const genAI = new GoogleGenerativeAI(apiKey);
     const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' }); // Modelo atualizado e corrigido

     const prompt = `Gere uma aula completa e estruturada de redação sobre o tema: "${topic}".
Siga exatamente a seguinte estrutura JSON OBRIGATÓRIA.
Retorne APENAS o JSON válido, sem markdown envolta.
{
  "introducao": { "titulo": "...", "texto": "..." },
  "contextualizacao": { "titulo": "...", "texto": "..." },
  "repertorio": [ {"tipo": "Livro/Filme/Fato", "descricao": "..."} ],
  "argumentos": [ {"ideia": "...", "desenvolvimento": "..."} ],
  "conectivos": [ {"uso": "Adição/Oposição/Conclusão", "exemplo": "..."} ],
  "estrutura": { "orientacao": "..." },
  "exemplos_alta_nota": [ {"paragrafo": "...", "comentario": "..."} ],
  "microtarefas": [ "Escreva sua introdução", "Escreva um desenvolvimento", "Escreva a conclusão" ]
}`;

     try {
       const result = await model.generateContent(prompt);
       const responseText = result.response.text().replace(/^```json\n?/g, '').replace(/\n?```$/g, '').trim();
       lessonData = JSON.parse(responseText);
       lessonData.createdAt = admin.firestore.FieldValue.serverTimestamp();
       lessonData.generatedTopic = topic;
       
       await cacheRef.set(lessonData);
     } catch (err) {
       console.error("Erro ao gerar JSON: ", err);
       throw new HttpsError('internal', 'Falha ao processar o conteúdo instrucional da IA.');
     }
  }

  // Registrar uso
  await userRef.set({ lastLessonGenDate: todayStr }, { merge: true });
  return { success: true, lesson: lessonData };
});


// ==========================================
// 3. AVALIAÇÃO CIRÚRGICA DE REDAÇÃO (MICRO TAREFAS E FINAL)
// ==========================================
exports.evaluateEssayPart = onCall({ maxInstances: 10, secrets: [GEMINI_KEY] }, async (request) => {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  if (!request.auth) throw new HttpsError('unauthenticated', 'Log-in obrigatório.');

  const { part, text, topic } = request.data || {};
  if (!text || !part) throw new HttpsError('invalid-argument', 'Parâmetros inválidos.');

  const uid = request.auth.uid;
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  const userData = userDoc.data() || {};
  const todayStr = getTodayBRT();

  // Se for avaliação final, validar o limite restrito de 1 por dia.
  if (part === 'final') {
      if (userData.lastEssayEvalDate === todayStr) {
          throw new HttpsError('resource-exhausted', 'limite_final_eval');
      }
  }

  const apiKey = GEMINI_KEY.value();
  if (!apiKey) throw new HttpsError('failed-precondition', 'Chave ausente.');

  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = `
Você é uma corretora profissional de redações para ENEM e concursos.
Sua função NÃO é conversar livremente. Responda em JSON estruturado, de forma objetiva, avaliando APENAS este trecho:
Tipo de Trecho: ${part} (introducao, desenvolvimento, ou final)
Tema: ${topic}
Texto do Aluno:\n${text}

Retorne APENAS um JSON no formato estrito:
{
  "nota_geral": 900,
  "competencias": { "gramatica": 180, "argumentacao": 180, "estrutura": 200, "coesao": 160, "repertorio": 180 },
  "pontos_fortes": ["..."],
  "melhorias": ["..."],
  "erros_especificos": ["..."]
}`;

  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().replace(/^```json\n?/g, '').replace(/\n?```$/g, '').trim();
    const evaluation = JSON.parse(responseText);

    if (part === 'final') {
       await userRef.set({ lastEssayEvalDate: todayStr }, { merge: true });
    }

    return { success: true, evaluation };

  } catch (err) {
    console.error("Erro na avaliação: ", err);
    throw new HttpsError('internal', 'Falha na IA corretora.');
  }
});
