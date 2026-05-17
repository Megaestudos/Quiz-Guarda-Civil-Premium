// =====================================================
// PROFESSOR AI - LÓGICA DE CHAT, CONTEXTO E SEGURANÇA AVANÇADA
// =====================================================

// ==========================================
// ESTADO GLOBAL & ARQUITETURA DE CONTEXTO
// ==========================================
let aiState = {
  isLoading: false,
  dailyUses: 0,
  maxDailyUses: 2,
  currentFlow: null, // 'study_plan' | 'essay'
  currentRequestId: null,
  
  // Arquitura Otimizada de Contexto Duplo
  persistentContext: [], // [ { role, content, persist: true } ] => Mantém o Core (Setup, Tema)
  conversationHistory: [] // [ { role, content } ] => Mensagens dinâmicas
};

const TIMEOUT_MS = 20000;
const MAX_PAYLOAD_CHARS = 4000;

document.addEventListener('DOMContentLoaded', () => {
  const chatInput = document.getElementById('aiChatInput');
  const sendBtn = document.getElementById('aiChatSendBtn');

  if (chatInput) {
    chatInput.addEventListener('input', function() {
      // Limitação forte de segurança local e UX
      if (this.value.length > MAX_PAYLOAD_CHARS) {
        this.value = this.value.substring(0, MAX_PAYLOAD_CHARS);
      }
      
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight < 120 ? this.scrollHeight : 120) + 'px';
      
      if (this.value.trim().length > 0 && !aiState.isLoading) {
        sendBtn.removeAttribute('disabled');
      } else {
        sendBtn.setAttribute('disabled', 'true');
      }
    });

    chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!aiState.isLoading) sendAiMessage();
      }
    });
  }
});

// ==========================================
// NAVEGAÇÃO E UX
// ==========================================

function showProfAiViews(viewId) {
  const menu = document.getElementById('profAiMenu');
  const chat = document.getElementById('profAiChat');
  
  if (viewId === 'profAiChat') {
    menu.style.display = 'none';
    chat.style.display = 'flex';
  } else {
    menu.style.display = 'block';
    chat.style.display = 'none';
    aiState.currentRequestId = null; // Cancele/Aborte fluxos pendentes
  }
}

function backToProfAiMenu() {
  showProfAiViews('profAiMenu');
}

function updateUsageBadge() {
  const badge = document.getElementById('aiUsageBadge');
  if(badge) {
    badge.textContent = `${aiState.dailyUses}/${aiState.maxDailyUses} usos`;
    if (aiState.dailyUses >= aiState.maxDailyUses) {
      badge.style.color = 'var(--danger)';
      badge.style.background = 'rgba(239, 68, 68, 0.15)';
    } else {
      badge.style.color = 'var(--text-muted)';
      badge.style.background = 'rgba(255, 255, 255, 0.1)';
    }
  }
}

// ==========================================
// ENGINE DE RENDERIZAÇÃO DOM SEGURA (ANTI-XSS)
// ==========================================

function smoothScrollToBottom(el) {
  setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }), 50);
}

function renderMessageSafe(text, sender, isPersistent = false, saveToContext = false) {
  if (saveToContext) {
    const role = sender === 'ai' ? 'assistant' : 'user';
    if (isPersistent) {
      aiState.persistentContext.push({ role, content: text });
    } else {
      aiState.conversationHistory.push({ role, content: text });
    }
  }

  const history = document.getElementById('aiChatHistory');
  const wrapper = document.createElement('div');
  wrapper.className = `chat-bubble-wrapper ${sender}`;
  wrapper.style.opacity = '0'; // Forçado pra transição de fade

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';

  // Parser Seguro para parágrafos e negritos sem vulnerabilidades
  const paragraphs = text.split('\n');
  paragraphs.forEach((paragraphText, i) => {
    if (paragraphText.trim() === '' && i !== 0 && i !== paragraphs.length - 1) {
      bubble.appendChild(document.createElement('br'));
      return;
    }
    
    const p = document.createElement('p');
    p.style.margin = "0 0 8px 0";
    
    const parts = paragraphText.split(/\*\*(.*?)\*\*/g);
    parts.forEach((part, index) => {
      if (index % 2 === 1) { // Estava em **bold**
        const strong = document.createElement('strong');
        strong.textContent = part;
        p.appendChild(strong);
      } else if (part) { // Normal
        p.appendChild(document.createTextNode(part));
      }
    });

    bubble.appendChild(p);
  });

  wrapper.appendChild(bubble);
  history.appendChild(wrapper);

  // Fade In microinteraction
  setTimeout(() => { wrapper.style.transition = 'opacity 0.3s ease'; wrapper.style.opacity = '1'; }, 10);
  smoothScrollToBottom(history);
}

