// ===== CONFIGURAÇÕES GERAIS =====
const SCRIPT_URL =
'https://script.google.com/macros/s/AKfycbx64clSmoa7ymBZls8osmpp6PuwCyqHJ0bcOBz9NI0PqBM_tHr8Px_lGdQEr_9INdMB3g/exec'https://script.google.com/macros/s/AKfycbx64clSmoa7ymBZls8osmpp6PuwCyqHJ0bcOBz9NI0PqBM_tHr8Px_ldQEr_9INdMB3g/exec';
const TEMPLATE_QUIZ_SIZE = 20;

// ===== DADOS DO QUIZ =====
let POOL = [];
let currentIndex = 0;
let score = 0;
let quizStarted = false;

// ===== LOCALSTORAGE KEYS =====
const SOUND_KEY = 'quiz_sound_on';
const SCALE_KEY = 'quiz_card_scale';
const BEST_KEY = 'quiz_best_record';
const STREAK_KEY = 'quiz_streak';
const QUESTIONS_KEY = 'quiz_total_questions';
const LAST_VISIT_KEY = 'quiz_last_visit';
const DAILY_DATA_KEY = 'quiz_daily_data';

// ===== HELPERS DE QUESTÕES =====
function q_text(q){ return q.pergunta || q.perguntas || q.question || ''; }
function q_topic(q){ return q.materia || q.topico || q.tópico || q.topic || ''; }
function q_expl(q){ return q.explicacao || q.explicação || q.explanation || ''; }
function q_answer_letter(q){ const a = (q.resposta || q.answer || '').toString().trim(); return
a.substr(0,1).toUpperCase(); }
function q_option(q, letter){ return q[letter.toUpperCase()] || q[letter.toLowerCase()] || ''; }

// ===== FIRESTORE =====
function getFirestoreDb(){
  try {
    if (window.firebase && firebase.firestore) {
      return firebase.firestore();
    }
  } catch(e) {}
  return null;
}

// ===== MOBILE HEIGHT =====
function isMobile(){ return window.matchMedia && window.matchMedia('(max-width: 600px)').matches; }

function updateMobileQuizHeight(){
  if(!isMobile()) return;
  const header = document.getElementById('cardHeader');
  const tabs = document.getElementById('tabsBar');
  const headerVisible = header && getComputedStyle(header).display !== 'none';
  const headerH = headerVisible ? Math.ceil(header.getBoundingClientRect().height) : 0;
  const tabsH = tabs ? Math.ceil(tabs.getBoundingClientRect().height + 20) : 86;
  document.documentElement.style.setProperty('--header-h', headerH + 'px');
  document.documentElement.style.setProperty('--tabs-h', tabsH + 'px');
  const extra = 26;
  const quizH = Math.max(360, Math.floor(window.innerHeight - headerH - tabsH - extra));
  document.documentElement.style.setProperty('--quiz-h', quizH + 'px');
}

function applyQuizViewportMode(on){
  const quizEl = document.getElementById('quiz');
  if(!quizEl) return;
  document.body.classList.toggle('quiz-mode', !!on);
  if(isMobile() && on){
    document.body.classList.add('lock-scroll');
    quizEl.classList.add('quiz-viewport');
    requestAnimationFrame(() => { updateMobileQuizHeight(); });
  }else{
    document.body.classList.remove('lock-scroll');
    quizEl.classList.remove('quiz-viewport');
    updateMobileQuizHeight();
  }
}

window.addEventListener('resize', () => { updateMobileQuizHeight(); });

// ===== SOM =====
let audioCtx = null;
function ensureAudio(){ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }

function playTone(freq, dur=120, type='sine', gainVal=0.06){
  if (localStorage.getItem(SOUND_KEY) === '0') return;
  try{
    ensureAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gainVal;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    setTimeout(()=>{ o.stop(); o.disconnect(); g.disconnect(); }, dur);
  }catch(e){}
}

function playCorrect(){ playTone(880, 120, 'sine', 0.06); }
function playWrong(){ playTone(220, 220, 'sawtooth', 0.08); }

