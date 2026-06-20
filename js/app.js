const TEMPLATE_QUIZ_SIZE = 30;
let POOL = []; let currentIndex = 0; let score = 0; let quizStarted = false;
let simulationStartTime = null;
let isGrandeDia = false; let grandeDiaInterval = null;
const SOUND_KEY = 'quiz_sound_on'; const SCALE_KEY = 'quiz_card_scale'; const BEST_KEY = 'quiz_best_record';
const XP_KEY = 'quiz_xp'; const STREAK_KEY = 'quiz_streak'; const LAST_DATE_KEY = 'quiz_last_date';

window.syncGamificationToCloud = async function() {
  if (!window.firebase || !firebase.auth().currentUser) return;
  try {
      const db = firebase.firestore();
      const docRef = db.collection('users').doc(firebase.auth().currentUser.uid);
      await docRef.update({
          quiz_xp: parseInt(localStorage.getItem('quiz_xp') || '0'),
          quiz_streak: parseInt(localStorage.getItem('quiz_streak') || '0'),
          quiz_last_date: localStorage.getItem('quiz_last_date') || '',
          quiz_best_record: JSON.parse(localStorage.getItem('quiz_best_record') || '{"pct":-1}'),
          quiz_unlocked_badges: JSON.parse(localStorage.getItem('quiz_unlocked_badges') || '[]'),
          quiz_topic_stats: JSON.parse(localStorage.getItem('quiz_topic_stats') || '{}')
      });
  } catch(e) {}
};

// Navegação entre telas do App
window.showPage = window.go = function(id) {
  // Garantir que pinch-to-zoom está desativado ao navegar
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    viewportMeta.content = "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=0";
  }
  
  // Esconde todas as sections com classe 'page'
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // Mostra a alvo
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  
  // Atualiza as tabs (se existirem)
  // Para Perfil e Dashboard (sem tab própria), não altera seleção
  const tabPageIds = ['home','jornada','resumos','quiz','prof-ai'];
  document.querySelectorAll('.tabbtn').forEach(btn => {
     btn.classList.toggle('active', btn.getAttribute('data-target') === id);
  });

  // Foco no simulado
  if(id === 'quiz' && quizStarted) document.body.classList.add('quiz-focus');
  else document.body.classList.remove('quiz-focus');

  document.body.classList.remove('summary-focus');
  const existing = document.getElementById('mfRrFullscreen');
  if (existing) existing.remove();

  // Gatilhos extras de carregamento
  if (id === 'home') {
     showBestRecord();
     updateXPUI();
     checkStreak();
     if(typeof renderMissaoDoDia === 'function') renderMissaoDoDia();
     if(typeof renderJornadaHomeStats === 'function') renderJornadaHomeStats();
  }
  if (id === 'dashboard') {
     showBestRecord();
     updateXPUI();
     checkStreak();
     if(typeof renderBadges === 'function') renderBadges();
     if(typeof renderStatsChart === 'function') renderStatsChart();
  }
  if(id === 'jornada') {
     if(typeof renderJornada === 'function') renderJornada();
  }
  if(id === 'perfil') {
     if(typeof renderPerfil === 'function') renderPerfil();
  }
  if(id === 'resumos' || id === 'study') renderStudies();
  if(id === 'cards') renderCards();
  if(id === 'quiz' && !quizStarted) showTopicSelection();
  
  // Scroll para o topo
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function checkStreak() {
  let streak = parseInt(localStorage.getItem(STREAK_KEY) || '0');
  let lastDate = localStorage.getItem(LAST_DATE_KEY);
  const todayStr = new Date().toISOString().split('T')[0];
  if (lastDate) {
    const diffDays = Math.floor(Math.abs(new Date(todayStr) - new Date(lastDate)) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) { streak = 0; localStorage.setItem(STREAK_KEY, streak); }
  }
  const el = document.getElementById('streakValue');
  if(el) el.textContent = `${streak} Dia${streak!==1?'s':''}`;
}

function registerStudyDay() {
  let streak = parseInt(localStorage.getItem(STREAK_KEY) || '0');
  let lastDate = localStorage.getItem(LAST_DATE_KEY);
  const todayStr = new Date().toISOString().split('T')[0];
  if (lastDate !== todayStr) {
    const diffDays = lastDate ? Math.floor(Math.abs(new Date(todayStr) - new Date(lastDate)) / (1000 * 60 * 60 * 24)) : 0;
    streak = (diffDays <= 1 || !lastDate) ? streak + 1 : 1;
    localStorage.setItem(STREAK_KEY, streak);
    localStorage.setItem(LAST_DATE_KEY, todayStr);
    if (window.sincronizarCloud) window.sincronizarCloud();
  }
  const el = document.getElementById('streakValue');
  if(el) el.textContent = `${streak} Dia${streak!==1?'s':''}`;
  if(window.syncGamificationToCloud) window.syncGamificationToCloud();
}

function getLevelInfo(xp) {
    let level = 1;
    let requiredXP = 100;
    let currentLevelXP = 0;
    while (xp >= requiredXP) {
        level++;
        currentLevelXP = requiredXP;
        requiredXP = Math.floor(requiredXP * 1.5) + 50;
    }
    return {
        level: level,
        currentXP: xp,
        minXP: currentLevelXP,
        nextXP: requiredXP,
        progressPct: Math.max(0, Math.min(100, ((xp - currentLevelXP) / (requiredXP - currentLevelXP)) * 100))
    };
}