function setAiLoading(isLoading) {
  aiState.isLoading = isLoading;
  const history = document.getElementById('aiChatHistory');
  const input = document.getElementById('aiChatInput');
  const btn = document.getElementById('aiChatSendBtn');
  
  if (isLoading) {
    input.setAttribute('disabled', 'true');
    btn.setAttribute('disabled', 'true');
    input.style.opacity = '0.5';
    btn.style.opacity = '0.5';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-bubble-wrapper ai typing-wrapper';
    wrapper.id = 'aiTypingIndicator';
    
    wrapper.innerHTML = `
      <div class="chat-bubble" style="padding: 10px 16px;">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;
    history.appendChild(wrapper);
    smoothScrollToBottom(history);
  } else {
    input.removeAttribute('disabled');
    input.style.opacity = '1';
    btn.style.opacity = '1';
    
    if (input.value.trim().length > 0) btn.removeAttribute('disabled');
    const indicator = document.getElementById('aiTypingIndicator');
    if (indicator) indicator.remove();
    input.focus();
  }
}

function clearChatUI() {
  document.getElementById('aiChatHistory').innerHTML = '';
}

// ==========================================
// PERSISTÊNCIA HÍBRIDA MULTI-CANAIS
// ==========================================

// Helper Firestore
function getFirebaseUser() {
  if (window.firebase && firebase.auth) return firebase.auth().currentUser;
  return null;
}

// Carregar Cache Fast (TTL 24h)
function hydrateFromLocalCache(flowId) {
  try {
    const raw = localStorage.getItem('ai_hybrid_session');
    if (!raw) return false;
    const cache = JSON.parse(raw);
    
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (Date.now() - cache.timestamp > twentyFourHours) {
      localStorage.removeItem('ai_hybrid_session'); // Limpeza inteligente TTL
      return false;
    }

    if (cache.flow === flowId && cache.persistentContext && cache.persistentContext.length > 0) {
      aiState.persistentContext = cache.persistentContext || [];
      aiState.conversationHistory = cache.conversationHistory || [];
      return true;
    }
  } catch(e) {}
  return false;
}

// Push para Nuvem e Local
async function syncSessionToStorage() {
  // Local
  try {
    const cacheHit = {
       timestamp: Date.now(),
       flow: aiState.currentFlow,
       persistentContext: aiState.persistentContext,
       conversationHistory: aiState.conversationHistory
    };
    localStorage.setItem('ai_hybrid_session', JSON.stringify(cacheHit));
  } catch(e) {}

  // Firestore Async Remoto (Não bloqueia UI) - Atualiza doc Master do Dia
  const user = getFirebaseUser();
  if (user && window.firebase && firebase.firestore) {
    try {
      const db = firebase.firestore();
      const todayStr = new Date().toISOString().split('T')[0];
      const docRef = db.collection('users').doc(user.uid).collection('ai_sessions').doc(todayStr);
      
      docRef.set({
        sessionId: todayStr,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        flow: aiState.currentFlow,
        persistentContext: aiState.persistentContext,
        conversationHistory: aiState.conversationHistory
      }, { merge: true }).catch(()=>{});
    } catch(e) {}
  }
}

// Resgatar da Nuvem (Caso cache nativo perca ou no app reinstalado)
async function hydrateFromFirestore(flowId) {
  const user = getFirebaseUser();
  if (!user || !window.firebase || !firebase.firestore) return false;

  try {
    const db = firebase.firestore();
    const todayStr = new Date().toISOString().split('T')[0];
    const docRef = db.collection('users').doc(user.uid).collection('ai_sessions').doc(todayStr);
    const snap = await docRef.get();
    
    if (snap.exists) {
      const data = snap.data();
      if (data.flow === flowId && data.persistentContext && data.persistentContext.length > 0) {
        aiState.persistentContext = data.persistentContext;
        aiState.conversationHistory = data.conversationHistory || [];
        syncSessionToStorage(); // Salva pro cache
        return true;
      }
    }
  } catch(e) {}
  return false;
}

// ==========================================
// FLUXOS DA APLICAÇÃO INTELIGENTE
// ==========================================

async function initializeFlow(flowId, initialMsg, titleHTML) {
  aiState.currentRequestId = null; // Cancela ciclos velhos
  aiState.currentFlow = flowId;
  document.getElementById('profAiChatTitle').innerHTML = titleHTML;
  showProfAiViews('profAiChat');
  updateUsageBadge();
  
  // Reset
  clearChatUI();
  
  // 1: Tenta Cache Instantâneo
  if (hydrateFromLocalCache(flowId)) {
     rebuildChatUIFromState();
     syncSessionToStorage(); // Tenta sync retroativo com a rede
     return;
  }

  // 2: Tenta Firestore (Async Loading)
  setAiLoading(true);
  const cloudSucceed = await hydrateFromFirestore(flowId);
  setAiLoading(false);

  if (cloudSucceed) {
     rebuildChatUIFromState();
     return;
  }

  // 3: Nova Sessão Virgem
  aiState.persistentContext = [];
  aiState.conversationHistory = [];
  renderMessageSafe(initialMsg, 'ai', true, true);
  syncSessionToStorage();
}

// Inicia Fluxo Plano de Estudos
window.startStudyPlanFlow = async function() {
  const msg = 'Olá! Sou o Professor AI. Vamos montar o seu Plano de Estudos ideal.\n\nPara eu te conhecer melhor:\n1. Qual o foco principal (Guarda Civil, EsPCEx, etc)?\n2. Quantas horas você pode estudar por dia?\n3. Em quais matérias você tem mais dificuldade?';
  initializeFlow('study_plan', msg, '<i class="ph ph-calendar-check"></i> Plano de Estudos');
};

// Inicia Fluxo Redação
window.startEssayFlow = async function() {
  const msg = 'Seja bem-vindo às Aulas de Redação!\n\nVocê tem algum tema específico que queira treinar hoje ou prefere que eu apresente os temas que mais caem nas bancas de Segurança Pública recentemente?';
  initializeFlow('essay', msg, '<i class="ph ph-pencil-line"></i> Aulas de Redação');
};

function rebuildChatUIFromState() {
    clearChatUI();
    const combine = [...aiState.persistentContext, ...aiState.conversationHistory];
    combine.forEach(entry => renderMessageSafe(entry.content, (entry.role === 'user' ? 'user' : 'ai'), false, false));
}

// ==========================================
// SISTEMA DE TIMEOUT E RETRY (WRAPPER NUVEM)
// ==========================================

// Cria um Fetcher com timeout customizado inteligente
async function executeIntelligentFunction(fnName, payload, timeoutMs) {
    if (!window.firebase || !firebase.functions) throw new Error("uninitialized");
    
    // Conecta na região correta e força o App
    const callPromise = firebase.app().functions('southamerica-east1').httpsCallable(fnName)(payload);
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
    });

    return await Promise.race([callPromise, timeoutPromise]);
}

// Compressão do Contexto (SMART PAYLOAD)
// Evita gastar excessos de tokens, mantendo Coerência Persistente
function buildSmartPayload() {
  // A UI inteira tem N elementos no history. Vamos embarcar:
  // 1. TODOS os itens da persistentContext (nunca apagamos o Seed).
  // 2. Apenas os últimos 2 pares (4 itens) do conversationHistory.
  const shortHistory = aiState.conversationHistory.slice(-4);
  return [...aiState.persistentContext, ...shortHistory];
}

// ==========================================
// CHAMADA PRINCIPAL
// ==========================================
window.sendAiMessage = async function() {
  if (aiState.isLoading) return;
  
  const input = document.getElementById('aiChatInput');
  let text = input.value.trim();
  
  if (!text) return;
  // Fallback Limit Payload Local
  if (text.length > MAX_PAYLOAD_CHARS) text = text.substring(0, MAX_PAYLOAD_CHARS);

  if (aiState.dailyUses >= aiState.maxDailyUses) {
    renderMessageSafe('Você atingiu o limite diário de interações com o Professor AI. Volte amanhã para continuar seu treinamento!', 'ai', false, false);
    return;
  }

  // Set Request ID AbortController Simulation
  const reqId = Date.now().toString();
  aiState.currentRequestId = reqId;

  // Envia pra tela local (como history temporário)
  renderMessageSafe(text, 'user', false, true);
  
  input.value = '';
  input.style.height = 'auto';
  setAiLoading(true);

  let success = false;
  let replyText = '';
  let finalUsesResult = aiState.dailyUses;

  // Lógica de Retries
  const MAX_RETRIES = 1;
  let attempt = 0;

  while(attempt <= MAX_RETRIES && !success) {
      if (aiState.currentRequestId !== reqId) return; // Request Cancela se abas/contextos trocarem

      try {
        const response = await executeIntelligentFunction('askProfessorAI', {
            flow: aiState.currentFlow,
            message: text,
            context: buildSmartPayload() // Enviamos Smart Context
        }, TIMEOUT_MS);

        if (aiState.currentRequestId !== reqId) return; // Checagem pós-rede
        
        replyText = response.data.reply;
        finalUsesResult = response.data.uses || aiState.dailyUses + 1;
        success = true;

      } catch (error) {
         if (aiState.currentRequestId !== reqId) return;
         
         if (error.message.includes('limite') || error.message.includes('unauthenticated')) {
             // Erros de trava direta não precisam de retry
             attempt = 999;
             if (error.message.includes('limite')) finalUsesResult = aiState.maxDailyUses;
             replyText = error.message.includes('limite') 
               ? 'Você atingiu o limite diário. Encerramos por hoje.' 
               : 'Usuário não autenticado.';
             break;
         }

         attempt++;
         if (attempt <= MAX_RETRIES) {
             console.warn(`⏳ Falha na IA. Tentando novamente... (Tentativa ${attempt}/${MAX_RETRIES})`, error);
             await new Promise(r => setTimeout(r, 1500)); // Delay
         } else {
             console.error("❌ Falha crítica: Erro na última tentativa.");
             replyText = error.message === 'TIMEOUT' 
               ? 'O Professor AI demorou mais que o esperado para responder. Tente novamente em instantes.'
               : 'Estou enfrentando problemas de conexão temporários. Você pode repetir a frase?';
         }
      }
  }

  // Check anti-race conditions pós retry-loops
  if (aiState.currentRequestId !== reqId) return; 

  // Atualização Visual Final
  aiState.dailyUses = finalUsesResult;
  updateUsageBadge();
  setAiLoading(false);

  // Anexamos a IA
  if (success) {
      // Se estamos no primeiro envio, o app deduz que esse par de conversa e a IA 
      // tem um fator persistente pro plano de estudos se fixar. 
      const isEarly = aiState.conversationHistory.length <= 4;
      renderMessageSafe(replyText, 'ai', isEarly, true); // Opcionalmente ancoramos a primeira msg da Nuvem como Base
      syncSessionToStorage(); // Sincroniza persistencia Híbrida 
  } else {
      renderMessageSafe(replyText, 'ai', false, false); // Erros não vão pro histórico
  }
};