// ===== SCALE =====
function setScale(v){
  v = Math.max(0.8, Math.min(1.4, Number(v)));
  const appRoot = document.getElementById('appRoot');
  const scaleLabel = document.getElementById('scaleLabel');
  if(appRoot) appRoot.style.transform = `scale(${v.toFixed(2)})`;
  if(appRoot) appRoot.style.transformOrigin = 'top center';
  if(scaleLabel) scaleLabel.innerText = 'x' + v.toFixed(2);
  localStorage.setItem(SCALE_KEY, v.toFixed(2));
  updateMobileQuizHeight();
}

// ===== FUNÇÃO GLOBAL DE NAVEGAÇÃO (IMPORTANTE!) =====
window.go = function(target){
  console.log('Navegando para:', target);

  const pages = document.querySelectorAll('.page');
  pages.forEach(p => p.classList.remove('active'));

  const targetPage = document.getElementById(target);
  if(targetPage) {
    targetPage.classList.add('active');
    console.log('Página ativa:', target);
  }

  const tabbtns = document.querySelectorAll('.tabbtn');
  tabbtns.forEach(b => {
    const isActive = b.dataset.target === target;
    b.classList.toggle('active', isActive);
  });

  applyQuizViewportMode(target === 'quiz');
  window.scrollTo({top: 0, behavior: 'smooth'});

  if (target === 'home') {
    showBestRecord();
    loadStats();
    setDailyTip();
    setTimeout(renderChart, 400);
  }
  if (target === 'study') renderStudies();
  if (target === 'cards') renderCards();
  if (target === 'quiz' && !quizStarted) showTopicSelection();
};

