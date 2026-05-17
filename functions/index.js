const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

// Inicializa Firebase Admin apenas uma vez
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Configurações globais de região
setGlobalOptions({ 
  region: 'southamerica-east1'
});

// Configurações e constantes
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

// Definimos que esta função precisa do segredo GEMINI_API_KEY
exports.askProfessorAI = onCall({
  secrets: ["GEMINI_API_KEY"] 
}, async (request) => {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const startTimeMs = Date.now();

  // 1. Validação de Autenticação
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'É necessário estar logado.');
  }

  const uid = request.auth.uid;
  const { flow, message, context: arrayParams } = request.data || {};

  // 2. Validação de Input
  if (!message || typeof message !== 'string' || message.trim() === '') {
    throw new HttpsError('invalid-argument', 'A mensagem está vazia.');
  }

  if (message.length > MAX_PAYLOAD_CHARS) {
    throw new HttpsError('out-of-range', 'Texto longo demais.');
  }

  // 3. Recupera API Key dos Secrets com Segurança
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpsError('internal', 'Chave da IA não configurada no servidor.');
  }

  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);

  // 4. Rate Limit (24h)
  let usageLogs = [];
  const userDoc = await userRef.get();
  if (userDoc.exists) {
    const userData = userDoc.data();
    if (Array.isArray(userData.aiUsageLogs)) {
      usageLogs = userData.aiUsageLogs;
    }
  }

  const now = Date.now();
  usageLogs = usageLogs.filter(ts => (now - ts) < TWENTY_FOUR_HOURS_MS);

  if (usageLogs.length >= MAX_DAILY_USES) {
    throw new HttpsError('resource-exhausted', 'limite');
  }

  // 5. Chamada para o Gemini
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_PROMPT
  });

  try {
    let formattedHistory = [];
    if (arrayParams && Array.isArray(arrayParams)) {
      formattedHistory = arrayParams.map(c => ({
        role: (c.role === 'ai' || c.role === 'assistant') ? 'model' : 'user',
        parts: [{ text: c.content }]
      }));
    }

    const chat = model.startChat({ history: formattedHistory });
    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    // 6. Persistência de Logs e Sessão
    usageLogs.push(now);
    await userRef.set({ aiUsageLogs: usageLogs }, { merge: true });

    const todayStr = new Date().toISOString().split('T')[0];
    const sessionRef = userRef.collection('ai_sessions').doc(todayStr);

    await sessionRef.set({
      sessionId: todayStr,
      flow: flow || 'geral',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      messages: admin.firestore.FieldValue.arrayUnion({
        timestamp: Date.now(),
        userMsg: message,
        aiMsg: responseText
      })
    }, { merge: true });

    // Analytics
    await db.collection('ai_analytics').add({
      uid: uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      flow: flow || 'geral',
      msgLength: message.length,
      responseLength: responseText.length,
      executionTimeMs: Date.now() - startTimeMs
    });

    return { reply: responseText, uses: usageLogs.length };

  } catch (error) {
    console.error('Erro na IA:', error);
    throw new HttpsError('internal', 'Erro ao processar resposta da IA.');
  }
});