function updateXPUI() {
  const xp = parseInt(localStorage.getItem(XP_KEY) || '0');
  const elXP   = document.getElementById('xpValue');
  const elNextXP = document.getElementById('xpNextValue');
  const elRank = document.getElementById('rankValue');
  const elNext = document.getElementById('xpNextRank');
  const elFill = document.getElementById('xpBarFill');
  const elRestante = document.getElementById('xpRestante');
  
  const levelInfo = getLevelInfo(xp);
  const xpRestante = levelInfo.nextXP - xp;

  if(elXP) elXP.textContent = xp.toLocaleString('pt-BR');
  if(elNextXP) elNextXP.textContent = levelInfo.nextXP.toLocaleString('pt-BR');
  if(elRank) elRank.textContent = `Nível ${levelInfo.level}`;
  if(elNext) elNext.textContent = `Próximo: Nível ${levelInfo.level + 1}`;
  if(elRestante) elRestante.textContent = `faltam ${xpRestante} XP`;
  
  if(elFill) {
    elFill.style.width = levelInfo.progressPct + '%';
  }
}

function addXP(amount) {
  let xp = parseInt(localStorage.getItem(XP_KEY) || '0');
  const levelAntes = getLevelInfo(xp).level;
  xp += amount;
  localStorage.setItem(XP_KEY, xp);
const TEMPLATE_QUIZ_SIZE = 30;
let POOL = []; let currentIndex = 0; let score = 0; let quizStarted = false;
let simulationStartTime = null;
let isGrandeDia = false; let grandeDiaInterval = null;
const SOUND_KEY = 'quiz_sound_on'; const SCALE_KEY = 'quiz_card_scale'; const BEST_KEY = 'quiz_best_record';
const XP_KEY = 'quiz_xp'; const STREAK_KEY = 'quiz_streak'; const LAST_DATE_KEY = 'quiz_last_date';

window.syncGamificationToCloud = async function() {
  if (!window.firebase || !firebase.auth().currentUser) return;
  try {
      const db = firebase.firestore();
      const docRef = db.collection('users').doc(firebase.auth().currentUser.uid);
      await docRef.update({
          quiz_xp: parseInt(localStorage.getItem('quiz_xp') || '0'),
          quiz_streak: parseInt(localStorage.getItem('quiz_streak') || '0'),
          quiz_last_date: localStorage.getItem('quiz_last_date') || '',
          quiz_best_record: JSON.parse(localStorage.getItem('quiz_best_record') || '{"pct":-1}'),
          quiz_unlocked_badges: JSON.parse(localStorage.getItem('quiz_unlocked_badges') || '[]'),
          quiz_topic_stats: JSON.parse(localStorage.getItem('quiz_topic_stats') || '{}')
      });
  } catch(e) {}
};

// Navegação entre telas do App
window.showPage = window.go = function(id) {
  // Garantir que pinch-to-zoom está desativado ao navegar
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    viewportMeta.content = "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=0";
  }
  
  // Esconde todas as sections com classe 'page'
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // Mostra a alvo
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  
  // Atualiza as tabs (se existirem)
  // Para Perfil e Dashboard (sem tab própria), não altera seleção
  const tabPageIds = ['home','jornada','resumos','quiz','prof-ai'];
  document.querySelectorAll('.tabbtn').forEach(btn => {
     btn.classList.toggle('active', btn.getAttribute('data-target') === id);
  });

  // Foco no simulado
  if(id === 'quiz' && quizStarted) document.body.classList.add('quiz-focus');
  else document.body.classList.remove('quiz-focus');

  document.body.classList.remove('summary-focus');
  const existing = document.getElementById('mfRrFullscreen');
  if (existing) existing.remove();

  // Gatilhos extras de carregamento
  if (id === 'home') {
     showBestRecord();
     updateXPUI();
     checkStreak();
     if(typeof renderMissaoDoDia === 'function') renderMissaoDoDia();
     if(typeof renderJornadaHomeStats === 'function') renderJornadaHomeStats();
  }
  if (id === 'dashboard') {
     showBestRecord();
     updateXPUI();
     checkStreak();
     if(typeof renderBadges === 'function') renderBadges();
     if(typeof renderStatsChart === 'function') renderStatsChart();
  }
  if(id === 'jornada') {
     if(typeof renderJornada === 'function') renderJornada();
  }
  if(id === 'perfil') {
     if(typeof renderPerfil === 'function') renderPerfil();
  }
  if(id === 'resumos' || id === 'study') renderStudies();
  if(id === 'cards') renderCards();
  if(id === 'quiz' && !quizStarted) showTopicSelection();
  
  // Scroll para o topo
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function checkStreak() {
  let streak = parseInt(localStorage.getItem(STREAK_KEY) || '0');
  let lastDate = localStorage.getItem(LAST_DATE_KEY);
  const todayStr = new Date().toISOString().split('T')[0];
  if (lastDate) {
    const diffDays = Math.floor(Math.abs(new Date(todayStr) - new Date(lastDate)) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) { streak = 0; localStorage.setItem(STREAK_KEY, streak); }
  }
  const el = document.getElementById('streakValue');
  if(el) el.textContent = `${streak} Dia${streak!==1?'s':''}`;
}

function registerStudyDay() {
  let streak = parseInt(localStorage.getItem(STREAK_KEY) || '0');
  let lastDate = localStorage.getItem(LAST_DATE_KEY);
  const todayStr = new Date().toISOString().split('T')[0];
  if (lastDate !== todayStr) {
    const diffDays = lastDate ? Math.floor(Math.abs(new Date(todayStr) - new Date(lastDate)) / (1000 * 60 * 60 * 24)) : 0;
    streak = (diffDays <= 1 || !lastDate) ? streak + 1 : 1;
    localStorage.setItem(STREAK_KEY, streak);
    localStorage.setItem(LAST_DATE_KEY, todayStr);
    if (window.sincronizarCloud) window.sincronizarCloud();
  }
  const el = document.getElementById('streakValue');
  if(el) el.textContent = `${streak} Dia${streak!==1?'s':''}`;
  if(window.syncGamificationToCloud) window.syncGamificationToCloud();
}

function getLevelInfo(xp) {
    let level = 1;
    let requiredXP = 100;
    let currentLevelXP = 0;
    while (xp >= requiredXP) {
        level++;
        currentLevelXP = requiredXP;
        requiredXP = Math.floor(requiredXP * 1.5) + 50;
    }
    return {
        level: level,
        currentXP: xp,
        minXP: currentLevelXP,
        nextXP: requiredXP,
        progressPct: Math.max(0, Math.min(100, ((xp - currentLevelXP) / (requiredXP - currentLevelXP)) * 100))
    };
}

function updateXPUI() {
  const xp = parseInt(localStorage.getItem(XP_KEY) || '0');
  const elXP   = document.getElementById('xpValue');
  const elNextXP = document.getElementById('xpNextValue');
  const elRank = document.getElementById('rankValue');
  const elNext = document.getElementById('xpNextRank');
  const elFill = document.getElementById('xpBarFill');
  const elRestante = document.getElementById('xpRestante');
  
  const levelInfo = getLevelInfo(xp);
  const xpRestante = levelInfo.nextXP - xp;

  if(elXP) elXP.textContent = xp.toLocaleString('pt-BR');
  if(elNextXP) elNextXP.textContent = levelInfo.nextXP.toLocaleString('pt-BR');
  if(elRank) elRank.textContent = `Nível ${levelInfo.level}`;
  if(elNext) elNext.textContent = `Próximo: Nível ${levelInfo.level + 1}`;
  if(elRestante) elRestante.textContent = `faltam ${xpRestante} XP`;
  
  if(elFill) {
    elFill.style.width = levelInfo.progressPct + '%';
  }
}

function addXP(amount) {
  let xp = parseInt(localStorage.getItem(XP_KEY) || '0');
  const levelAntes = getLevelInfo(xp).level;
  xp += amount;
  localStorage.setItem(XP_KEY, xp);
  if (window.sincronizarCloud) window.sincronizarCloud();
  updateXPUI();
  


  if(window.animarGanhoXP) window.animarGanhoXP(amount);
  if(window.syncGamificationToCloud) window.syncGamificationToCloud();
}

function q_text(q){ return q.pergunta || q.perguntas || q.question || ''; }
function q_topic(q){ return q.materia || q.topico || q.tópico || q.topic || ''; }
function q_expl(q){ return q.explicacao || q.explicação || q.explanation || ''; }
function q_answer_letter(q){ const a = (q.resposta || q.answer || '').toString().trim(); return a.substr(0,1).toUpperCase(); }
function q_option(q, letter){ return q[letter.toUpperCase()] || q[letter.toLowerCase()] || ''; }

// Normaliza string para comparação fuzzy (remove acentos, pontuação extra, lower case)
function normalizarMateria(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Verifica se dois nomes de matéria correspondem (exato ou fuzzy)
function materiasCompatíveis(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const na = normalizarMateria(a);
  const nb = normalizarMateria(b);
  if (na === nb) return true;
  // Verificação parcial: um contém o início do outro (para casos como "Código Penal (DL 2.848/1940)" vs "Código Penal / Direito Penal")
  const keyA = na.split(' ').slice(0, 3).join(' ');
  const keyB = nb.split(' ').slice(0, 3).join(' ');
  if (keyA && keyB && (na.startsWith(keyB) || nb.startsWith(keyA) || keyA === keyB)) return true;
  return false;
}

function getFirestoreDb(){
  if (window.firebase && firebase.firestore) return firebase.firestore();
  throw new Error('Firebase Firestore não está disponível no front.');
}

window.buscarQuestoesAleatorias = async function(ref, quantidade) {
  const limite = Math.max(1, Math.floor(Number(quantidade) || 1));
  const ponto = Math.random();
  const porId = new Map();
  const adicionar = (snap) => snap.forEach(doc => porId.set(doc.id, { id: doc.id, ...doc.data() }));

  const ordenada = ref.orderBy('randomKey');
  adicionar(await ordenada.where('randomKey', '>=', ponto).limit(limite).get());
  if (porId.size < limite) {
    adicionar(await ordenada.where('randomKey', '<', ponto).limit(limite - porId.size).get());
  }

  return Array.from(porId.values()).slice(0, limite);
};

async function loadTopicQuestions(topic) {
  isGrandeDia = false;
  if (grandeDiaInterval) { clearInterval(grandeDiaInterval); grandeDiaInterval = null; }
  document.getElementById('quizTimerContainer').style.display = 'none';
  document.getElementById('quizSetup').style.display = 'none';
  document.getElementById('quizActive').style.display = 'flex';
  document.body.classList.add('quiz-focus');
  document.getElementById('question').innerHTML = '<div class="empty-state"><i class="ph ph-spinner-gap ph-spin"></i><p>Preparando...</p></div>';
  simulationStartTime = Date.now();
  try {
    const db = getFirestoreDb();
    let ref = db.collection('questoes').where('ativo', '==', true);
    if (topic && topic !== 'Todos') ref = ref.where('materia', '==', topic);
    POOL = await window.buscarQuestoesAleatorias(ref, TEMPLATE_QUIZ_SIZE);

    // Fallback: se não encontrou questões com o nome exato, busca todas e filtra por similaridade
    if (POOL.length === 0 && topic && topic !== 'Todos') {
      console.warn(`[Simulado] Fallback de similaridade para "${topic}"...`);
      const refGeral = db.collection('questoes').where('ativo', '==', true);
      const todas = await window.buscarQuestoesAleatorias(refGeral, 500);
      const filtradas = todas.filter(q => materiasCompatíveis(q_topic(q), topic));
      if (filtradas.length > 0) {
        console.info(`[Simulado] Valor real do campo materia: "${q_topic(filtradas[0])}".`);
        POOL = filtradas.sort(() => Math.random() - 0.5).slice(0, TEMPLATE_QUIZ_SIZE);
      }
    }

    currentIndex = 0; score = 0; quizStarted = true;
    renderQuestion();
  } catch (e) {
    console.error('[Simulado] Erro:', e);
    POOL = []; currentIndex = 0; score = 0; quizStarted = true; renderQuestion();
  }
}

function renderQuestion(){
  if (currentIndex >= POOL.length) { finishQuiz(); return; }
  const q = POOL[currentIndex];

  const qBox = document.getElementById('question');
  qBox.innerHTML = '<div class="topic-tag"><i class="ph ph-bookmark-simple"></i> <span id="qTopicText"></span></div><div class="q-text" id="qMainText"></div>';
  document.getElementById('qTopicText').textContent = q_topic(q);
  document.getElementById('qMainText').textContent = q_text(q);

  const opts = document.getElementById('opts');
  opts.innerHTML = '';
  ['A','B','C','D'].forEach(letter => {
    const txt = q_option(q, letter);
    if (!txt) return;
    const btn = document.createElement('button');
    btn.className = 'opt'; btn.id = 'opt_' + letter;
    const spanLetter = document.createElement('span');
    spanLetter.style.cssText = "font-weight:800; color:var(--primary); min-width:24px;";
    spanLetter.textContent = `${letter})`;
    
    const spanText = document.createElement('span');
    spanText.textContent = txt;
    
    btn.appendChild(spanLetter);
    btn.appendChild(spanText);
    btn.onclick = () => selectOption(letter);
    opts.appendChild(btn);
  });

  const pct = POOL.length ? Math.round((currentIndex / POOL.length) * 100) : 0;
  document.getElementById('bar').style.width = pct + '%';
  document.getElementById('progressInfo').innerText = POOL.length ? `${currentIndex + 1} / ${POOL.length}` : '0 / 0';
  document.getElementById('progressText').textContent = `Pontos: ${score}`;
  
  document.getElementById('sheetNextBtn').style.display = (currentIndex < POOL.length - 1) ? 'block' : 'none';
  document.getElementById('sheetFinishBtn').style.display = (currentIndex === POOL.length - 1) ? 'block' : 'none';
}

function selectOption(letter){
  const q = POOL[currentIndex];
  const correct = q_answer_letter(q);
  document.querySelectorAll('.opt').forEach(b => b.disabled = true);
  
  const elCorrect = document.getElementById('opt_' + correct);
  if (elCorrect) elCorrect.classList.add('correct');
  
  const isCorrect = (letter === correct);

  // Gamificação: Salvar estatísticas
  try {
    const topStr = q_topic(q) || 'Gerais';
    let tStats = JSON.parse(localStorage.getItem('quiz_topic_stats') || '{}');
    if(!tStats[topStr]) tStats[topStr] = { t:0, c:0 };
    tStats[topStr].t += 1;
    if(isCorrect) tStats[topStr].c += 1;
    localStorage.setItem('quiz_topic_stats', JSON.stringify(tStats));
    if(window.syncGamificationToCloud) window.syncGamificationToCloud();
  } catch(e) {}
  
  if (!isCorrect) {
    const chosen = document.getElementById('opt_' + letter);
    if (chosen) chosen.classList.add('wrong');
    playWrong();
  } else {
    score++;
    playCorrect();
  }
  
  const iconHtml = isCorrect ? '<i class="ph-fill ph-check-circle"></i> Acertou!' : '<i class="ph-fill ph-x-circle"></i> Errou!';
  const colorClass = isCorrect ? 'var(--success)' : 'var(--danger)';
  
  const explBody = document.getElementById('explainBody');
  explBody.innerHTML = `
    <div id="explTitle" style="font-size: 24px; font-weight:800; display:flex; align-items:center; gap:8px; margin-bottom: 12px;"></div>
    <div id="explText" style="font-size:15px; color:var(--text-main); line-height:1.6;"></div>
  `;
  const explTitle = document.getElementById('explTitle');
  explTitle.style.color = colorClass;
  explTitle.innerHTML = iconHtml;
  
  document.getElementById('explText').textContent = q_expl(q) || 'Nenhuma explicação técnica fornecida para esta questão.';
  document.getElementById('explainSheet').classList.add('show');
}

window.closeExplain = function(){
  document.getElementById('explainSheet').classList.remove('show');
}

document.getElementById('sheetNextBtn').onclick = () => {
  closeExplain();
  currentIndex++;
  setTimeout(renderQuestion, 300); // aguarda o modal descer
};
document.getElementById('sheetFinishBtn').onclick = () => {
  closeExplain();
  currentIndex++;
  setTimeout(renderQuestion, 300);
};

window.quitQuiz = function(){
  quizStarted = false; isGrandeDia = false;
  if(grandeDiaInterval) { clearInterval(grandeDiaInterval); grandeDiaInterval = null; }
  document.getElementById('quizTimerContainer').style.display = 'none';
  document.body.classList.remove('quiz-focus');
  document.getElementById('btnRestart').style.display = 'none';
  document.getElementById('btnQuit').style.display = 'block';
  document.getElementById('quizSetup').style.display = 'block';
  document.getElementById('quizActive').style.display = 'none';
  
  // Reseta para o dashboard de simulados
  if(document.getElementById('simuladosDashboard')) {
      document.getElementById('simuladosDashboard').style.display = 'flex';
      document.getElementById('classicTopicSelection').style.display = 'none';
  }
  
  showTopicSelection();
}

function finishQuiz(){
  quizStarted = false;
  if(grandeDiaInterval) { clearInterval(grandeDiaInterval); grandeDiaInterval = null; }
  document.getElementById('quizTimerContainer').style.display = 'none';

    const qBox = document.getElementById('question');
    qBox.innerHTML = `
      <div class="finish-title">
        <i class="ph-fill ph-check-circle"></i> <span id="finishScoreText"></span>
      </div>
    `;
    document.getElementById('finishScoreText').textContent = `Fim! Você acertou ${score} de ${POOL.length}`;
  document.getElementById('opts').innerHTML = '';
  document.getElementById('btnRestart').style.display = 'block';
  document.getElementById('btnQuit').style.display = 'none';
  
  // Salva no histórico para a nova UI
  const timeOnSeconds = simulationStartTime ? Math.floor((Date.now() - simulationStartTime) / 1000) : 0;
  const selectedTopic = document.getElementById('topicSelect')?.value || 'Geral';
  saveToSimuladoHistory(score, POOL.length, timeOnSeconds);

  saveRecord(score, POOL.length);
  const gd = typeof isGrandeDia !== 'undefined' ? isGrandeDia : false;
  if (window.verificarConquistas) window.verificarConquistas({ acertos: score, total: POOL.length, isGrandeDia: gd });

  // Notifica a Jornada se o quiz foi iniciado por ela
  if(typeof window.jornadaOnQuizFinish === 'function') {
    window.jornadaOnQuizFinish(score, POOL.length, selectedTopic);
  }
}

function saveRecord(s, t){
  if(!t) return;
  const pct = Math.round((s/t)*100);
  const prev = JSON.parse(localStorage.getItem(BEST_KEY) || '{"pct":-1}');
  
  registerStudyDay();
  addXP(s * 10); // 10 XP por acerto
  
  if (pct > prev.pct) {
    localStorage.setItem(BEST_KEY, JSON.stringify({score:s, total:t, pct:pct}));
    if(window.syncGamificationToCloud) window.syncGamificationToCloud();
    if(window.confetti && pct > 0) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#10B981', '#3B82F6', '#F59E0B', '#ffffff'] });
    }
  }
}

function showBestRecord(){
  const rec = JSON.parse(localStorage.getItem(BEST_KEY));
  const el = document.getElementById('bestRecord');
  if (el) {
    el.innerHTML = rec 
      ? `<i class="ph-fill ph-trophy"></i> Recorde: ${rec.score}/${rec.total} (${rec.pct}%)` 
      : '<i class="ph ph-rocket"></i> Faça seu primeiro simulado.';
  }
}

async function renderCards(){
  const container = document.getElementById('cardsList');
  container.innerHTML = '<div style="color:var(--text-muted); padding:30px;"><i class="ph ph-spinner-gap ph-spin" style="font-size:32px;"></i></div>';
  try {
    const db = getFirestoreDb();
    let list = [];
    
    // Tenta buscar da coleção "flashcards"
    let snap = await db.collection('flashcards').get();
    snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));

    // Se estiver vazio, cai para o fallback usando "questoes"
    if (!list.length) {
      snap = await db.collection('questoes').where('ativo', '==', true).get();
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
    }

    if (!list.length) { container.innerHTML = 'Vazio'; return; }

    container.innerHTML = '';
    // Shuffle
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }

    let count = Math.min(list.length, 15); // max 15 na deck para não pesar
    for(let i=0; i<count; i++){
      const q = list[i];
      const frontText = (q.pergunta || q.perguntas || q.question || q[Object.keys(q).find(k=>/perg/i.test(k))] || '').toString();
      const topicText = (q.topico || q.tópico || q.materia || q.topic || '').toString();
      const backText = (q.resposta || q.respostas || q.explanation || q.explicacao || q.answer || q[Object.keys(q).find(k=>/resp/i.test(k))] || '').toString();

      const el = document.createElement('div');
      el.className = 'flashcard flashcard-swipeable';
      el.innerHTML = `
        <div class="flash-inner">
          <div class="flash-front">
            <div class="flash-topic">${topicText}</div>
            <div class="flash-text">${frontText}</div>
            <div class="flash-hint"><i class="ph-fill ph-hand-tap"></i> TOQUE P/ VIRAR</div>
          </div>
          <div class="flash-back">
            <div class="flash-topic">${topicText}</div>
            <div class="flash-text">${backText}</div>
            <div class="flash-hint" style="background: rgba(0,0,0,0.2); border-color: rgba(255,255,255,0.1); color: #fff;">
              <i class="ph-bold ph-arrow-u-down-left"></i> TOQUE P/ VOLTAR
            </div>
          </div>
        </div>
      `;
      container.appendChild(el);
    }
    setupTinderSwipe();
  } catch(e) { container.innerHTML = 'Erro ao carregar.'; }
}

