const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');

require('dotenv').config();

const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Inicializa Firebase Admin apenas uma vez
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Configurações globais de região
setGlobalOptions({ region: 'southamerica-east1' });

// Configurações e constantes
const MAX_DAILY_USES = 4;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const MAX_PAYLOAD_CHARS = 4000;

// Prompt do Professor AI
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

// Resgata a API Key do .env
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('GEMINI_API_KEY não encontrada no .env');
}

const genAI = new GoogleGenerativeAI(apiKey);

exports.askProfessorAI = onCall(async (request) => {

  const startTimeMs = Date.now();

  // ==========================================
  // VALIDAÇÃO DE LOGIN
  // ==========================================
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'É necessário estar logado para falar com o Professor AI.'
    );
  }

  const uid = request.auth.uid;
  const { flow, message, context: arrayParams } = request.data || {};

  // ==========================================
  // VALIDAÇÕES ANTI-SPAM / ANTI-FLOOD
  // ==========================================
  if (!message || typeof message !== 'string' || message.trim() === '') {
    throw new HttpsError(
      'invalid-argument',
      'A mensagem não pode estar vazia.'
    );
  }

  if (message.length > MAX_PAYLOAD_CHARS) {
    console.warn(
      `Tentativa de abuso de Tokens [UID: ${uid}] Tamanho: ${message.length}`
    );

    throw new HttpsError(
      'out-of-range',
      'Texto longo demais. Resuma sua dúvida.'
    );
  }

  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);

  // ==========================================
  // RATE LIMIT 24H
  // ==========================================
  let usageLogs = [];

  const userDoc = await userRef.get();

  if (userDoc.exists) {
    const userData = userDoc.data();

    if (Array.isArray(userData.aiUsageLogs)) {
      usageLogs = userData.aiUsageLogs;
    }
  }

  const now = Date.now();

  // Mantém apenas logs das últimas 24h
  usageLogs = usageLogs.filter(
    timestamp => (now - timestamp) < TWENTY_FOUR_HOURS_MS
  );

  if (usageLogs.length >= MAX_DAILY_USES) {
    throw new HttpsError(
      'resource-exhausted',
      'limite'
    );
  }

  // ==========================================
  // VALIDA API KEY
  // ==========================================
  if (!apiKey) {
    throw new HttpsError(
      'internal',
      'Serviço indisponível. API Key não configurada.'
    );
  }

  // ==========================================
  // MODELO GEMINI
  // ==========================================
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_PROMPT
  });

  try {

    // ==========================================
    // MEMÓRIA DA CONVERSA
    // ==========================================
    let formattedHistory = [];

    if (arrayParams && Array.isArray(arrayParams)) {
      formattedHistory = arrayParams.map(c => ({
        role:
          (c.role === 'ai' || c.role === 'assistant')
            ? 'model'
            : 'user',

        parts: [
          {
            text: c.content
          }
        ]
      }));
    }

    // ==========================================
    // CHAT
    // ==========================================
    const chat = model.startChat({
      history: formattedHistory
    });

    const result = await chat.sendMessage(message);

    const responseText = result.response.text();

    // ==========================================
    // SALVA RATE LIMIT
    // ==========================================
    usageLogs.push(now);

    await userRef.set({
      aiUsageLogs: usageLogs
    }, { merge: true });

    const totalTimeMs = Date.now() - startTimeMs;

    // ==========================================
    // SESSÃO IA
    // ==========================================
    const todayStr = new Date().toISOString().split('T')[0];

    const sessionRef = userRef
      .collection('ai_sessions')
      .doc(todayStr);

    await sessionRef.set({
      sessionId: todayStr,
      flow: flow || 'geral',

      updatedAt:
        admin.firestore.FieldValue.serverTimestamp(),

      messages:
        admin.firestore.FieldValue.arrayUnion({
          timestamp: Date.now(),
          userMsg: message,
          aiMsg: responseText
        })

    }, { merge: true });

    // ==========================================
    // ANALYTICS
    // ==========================================
    await db.collection('ai_analytics').add({

      uid: uid,

      timestamp:
        admin.firestore.FieldValue.serverTimestamp(),

      flow: flow || 'geral',

      msgLength: message.length,

      responseLength: responseText.length,

      executionTimeMs: totalTimeMs,

      historyBlocksSent: formattedHistory.length,

      approximateTokens: Math.floor(
        (message.length + responseText.length) / 4
      )

    });

    // ==========================================
    // RESPOSTA FINAL
    // ==========================================
    return {
      reply: responseText,
      uses: usageLogs.length
    };

  } catch (error) {

    console.error('Erro Crítico Serverless IA:', error);

    await db.collection('ai_analytics_errors').add({

      uid: uid,

      timestamp:
        admin.firestore.FieldValue.serverTimestamp(),

      errorMsg: error.message || 'Error',

      payloadSize: message.length

    });

    throw new HttpsError(
      'internal',
      'TIMEOUT'
    );
  }
});