// ===== LINKIFY =====
function linkify(text) {
  if(!text) return '';
  const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  return text.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

// ===== ESTUDOS =====
async function renderStudies(){
  const container = document.getElementById('studyList');
  if(!container) return;
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando
conteúdos...</p></div>';
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getStudies`);
    const js = await res.json();
    if (js.ok && js.studies && js.studies.length > 0){
      container.innerHTML = '';
      js.studies.forEach(s => {
        const d = document.createElement('details');
        d.className = 'summary';
        const content = linkify(s.conteudo || '');
        d.innerHTML = `<summary>${s.topico || 'Tópico'}</summary><div class="study-content">${content}</div>`;
        container.appendChild(d);
      });
    } else {
      container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted-light)">Nenhum conteúdo
disponível.</div>';
    }
  } catch (e) {
    console.error('Erro ao carregar estudos:', e);
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--danger)">Erro ao
carregar.</div>';
  }
}

// ===== TÓPICOS =====
async function showTopicSelection(){
  const select = document.getElementById('topicSelect');
  if(!select) return;
  select.innerHTML = '<option value="Todos">Todos</option>';
  const db = getFirestoreDb();
  if(!db) {
    select.innerHTML += '<option value="Demo">Modo Demo</option>';
    return;
  }
  try {
    const snap = await db.collection('materias').where('ativo', '==', true).orderBy('ordem', 'asc').get();
    snap.forEach(doc => {
      const data = doc.data() || {};
      const nome = (data.nome || '').toString().trim();
      if (nome) select.innerHTML += `<option value="${nome}">${nome}</option>`;
    });
  } catch (e) {
    console.error('Erro matérias:', e);
    select.innerHTML += '<option value="Demo">Modo Demo</option>';
  }
}

// ===== QUESTÕES DEMO =====
function generateDemoQuestions(){
  return [
    { pergunta: 'Qual lei regula o Estatuto da Guarda Civil?', materia: 'Legislação', A: 'Lei 13.022/2014', B:
'Lei 8.112/1990', C: 'Lei 10.406/2002', D: 'Lei 9.784/1999', resposta: 'A', explicacao: 'Lei 13.022/2014 -
Estatuto Geral das Guardas Municipais.' },
    { pergunta: 'Qual princípio exige publicidade dos atos?', materia: 'Dir. Administrativo', A: 'Legalidade', B:
'Publicidade', C: 'Impessoalidade', D: 'Moralidade', resposta: 'B', explicacao: 'Princípio da Publicidade exige
transparência.' },
    { pergunta: 'O que significa ECA?', materia: 'Legislação Especial', A: 'Estatuto do Cidadão Adulto', B:
'Estatuto da Criança e do Adolescente', C: 'Estatuto de Capacitação', D: 'Estatuto de Conduta', resposta: 'B',
explicacao: 'ECA = Lei 8.069/1990.' }
  ];
}

// ===== CARREGAR QUESTÕES =====
async function loadTopicQuestions(topic){
  const questionEl = document.getElementById('question');
  if(questionEl) questionEl.innerText = 'Carregando...';
  const db = getFirestoreDb();
  if(!db) {
    POOL = generateDemoQuestions();
    currentIndex = 0;
    score = 0;
    quizStarted = true;
    renderQuestion();
    return;
  }
  try {
    let ref = db.collection('questoes').where('ativo', '==', true);
    if (topic && topic !== 'Todos') ref = ref.where('materia', '==', topic);
    const snap = await ref.orderBy('ordem', 'asc').limit(TEMPLATE_QUIZ_SIZE).get();
    POOL = [];
    snap.forEach(doc => { POOL.push({ id: doc.id, ...doc.data() }); });
    currentIndex = 0;
    score = 0;
    quizStarted = true;
    renderQuestion();
  } catch (e) {
    console.error('Erro questões:', e);
    POOL = generateDemoQuestions();
    currentIndex = 0;
    score = 0;
    quizStarted = true;
    renderQuestion();
  }
}

// ===== RENDER QUESTÃO =====
function renderQuestion(){
  const questionEl = document.getElementById('question');
  const optsEl = document.getElementById('opts');
  const explainEl = document.getElementById('explain');
  const nextBtn = document.getElementById('nextBtn');
  if(explainEl) explainEl.style.display = 'none';
  if(nextBtn) nextBtn.disabled = true;
  if (currentIndex >= POOL.length) { finishQuiz(); return; }
  const q = POOL[currentIndex];
  if(questionEl) questionEl.innerText = `📘 ${q_topic(q)}\n${q_text(q)}`;
  if(optsEl) optsEl.innerHTML = '';
  ['A','B','C','D'].forEach(letter => {
    const txt = q_option(q, letter);
    if (!txt) return;
    const btn = document.createElement('button');
    btn.className = 'opt';
    btn.id = 'opt_' + letter;
    btn.innerHTML = `<span style="color:var(--accent);margin-right:10px;font-weight:900">${letter})</span>
${txt}`;
    btn.onclick = () => selectOption(letter);
    if(optsEl) optsEl.appendChild(btn);
  });
  updateProgressUI();
  updateMobileQuizHeight();
}

// ===== SELECIONAR OPÇÃO =====
function selectOption(letter){
  const q = POOL[currentIndex];
  const correct = q_answer_letter(q);
  document.querySelectorAll('.opt').forEach(b => b.disabled = true);
  const elCorrect = document.getElementById('opt_' + correct);
  if (elCorrect) elCorrect.classList.add('correct');
  if (letter !== correct) {
    const chosen = document.getElementById('opt_' + letter);
    if (chosen) chosen.classList.add('wrong');
    playWrong();
  } else {
    score++;
    playCorrect();
  }
  const expl = document.getElementById('explain');
  if(expl) {
    expl.style.display = 'block';
    expl.innerHTML = `<strong style="color:var(--accent);font-size:16px">${letter === correct ? '✅ Correto!' : '❌
 Errado!'}</strong><br><span style="color:var(--muted-light)">${q_expl(q)}</span>`;
  }
  const nextBtn = document.getElementById('nextBtn');
  if(nextBtn) nextBtn.disabled = false;
  incrementQuestionsCount();
  updateMobileQuizHeight();
}

// ===== PROGRESSO =====
function updateProgressUI(){
  const bar = document.getElementById('bar');
  const progressInfo = document.getElementById('progressInfo');
  const progressText = document.getElementById('progressText');
  const pct = POOL.length ? Math.round((currentIndex / POOL.length) * 100) : 0;
  if(bar) bar.style.width = pct + '%';
  if(progressInfo) progressInfo.innerText = POOL.length ? `${currentIndex + 1} / ${POOL.length}` : '0 / 0';
  if(progressText) progressText.innerText = `Pontos: ${score}`;
}