function setupTinderSwipe(){
  const container = document.getElementById('cardsList');
  const cards = Array.from(container.querySelectorAll('.flashcard'));
  if(!cards.length) return;

  cards.forEach((card, index) => {
    card.style.zIndex = cards.length - index;
    card.style.transform = `scale(${1 - index * 0.04}) translateY(${index * 15}px)`;
    card.style.pointerEvents = index === 0 ? 'auto' : 'none';
    if(index === 0) makeSwipeable(card);
  });
}

function makeSwipeable(el) {
  let startX = 0, currentX = 0, isDragging = false;
  
  el.onpointerdown = (e) => {
    isDragging = false;
    startX = e.clientX;
    el.style.transition = 'none';
    el.setPointerCapture(e.pointerId);
  };
  
  el.onpointermove = (e) => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    currentX = e.clientX - startX;
    if (Math.abs(currentX) > 10) isDragging = true;
    if (!isDragging) return;
    el.style.transform = `translate(${currentX}px, 0) rotate(${currentX * 0.05}deg)`;
  };
  
  const handleEnd = (e) => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    el.releasePointerCapture(e.pointerId);
    
    el.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease';
    
    if (!isDragging) {
      el.style.transform = 'scale(1) translateY(0)';
      return;
    }
    
    if (Math.abs(currentX) > window.innerWidth * 0.25 || Math.abs(currentX) > 80) {
      const dir = currentX > 0 ? 1 : -1;
      el.style.transform = `translate(${dir * window.innerWidth}px, 0) rotate(${dir * 30}deg)`;
      el.style.opacity = '0';
      setTimeout(() => {
        el.remove();
        setupTinderSwipe();
      }, 400);
    } else {
      el.style.transform = 'scale(1) translateY(0)';
    }
    isDragging = false;
  };

  el.onpointerup = handleEnd;
  el.onpointercancel = handleEnd;
  
  el.onclick = () => {
    if(!isDragging) {
      const inner = el.querySelector('.flash-inner');
      if (inner) inner.classList.toggle('flipped');
    }
  };
}

