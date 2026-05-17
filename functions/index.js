const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
// Configurações globais de região
setGlobalOptions({ region: 'southamerica-east1' });

const MAX_DAILY_USES = 4;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const MAX_PAYLOAD_CHARS = 4000;

const SYSTEM_PROMPT = `Você é o Professor AI do PlenAula.
Seu papel é ensinar estudantes para concursos públicos de forma clara, objetiva e motivadora.

Você deve:
- ensinar passo a passo;
- evitar respostas vagas;
- incentivar aprendizado gradual;
- corrigir redações;
- montar cronogramas;
- explicar erros;
- responder de forma amigável;
- manter contexto da conversa.

Nunca entregue apenas respostas secas.
Sempre ensine.`;

exports.askProfessorAI = onCall({
  maxInstances: 10,
  secrets: ["CHAVE_MESTRE_GEMINI"]
}, async (request) => {
  const admin = require('firebase-admin');

  // Inicializa Firebase Admin lazy load
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const startTimeMs = Date.now();

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'É necessário estar logado.');
  }

  const { flow, message, context: arrayParams } = request.data || {};
  const uid = request.auth.uid;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    throw new HttpsError('invalid-argument', 'Mensagem vazia.');
  }

  const apiKey = process.env.CHAVE_MESTRE_GEMINI;
  if (!apiKey) {
    throw new HttpsError('internal', 'CHAVE_MESTRE_GEMINI não configurada.');
  }

  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);

  // Rate Limit
  const userDoc = await userRef.get();
  let usageLogs = [];
  if (userDoc.exists && Array.isArray(userDoc.data().aiUsageLogs)) {
    usageLogs = userDoc.data().aiUsageLogs;
  }
  const now = Date.now();
  usageLogs = usageLogs.filter(ts => (now - ts) < TWENTY_FOUR_HOURS_MS);

  if (usageLogs.length >= MAX_DAILY_USES) {
    throw new HttpsError('resource-exhausted', 'limite');
  }

  // Gemini
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_PROMPT
  });

  try {
    let history = [];
    if (Array.isArray(arrayParams)) {
      history = arrayParams.map(c => ({
        role: (c.role === 'ai' || c.role === 'assistant') ? 'model' : 'user',
        parts: [{ text: c.content }]
      }));
    }

    // 1. Remove a própria mensagem atual se ela estiver duplicada no final do histórico
    if (history.length > 0 && history[history.length - 1].role === 'user' && history[history.length - 1].parts[0].text === message) {
        history.pop();
    }

    // 2. Transforma o histórico para garantir a alternância exata (user -> model -> user -> model)
    // O Gemini não suporta dois 'user' seguidos, ou começar a conversa com 'model'.
    let validHistory = [];
    
    // Se a primeira mensagem for do model, injetamos um prompt do user invisível no começo
    if (history.length > 0 && history[0].role === 'model') {
        validHistory.push({ role: 'user', parts: [{ text: 'Olá, vamos iniciar.' }] });
    }

    // Constrói iterando, combinando mensagens seguidas do mesmo tipo
    for (let msg of history) {
        if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === msg.role) {
            validHistory[validHistory.length - 1].parts[0].text += '\n\n' + msg.parts[0].text;
        } else {
            validHistory.push(msg);
        }
    }

    // Garante que a última mensagem do validHistory (se existir) é 'model', 
    // já que a próxima chamada (sendMessage) será 'user'.
    if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === 'user') {
       // Se o history inteiro terminava com User, o sendMessage vai colidir (user -> user).
       // Solução simples é dar pop e anexar o texto junto na message atual enviada
       const lastUserMsg = validHistory.pop();
       // Adiciona o contexto anexado ao texto invisívelmente
       // Mas no nosso caso, o texto atual já contém tudo, então apenas removemos do histórico de setup.
    }

    const chat = model.startChat({ history: validHistory });
    const result = await chat.sendMessage(message);
    const text = result.response.text();

    // Salvar
    usageLogs.push(now);
    await userRef.set({ aiUsageLogs: usageLogs }, { merge: true });

    const today = new Date().toISOString().split('T')[0];
    await userRef.collection('ai_sessions').doc(today).set({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      messages: admin.firestore.FieldValue.arrayUnion({
        timestamp: Date.now(),
        userMsg: message,
        aiMsg: text
      })
    }, { merge: true });

    return { reply: text, uses: usageLogs.length };

  } catch (error) {
    console.error(error);
    throw new HttpsError('internal', 'Erro na IA.');
  }
});