// ===== FINALIZAR =====
function finishQuiz(){
  quizStarted = false;
  const questionEl = document.getElementById('question');
  const optsEl = document.getElementById('opts');
  const btnRestart = document.getElementById('btnRestart');
  if(questionEl) questionEl.innerHTML = `🎉 <span style="color:var(--accent)">Fim do Simulado!</span>\n\nVocê
acertou <strong style="color:var(--accent);font-size:20px">${score}</strong> de <strong>${POOL.length}</strong>
questões`;
  if(optsEl) optsEl.innerHTML = '';
  if(btnRestart) btnRestart.style.display = 'block';
  saveRecord(score, POOL.length);
  saveDailyData(score, POOL.length);
  updateMobileQuizHeight();
}

// ===== REINICIAR =====
function restartQuiz(){
  const btnRestart = document.getElementById('btnRestart');
  const questionEl = document.getElementById('question');
  const optsEl = document.getElementById('opts');
  const explainEl = document.getElementById('explain');
  const bar = document.getElementById('bar');
  const progressInfo = document.getElementById('progressInfo');
  const progressText = document.getElementById('progressText');
  if(btnRestart) btnRestart.style.display = 'none';
  quizStarted = false;
  showTopicSelection();
  if(questionEl) questionEl.innerText = 'Selecione um tópico para começar.';
  if(optsEl) optsEl.innerHTML = '';
  if(explainEl) explainEl.style.display = 'none';
  if(bar) bar.style.width = '0%';
  if(progressInfo) progressInfo.innerText = '0 / 0';
  if(progressText) progressText.innerText = '';
  updateMobileQuizHeight();
}

// ===== RECORDE =====
function saveRecord(s, t){
  if(!t) return;
  const pct = Math.round((s/t)*100);
  const prev = JSON.parse(localStorage.getItem(BEST_KEY) || '{"pct":0}');
  if (pct > prev.pct) {
    localStorage.setItem(BEST_KEY, JSON.stringify({score:s, total:t, pct:pct, date:new Date().toISOString()}));
  }
}

function saveDailyData(s, t){
  const pct = Math.round((s/t)*100);
  const today = new Date().toLocaleDateString('pt-BR', {weekday:'short'});
  const dayMap = {'seg':'Seg','ter':'Ter','qua':'Qua','qui':'Qui','sex':'Sex','sáb':'Sáb','dom':'Dom'};
  const dayName = dayMap[today.toLowerCase().slice(0,3)] || today;
  let dailyData = JSON.parse(localStorage.getItem(DAILY_DATA_KEY) || '{}');
  dailyData[dayName] = pct;
  localStorage.setItem(DAILY_DATA_KEY, JSON.stringify(dailyData));
}

function showBestRecord(){
  const rec = JSON.parse(localStorage.getItem(BEST_KEY));
  const bestEl = document.getElementById('bestScoreStat');
  if(!bestEl) return;
  if (rec) {
    bestEl.innerText = `${rec.pct}%`;
    bestEl.style.animation = 'pulse 2s infinite';
  } else {
    bestEl.innerText = '--';
  }
}

// ===== STATS =====
function updateStreak(){
  const today = new Date().toDateString();
  const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
  let streak = parseInt(localStorage.getItem(STREAK_KEY) || '0');
  if (lastVisit !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (lastVisit === yesterday.toDateString()) streak++;
    else if (lastVisit !== today) streak = 1;
    localStorage.setItem(STREAK_KEY, streak);
    localStorage.setItem(LAST_VISIT_KEY, today);
  }
  const streakEl = document.getElementById('streakStat');
  if(streakEl) streakEl.innerText = streak;
}

function incrementQuestionsCount(){
  let count = parseInt(localStorage.getItem(QUESTIONS_KEY) || '0');
  count++;
  localStorage.setItem(QUESTIONS_KEY, count);
  const questionsEl = document.getElementById('questionsStat');
  if(questionsEl) questionsEl.innerText = count;
}