// Funções de botões swipe flashcard removidas (não utilizadas)

let _cardsReviewState = {
  list: [],
  index: 0
};

function escapeFlashcardHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function detectCardFront(card = {}) {
  const perguntaKey = Object.keys(card).find(k => /perg/i.test(k));
  return (card.frente || card.pergunta || card.perguntas || card.titulo || card.front || card.question || card[perguntaKey] || '').toString();
}

function detectCardBack(card = {}) {
  const respostaKey = Object.keys(card).find(k => /resp/i.test(k));
  return (card.verso || card.resposta || card.respostas || card.conteudo || card.explicacao || card.explanation || card.back || card.answer || card.content || card[respostaKey] || '').toString();
}

async function renderCards(){
  const container = document.getElementById('cardsList');
  if (!container) return;
  const controls = document.querySelector('#cards .deck-controls');
  if (controls) controls.innerHTML = '<i class="ph ph-hand-tap"></i> Toque no cartão e classifique sua revisão';
  container.innerHTML = '<div style="color:var(--text-muted); padding:30px;"><i class="ph ph-spinner-gap ph-spin" style="font-size:32px;"></i></div>';

  try {
    const db = getFirestoreDb();
    let list = [];
    let snap = await db.collection('flashcards').get();
    snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));

    if (!list.length) {
      snap = await db.collection('questoes').where('ativo', '==', true).get();
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
    }

    if (!list.length) {
      container.innerHTML = '<div class="empty-state"><p>Nenhum flashcard encontrado.</p></div>';
      return;
    }

    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }

    _cardsReviewState = { list: list.slice(0, 50), index: 0 };
    renderCardsReviewItem();
  } catch(e) {
    container.innerHTML = 'Erro ao carregar.';
  }
}

