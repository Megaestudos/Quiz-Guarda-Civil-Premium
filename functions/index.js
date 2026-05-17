const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
admin.initializeApp();

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
  maxInstances: 10
}, async (request) => {
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

  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'ALERTA_SEGREDO: GEMINI_KEY não foi injetada pelo Servidor.');
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

    // 2. Transforma o histórico para garantir a alternância exata
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
       const lastUserMsg = validHistory.pop();
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
    throw new HttpsError('failed-precondition', 'ERRO_API_GEMINI: ' + (error.message || 'Desconhecido'));
  }
});