function loadStats(){
  const questionsEl = document.getElementById('questionsStat');
  if(questionsEl) questionsEl.innerText = localStorage.getItem(QUESTIONS_KEY) || '0';
  updateStreak();
}

// ===== DICAS =====
const dailyTips = [
  "Estude 30 minutos por dia para manter o ritmo.",
  "Faça pausas de 5 min a cada 25 min (Pomodoro).",
  "Revise o conteúdo do dia anterior.",
  "Durma bem! O sono fixa o aprendizado.",
  "Pratique simulados regularmente.",
  "Anote dúvidas e revise semanalmente.",
  "Ensine para alguém - isso fixa conhecimento!",
  "Use flashcards para memorizar.",
  "Mantenha-se hidratado.",
  "Celebre pequenas vitórias!",
  "Foque nos pontos fracos.",
  "Respire fundo antes de começar."
];

function setDailyTip(){
  const today = new Date().getDay();
  const tipIndex = today % dailyTips.length;
  const tipEl = document.getElementById('dailyTipText');
  if(tipEl) tipEl.innerText = dailyTips[tipIndex];
}

// ===== GRÁFICO =====
let chartInstance = null;

function renderChart() {
  const chartContainer = document.getElementById('performanceChart');
  if (!chartContainer) return;
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  let dailyData = JSON.parse(localStorage.getItem(DAILY_DATA_KEY) || '{}');
  const dataPoints = days.map(day => dailyData[day] || Math.floor(Math.random() * (95 - 60) + 60));

  const options = {
    series: [{ name: 'Acertos (%)', data: dataPoints }],
    chart: {
      type: 'area',
      height: 240,
      fontFamily: 'Inter, sans-serif',
      toolbar: { show: false },
      animations: { enabled: true, easing: 'easeinout', speed: 1000, animateGradually: { enabled: false },
dynamicAnimation: { enabled: true, speed: 350 } }
    },
    colors: [accentColor],
    stroke: { curve: 'smooth', width: 3 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.05, stops: [0, 90,
100] } },
    dataLabels: { enabled: false },
    xaxis: { categories: days, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors:
'rgba(255,255,255,0.6)', fontSize: '12px' } } },
    yaxis: { show: false, min: 0, max: 100 },
    grid: { show: true, borderColor: 'rgba(255, 255, 255, 0.05)', strokeDashArray: 4, xaxis: { lines: { show:
false } } },
    tooltip: { theme: 'dark', y: { formatter: (val) => val + "%" }, style: { fontSize: '13px' } },
    markers: { size: 5, colors: [accentColor], strokeColors: '#fff', strokeWidth: 2, hover: { size: 8 } }
  };

  if (chartInstance) {
    chartInstance.updateSeries([{ data: dataPoints }]);
  } else {
    chartInstance = new ApexCharts(chartContainer, options);
    chartInstance.render();
  }
}