function renderCardsReviewItem() {
  const container = document.getElementById('cardsList');
  if (!container) return;
  const { list, index } = _cardsReviewState;
  const total = list.length;

  if (index >= total) {
    container.innerHTML = `
      <div class="mf-etapa-concluida cards-review-done">
        <i class="ph-fill ph-check-circle" style="color:#10B981; font-size:52px;"></i>
        <p>Você revisou todos os flashcards!</p>
        <button class="btn btn-primary" onclick="renderCards()">
          <i class="ph-fill ph-arrow-clockwise"></i> Revisar novamente
        </button>
      </div>
    `;
    return;
  }

  const card = list[index];
  const frontText = escapeFlashcardHtml(detectCardFront(card) || '(sem conteúdo na frente)');
  const backText = escapeFlashcardHtml(detectCardBack(card) || '(sem conteúdo no verso)');
  const topicText = escapeFlashcardHtml(card.topico || card.tópico || card.materia || card.topic || '');
  const pct = Math.round((index / Math.max(total, 1)) * 100);

  container.innerHTML = `
    <div class="cards-review-shell">
      <div class="mf-etapa-titulo">
        <i class="ph-fill ph-cards" style="color:#8B5CF6;"></i>
        <span>Flashcards - ${index + 1}/${total}</span>
      </div>
      <div class="mf-progress-mini">
        <div class="mf-prog-barra">
          <div class="mf-prog-fill" style="width:${pct}%; background:#8B5CF6;"></div>
        </div>
        <span class="mf-prog-label">${pct}%</span>
      </div>
      ${topicText ? `<div class="cards-review-topic">${topicText}</div>` : ''}
      <div class="mf-flashcard-wrap cards-review-wrap">
        <div class="mf-flashcard" id="cardsReviewFlashcard" onclick="virarCardReviewFlashcard()">
          <div class="mf-flashcard-frente">
            <div class="mf-flashcard-hint"><i class="ph ph-hand-tap"></i> Toque para revelar</div>
            <p class="mf-flashcard-texto">${frontText}</p>
            <div class="mf-flashcard-icon-frente"><i class="ph-fill ph-question"></i></div>
          </div>
          <div class="mf-flashcard-verso">
            <div class="mf-flashcard-hint-verso"><i class="ph-fill ph-check-circle"></i> Resposta</div>
            <p class="mf-flashcard-texto">${backText}</p>
          </div>
        </div>
      </div>
      <div class="mf-classificacao" id="cardsReviewClassificacao" style="display:none;">
        <p class="mf-classif-label">Como foi essa?</p>
        <div class="mf-classif-btns">
          <button class="mf-classif-btn mf-classif-dificil" onclick="classificarCardReviewFlashcard('dificil')">
            <i class="ph-fill ph-smiley-sad"></i> Difícil
          </button>
          <button class="mf-classif-btn mf-classif-medio" onclick="classificarCardReviewFlashcard('medio')">
            <i class="ph-fill ph-smiley-meh"></i> Médio
          </button>
          <button class="mf-classif-btn mf-classif-facil" onclick="classificarCardReviewFlashcard('facil')">
            <i class="ph-fill ph-smiley"></i> Fácil
          </button>
        </div>
      </div>
    </div>
  `;
}