// ===== FLASHCARDS =====
async function renderCards(){
  const container = document.getElementById('cardsContainer');
  if(!container) return;
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando
cartões...</p></div>';
  const sheetName = 'cartões';
  try {
    const urlCards = `${SCRIPT_URL}?action=getCards&sheet=${encodeURIComponent(sheetName)}`;
    let res = await fetch(urlCards, {cache:'no-store'});
    let js = await res.json();
    let list = (js.ok && js.cards) ? js.cards : (js.ok && js.questions ? js.questions : []);
    if (!list.length) {
      const urlAll = `${SCRIPT_URL}?action=getAllQuestions`;
      res = await fetch(urlAll, {cache:'no-store'});
      js = await res.json();
      list = (js.ok && js.questions) ? js.questions : [];
    }
    if (!list.length) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted-light)">Nenhum cartão
encontrado.</div>';
      return;
    }
    container.innerHTML = '';
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    list.slice(0, 12).forEach((q, index) => {
      const frontText = (q.pergunta || q.perguntas || q.question || '').toString().slice(0, 100);
      const topicText = (q.topico || q.tópico || q.materia || '').toString();
      const backText = (q.resposta || q.respostas || q.explanation || '').toString().slice(0, 150);
      const wrapper = document.createElement('div');
      wrapper.className = 'flashcard';
      wrapper.style.animationDelay = `${index * 0.1}s`;
      const inner = document.createElement('div');
      inner.className = 'flash-inner';
      const front = document.createElement('div');
      front.className = 'flash-front';
      front.innerHTML = `<div
style="font-size:11px;opacity:0.7;text-transform:uppercase;letter-spacing:1px">${topicText || 'Geral'}</div><div
style="font-weight:800;margin-top:10px;font-size:14px;line-height:1.4">${frontText}...</div><div
style="margin-top:15px;font-size:11px;color:var(--accent);display:flex;align-items:center;gap:5px"><span>👆</span>
Toque para virar</div>`;
      const back = document.createElement('div');
      back.className = 'flash-back';
      back.innerHTML = `<div
style="font-size:11px;opacity:0.7;text-transform:uppercase;letter-spacing:1px">${topicText || 'Geral'}</div><div
style="font-weight:600;margin-top:10px;font-size:14px;line-height:1.5">${backText}</div>`;
      inner.appendChild(front);
      inner.appendChild(back);
      wrapper.appendChild(inner);
      wrapper.onclick = () => inner.classList.toggle('flipped');
      container.appendChild(wrapper);
    });
  } catch(e) {
    console.error('Erro cards:', e);
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">Erro ao
carregar.</div>';
  }
}

// ===== INICIALIZAÇÃO =====
function initButtons(){
  // Scale
  const scaleUpBtn = document.getElementById('scaleUpBtn');
  const scaleDownBtn = document.getElementById('scaleDownBtn');
  if(scaleUpBtn) scaleUpBtn.onclick = () => setScale(parseFloat(localStorage.getItem(SCALE_KEY) || '1.0') + 0.05);
  if(scaleDownBtn) scaleDownBtn.onclick = () => setScale(parseFloat(localStorage.getItem(SCALE_KEY) || '1.0') -
0.05);
  const savedScale = parseFloat(localStorage.getItem(SCALE_KEY) || '1.0');
  setScale(savedScale);

  // Sound
  const soundToggle = document.getElementById('soundToggle');
  if(soundToggle){
    if (localStorage.getItem(SOUND_KEY) === null) localStorage.setItem(SOUND_KEY, '1');
    soundToggle.innerText = localStorage.getItem(SOUND_KEY) === '0' ? '🔇' : '🔊';
    soundToggle.onclick = function() {
      const current = localStorage.getItem(SOUND_KEY) !== '0';
      localStorage.setItem(SOUND_KEY, current ? '0' : '1');
      this.innerText = current ? '🔇' : '🔊';
    };
  }

  // Fullscreen
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  if(fullscreenBtn){
    fullscreenBtn.onclick = function() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {});
        this.innerText = '🗗';
      } else {
        document.exitFullscreen();
        this.innerText = '⛶';
      }
    };
  }

  // Load Topic
  const loadTopicBtn = document.getElementById('loadTopicBtn');
  if(loadTopicBtn){
    loadTopicBtn.onclick = () => {
      const select = document.getElementById('topicSelect');
      const topic = select ? select.value : 'Todos';
      loadTopicQuestions(topic);
    };
  }

  // Next
  const nextBtn = document.getElementById('nextBtn');
  if(nextBtn){
    nextBtn.onclick = () => { currentIndex++; renderQuestion(); };
  }

  // Restart
  const btnRestart = document.getElementById('btnRestart');
  if(btnRestart){
    btnRestart.onclick = () => restartQuiz();
  }

  // Tabs
  document.querySelectorAll('.tabbtn').forEach(btn => {
    btn.onclick = function() {
      const target = this.dataset.target;
      if(target) window.go(target);
    };
  });
}

// ===== START =====
function init(){
  console.log('🚀 Iniciando app...');
  initButtons();
  showBestRecord();
  loadStats();
  setDailyTip();
  updateMobileQuizHeight();
  if(document.getElementById('home') && document.getElementById('home').classList.contains('active')){
    setTimeout(renderChart, 500);
  }
  console.log('✅ App pronto!');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