window.virarCardReviewFlashcard = function() {
  const card = document.getElementById('cardsReviewFlashcard');
  if (!card) return;
  card.classList.toggle('mf-flashcard-virado');
  const classif = document.getElementById('cardsReviewClassificacao');
  if (classif) setTimeout(() => classif.style.display = 'block', 200);
};

window.classificarCardReviewFlashcard = function(nivel) {
  const { list, index } = _cardsReviewState;
  const card = list[index];
  if (card?.id) {
    try {
      localStorage.setItem(`flashcard_review_${card.id}`, JSON.stringify({
        nivel,
        missaoId: 'cards',
        ts: Date.now()
      }));
    } catch (e) {}
  }
  _cardsReviewState.index++;
  renderCardsReviewItem();
};

/* --- NOVAS FUNCIONALIDADES: O Grande Dia --- */
window.startGrandeDia = async function() {
  document.getElementById('quizSetup').style.display = 'none';
  document.getElementById('quizActive').style.display = 'flex';
  document.getElementById('quizTimerContainer').style.display = 'flex';
  document.body.classList.add('quiz-focus');
  document.getElementById('question').innerHTML = '<div class="empty-state"><i class="ph ph-spinner-gap ph-spin"></i><p>Preparando O Grande Dia...</p></div>';
  
  simulationStartTime = Date.now();

  try {
    POOL = await window.buscarQuestoesAleatorias(
      getFirestoreDb().collection('questoes').where('ativo', '==', true),
      100
    );
    
    currentIndex = 0; score = 0; quizStarted = true; isGrandeDia = true;
    startTimer(3 * 60 * 60); // 3 horas em segundos
    renderQuestion();
  } catch (e) {
    POOL = []; currentIndex = 0; score = 0; quizStarted = true; isGrandeDia = true; renderQuestion();
  }
}

function startTimer(duration) {
  let timer = duration;
  const display = document.getElementById('quizTimerDisplay');
  display.style.color = 'var(--text-main, #ffffff)'; // Reset color
  if(grandeDiaInterval) clearInterval(grandeDiaInterval);
  
  grandeDiaInterval = setInterval(function () {
      let hours = parseInt(timer / 3600, 10);
      let minutes = parseInt((timer % 3600) / 60, 10);
      let seconds = parseInt(timer % 60, 10);

      hours = hours < 10 ? "0" + hours : hours;
      minutes = minutes < 10 ? "0" + minutes : minutes;
      seconds = seconds < 10 ? "0" + seconds : seconds;

      display.textContent = hours + ":" + minutes + ":" + seconds;
      
      if (timer <= 300) { display.style.color = '#ff0000'; } // Perto do fim (5 min)

      if (--timer < 0) {
          clearInterval(grandeDiaInterval);
          finishQuiz();
      }
  }, 1000);
}

/* --- NOVAS FUNCIONALIDADES: GAMIFICAÇÃO --- */
// Sistema de badges unificado e movido para engajamento.js

window.renderStatsChart = function() {
  const container = document.getElementById('statsChartBody');
  if(!container) return;
  const tStats = JSON.parse(localStorage.getItem('quiz_topic_stats') || '{}');
  const topics = Object.keys(tStats);
  
  if (topics.length === 0) {
    container.innerHTML = '<div style="text-align:center; color: var(--text-muted); font-size: 14px;">Responda questões para gerar estatísticas.</div>';
    return;
  }
  
  container.innerHTML = '';
  // Ordena os que mais respondeu primeiro
  topics.sort((a,b) => tStats[b].t - tStats[a].t).forEach(topic => {
    const data = tStats[topic];
    if (data.t === 0) return;
    const pct = Math.round((data.c / data.t) * 100);
    container.innerHTML += `
      <div class="stat-row">
        <div class="stat-header">
           <span class="stat-name">${topic}</span>
           <span class="stat-pct">${pct}%</span>
        </div>
        <div class="stat-bar-container">
           <div class="stat-bar-fill" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  });
}

/* --- FUNCIONALIDADES: UI DE SIMULADOS --- */

window.showClassicTopicSelection = function() {
  document.getElementById('simuladosDashboard').style.display = 'none';
  document.getElementById('classicTopicSelection').style.display = 'flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.backToSimuladosDashboard = function() {
  document.getElementById('simuladosDashboard').style.display = 'flex';
  document.getElementById('classicTopicSelection').style.display = 'none';
};

window.startRapidClassic = function() {
  const topic = document.getElementById('topicSelect').value;
  loadTopicQuestions(topic);
};

// Versão da Jornada: inicia simulado com qtd limitada e registra nó pendente
window.startRapidClassicJornada = async function(materia, qtd, modId, missaoId) {
  window._jornada_pending_no = { modId, missaoId, materia, qtd };
  await loadTopicQuestionsLimited(materia, qtd);
};

async function loadTopicQuestionsLimited(topic, qtd) {
  isGrandeDia = false;
  if(grandeDiaInterval) { clearInterval(grandeDiaInterval); grandeDiaInterval = null; }
  document.getElementById('quizTimerContainer').style.display = 'none';
  document.getElementById('quizSetup').style.display = 'none';
  document.getElementById('quizActive').style.display = 'flex';
  document.body.classList.add('quiz-focus');
  document.getElementById('question').innerHTML = '<div class="empty-state"><i class="ph ph-spinner-gap ph-spin"></i><p>Preparando...</p></div>';
  simulationStartTime = Date.now();
  try {
    const db = getFirestoreDb();
    let ref = db.collection('questoes').where('ativo', '==', true);
    if (topic && topic !== 'Todos') ref = ref.where('materia', '==', topic);
    POOL = await window.buscarQuestoesAleatorias(ref, qtd || 5);

    // Fallback: se não encontrou questões com o nome exato, busca todas e filtra por similaridade
    if (POOL.length === 0 && topic && topic !== 'Todos') {
      console.warn(`[Simulado-Jornada] Fallback de similaridade para "${topic}"...`);
      const refGeral = db.collection('questoes').where('ativo', '==', true);
      const todas = await window.buscarQuestoesAleatorias(refGeral, 500);
      const filtradas = todas.filter(q => materiasCompatíveis(q_topic(q), topic));
      if (filtradas.length > 0) {
        POOL = filtradas.sort(() => Math.random() - 0.5).slice(0, qtd || 5);
      }
    }

    currentIndex = 0; score = 0; quizStarted = true;
    renderQuestion();
  } catch(e) {
    console.error('[Simulado-Jornada] Erro:', e);
    POOL = []; currentIndex = 0; score = 0; quizStarted = true; renderQuestion();
  }
}

function saveToSimuladoHistory(score, total, timeOnSeconds) {
  try {
    const history = JSON.parse(localStorage.getItem('quiz_detailed_history') || '[]');
    const selectedTopic = document.getElementById('topicSelect').value || "Geral";
    
    let displayTitle = "Simulado Geral";
    if (isGrandeDia) {
      displayTitle = "Simulado Completo";
    } else if (selectedTopic !== "Todos" && selectedTopic !== "Geral") {
      displayTitle = selectedTopic;
    } else {
      displayTitle = "Simulado Rápido (Geral)";
    }

    const newEntry = {
      id: Date.now(),
      title: displayTitle,
      topic: selectedTopic,
      score: score,
      total: total,
      pct: Math.round((score / total) * 100),
      date: new Date().toLocaleDateString('pt-BR'),
      timestamp: Date.now(),
      isGrandeDia: isGrandeDia,
      timeSpent: timeOnSeconds || 0
    };
    
    // Adiciona ao topo e limita a 10 registros
    history.unshift(newEntry);
    localStorage.setItem('quiz_detailed_history', JSON.stringify(history.slice(0, 10)));
  } catch(e) {}
}

function formatTime(seconds) {
  if (!seconds) return "";
  if (seconds < 60) return `${seconds} seg`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
      const secs = seconds % 60;
      return secs > 0 ? `${minutes}m ${secs}s` : `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

window.renderSimuladoHistory = function() {
  const container = document.getElementById('simuladoHistoryList');
  if (!container) return;
  
  const history = JSON.parse(localStorage.getItem('quiz_detailed_history') || '[]');
  
  if (history.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px; color:var(--text-muted);">
        <i class="ph ph-brain" style="font-size:32px; margin-bottom:10px;"></i>
        <p>Suas atividades aparecerão aqui.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  // Mostra apenas os 3 últimos no dashboard
  history.slice(0, 3).forEach(item => {
    // Se tiver tempo real, usa ele. Caso contrário usa a estimativa antiga como fallback
    let timeSpentText = "";
    if (item.timeSpent) {
      timeSpentText = formatTime(item.timeSpent);
    } else {
      timeSpentText = item.isGrandeDia ? "180 min" : `${item.total * 1.5} min`;
    }

    const questionsText = `${item.total} questões • ${timeSpentText}`;
    const colorClass = item.pct >= 70 ? 'blue' : 'orange';
    const statusText = item.pct >= 70 ? 'Concluído' : 'Em andamento';
    const statusClass = item.pct >= 70 ? 'concluded' : 'ongoing';

    container.innerHTML += `
      <div class="history-item-card">
        <div class="history-item-top">
          <div class="history-item-title-group">
            <h3>${(item.title === 'Simulado Disciplina' || item.title === 'Simulado Geral' || item.title === 'Simulado Diciplina') ? (item.topic === 'Todos' ? 'Simulado Geral' : (item.topic || item.title)) : item.title}</h3>
            <div class="history-item-meta">${questionsText}</div>
          </div>
          <div class="status-badge ${statusClass}">${statusText}</div>
        </div>
        
        <div class="history-stats-grid">
          <div class="stat-item-premium">
            <span class="stat-item-label">Nota</span>
            <span class="stat-item-value">${item.pct}%</span>
          </div>
          <div class="stat-item-premium" style="text-align: right;">
            <span class="stat-item-label">Acertos</span>
            <span class="stat-item-value">${item.score}/${item.total}</span>
          </div>
        </div>
        
        <div class="premium-progress-track">
          <div class="premium-progress-bar ${colorClass}" style="width: ${item.pct}%"></div>
        </div>
        
        <div class="history-item-footer">
          <i class="ph ph-calendar"></i> Realizado em ${item.date}
        </div>
      </div>
    `;
  });
};

showBestRecord();
checkStreak();
updateXPUI();
if (typeof renderBadges === 'function') renderBadges();
if (typeof renderStatsChart === 'function') renderStatsChart();
