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

// ===== HELPERS =====
function q_text(q){ return q.pergunta || q.perguntas || q.question || ''; }
function q_topic(q){ return q.materia || q.topico || q.tópico || q.topic || ''; }
function q_expl(q){ return q.explicacao || q.explicação || q.explanation || ''; }
function q_answer_letter(q){ const a = (q.resposta || q.answer || '').toString().trim(); return
a.substr(0,1).toUpperCase(); }
function q_option(q, letter){ return q[letter.toUpperCase()] || q[letter.toLowerCase()] || ''; }

// ===== FIRESTORE =====
function getFirestoreDb(){
  if (window.firebase && firebase.firestore) {
    return firebase.firestore();
  }
  throw new Error('Firebase Firestore não está disponível no front.');
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

// ===== SCALE =====
function setScale(v){
  v = Math.max(0.8, Math.min(1.4, Number(v)));
  document.getElementById('appRoot').style.transform = `scale(${v.toFixed(2)})`;
  document.getElementById('appRoot').style.transformOrigin = 'top center';
  document.getElementById('scaleLabel').innerText = 'x' + v.toFixed(2);
  localStorage.setItem(SCALE_KEY, v.toFixed(2));
  updateMobileQuizHeight();
}

document.getElementById('scaleUpBtn').onclick = () => setScale(parseFloat(localStorage.getItem(SCALE_KEY) || 1.0)
+ 0.05);
document.getElementById('scaleDownBtn').onclick = () => setScale(parseFloat(localStorage.getItem(SCALE_KEY) ||
1.0) - 0.05);
setScale(parseFloat(localStorage.getItem(SCALE_KEY) || 1.0));

// ===== SOUND =====
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

function playCorrect(){ playTone(880,120,'sine',0.06); }
function playWrong(){ playTone(220,220,'sawtooth',0.08); }

document.getElementById('soundToggle').onclick = function() {
  const current = localStorage.getItem(SOUND_KEY) !== '0';
  localStorage.setItem(SOUND_KEY, current ? '0' : '1');
  this.innerText = current ? '🔇' : '🔊';
};

if (localStorage.getItem(SOUND_KEY) === null) localStorage.setItem(SOUND_KEY, '1');
document.getElementById('soundToggle').innerText = localStorage.getItem(SOUND_KEY) === '0' ? '🔇' : '🔊';

// ===== FULLSCREEN =====
document.getElementById('fullscreenBtn').onclick = function() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {});
    this.innerText = '🗗';
  } else {
    document.exitFullscreen();
    this.innerText = '⛶';
  }
};

// ===== STREAK SYSTEM =====
function updateStreak(){
  const today = new Date().toDateString();
  const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
  let streak = parseInt(localStorage.getItem(STREAK_KEY) || '0');

  if (lastVisit !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (lastVisit === yesterday.toDateString()) {
      streak++;
    } else if (lastVisit !== today) {
      streak = 1;
    }

    localStorage.setItem(STREAK_KEY, streak);
    localStorage.setItem(LAST_VISIT_KEY, today);
  }

  document.getElementById('streakStat').innerText = streak;
  return streak;
}

// ===== QUESTIONS COUNT =====
function incrementQuestionsCount(){
  let count = parseInt(localStorage.getItem(QUESTIONS_KEY) || '0');
  count++;
  localStorage.setItem(QUESTIONS_KEY, count);
  document.getElementById('questionsStat').innerText = count;
}

function loadStats(){
  document.getElementById('questionsStat').innerText = localStorage.getItem(QUESTIONS_KEY) || '0';
  updateStreak();
}

// ===== DAILY TIPS =====
const dailyTips = [
  "Estude 30 minutos por dia para manter o ritmo de aprendizado.",
  "Faça pausas de 5 minutos a cada 25 minutos de estudo (Técnica Pomodoro).",
  "Revise o conteúdo do dia anterior antes de começar novos tópicos.",
  "Durma bem! O sono é essencial para fixar o aprendizado.",
  "Pratique simulados regularmente para medir seu progresso.",
  "Anote suas dúvidas e revise-as semanalmente.",
  "Ensine o que aprendeu para alguém - isso fixa o conhecimento!",
  "Use flashcards para memorizar conceitos importantes.",
  "Mantenha-se hidratado durante os estudos.",
  "Celebre pequenas vitórias para manter a motivação!"
];

function setDailyTip(){
  const today = new Date().getDay();
  document.getElementById('dailyTipText').innerText = dailyTips[today] || dailyTips[0];
}

// ===== NAVIGATION =====
window.go = function(target){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(target).classList.add('active');
  document.querySelectorAll('.tabbtn').forEach(b => b.classList.toggle('active', b.dataset.target === target));

  applyQuizViewportMode(target === 'quiz');
  window.scrollTo({top: 0, behavior: 'smooth'});

  if (target === 'home') {
    showBestRecord();
    loadStats();
    setDailyTip();
    setTimeout(renderChart, 300);
  }
  if (target === 'study') renderStudies();
  if (target === 'cards') renderCards();
  if (target === 'quiz' && !quizStarted) showTopicSelection();
};

// ===== LINKIFY =====
function linkify(text) {
  const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  return text.replace(urlPattern, '<a href="$1" target="_blank">$1</a>');
}

// ===== STUDIES =====
async function renderStudies(){
  const container = document.getElementById('studyList');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando
conteúdos...</p></div>';

  try {
    const res = await fetch(`${SCRIPT_URL}?action=getStudies`);
    const js = await res.json();

    if (js.ok && js.studies){
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
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--danger)">Erro ao carregar
conteúdos.</div>';
  }
}

// ===== TOPIC SELECTION =====
async function showTopicSelection(){
  try {
    const db = getFirestoreDb();
    const snap = await db.collection('materias')
      .where('ativo', '==', true)
      .orderBy('ordem', 'asc')
      .get();

    const select = document.getElementById('topicSelect');
    select.innerHTML = '<option value="Todos">Todos</option>';

    snap.forEach(doc => {
      const data = doc.data() || {};
      const nome = (data.nome || '').toString().trim();
      if (nome) {
        select.innerHTML += `<option value="${nome}">${nome}</option>`;
      }
    });
  } catch (e) {
    console.error('Erro ao carregar matérias:', e);
  }
}

// ===== LOAD QUESTIONS =====
async function loadTopicQuestions(topic){
  document.getElementById('question').innerText = 'Carregando...';

  try {
    const db = getFirestoreDb();
    let ref = db.collection('questoes').where('ativo', '==', true);

    if (topic && topic !== 'Todos') {
      ref = ref.where('materia', '==', topic);
    }

    const snap = await ref.orderBy('ordem', 'asc').limit(TEMPLATE_QUIZ_SIZE).get();

    POOL = [];
    snap.forEach(doc => { POOL.push({ id: doc.id, ...doc.data() }); });

    currentIndex = 0;
    score = 0;
    quizStarted = true;
    renderQuestion();
  } catch (e) {
    console.error('Erro ao carregar questões:', e);
    POOL = [];
    currentIndex = 0;
    score = 0;
    quizStarted = true;
    renderQuestion();
  }
}

document.getElementById('loadTopicBtn').onclick = () =>
loadTopicQuestions(document.getElementById('topicSelect').value);

// ===== RENDER QUESTION =====
function renderQuestion(){
  document.getElementById('explain').style.display = 'none';
  document.getElementById('nextBtn').disabled = true;

  if (currentIndex >= POOL.length) { finishQuiz(); return; }

  const q = POOL[currentIndex];
  document.getElementById('question').innerText = `📘 ${q_topic(q)}\n${q_text(q)}`;

  const opts = document.getElementById('opts');
  opts.innerHTML = '';

  ['A','B','C','D'].forEach(letter => {
    const txt = q_option(q, letter);
    if (!txt) return;
    const btn = document.createElement('button');
    btn.className = 'opt';
    btn.id = 'opt_' + letter;
    btn.innerHTML = `<span style="color:var(--accent);margin-right:10px;font-weight:900">${letter})</span>
${txt}`;
    btn.onclick = () => selectOption(letter);
    opts.appendChild(btn);
  });

  updateProgressUI();
  updateMobileQuizHeight();
}

// ===== SELECT OPTION =====
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
  expl.style.display = 'block';
  expl.innerHTML = `<strong style="color:var(--accent);font-size:16px">${letter === correct ? '✅ Correto!' : '❌
Errado!'}</strong><br><span style="color:var(--muted-light)">${q_expl(q)}</span>`;

  document.getElementById('nextBtn').disabled = false;
  incrementQuestionsCount();
  updateMobileQuizHeight();
}

document.getElementById('nextBtn').onclick = () => { currentIndex++; renderQuestion(); };

// ===== PROGRESS UI =====
function updateProgressUI(){
  const pct = POOL.length ? Math.round((currentIndex / POOL.length) * 100) : 0;
  document.getElementById('bar').style.width = pct + '%';
  document.getElementById('progressInfo').innerText = POOL.length ? `${currentIndex + 1} / ${POOL.length}` : '0 /
0';
  document.getElementById('progressText').innerText = `Pontos: ${score}`;
}

// ===== FINISH QUIZ =====
function finishQuiz(){
  quizStarted = false;
  document.getElementById('question').innerHTML = `🎉 <span style="color:var(--accent)">Fim do
Simulado!</span>\n\nVocê acertou <strong style="color:var(--accent);font-size:20px">${score}</strong> de
<strong>${POOL.length}</strong> questões`;
  document.getElementById('opts').innerHTML = '';
  document.getElementById('btnRestart').style.display = 'block';

  saveRecord(score, POOL.length);
  saveDailyData(score, POOL.length);
  updateMobileQuizHeight();
}

// ===== RESTART =====
function restartQuiz(){
  document.getElementById('btnRestart').style.display = 'none';
  quizStarted = false;
  showTopicSelection();
  document.getElementById('question').innerText = 'Selecione um tópico para começar.';
  document.getElementById('opts').innerHTML = '';
  document.getElementById('explain').style.display = 'none';
  document.getElementById('bar').style.width = '0%';
  document.getElementById('progressInfo').innerText = '0 / 0';
  document.getElementById('progressText').innerText = '';
  updateMobileQuizHeight();
}

// ===== SAVE RECORD =====
function saveRecord(s, t){
  if(!t) return;
  const pct = Math.round((s/t)*100);
  const prev = JSON.parse(localStorage.getItem(BEST_KEY) || '{"pct":0}');

  if (pct > prev.pct) {
    localStorage.setItem(BEST_KEY, JSON.stringify({score:s, total:t, pct:pct, date:new Date().toISOString()}));
  }
}

// ===== SAVE DAILY DATA FOR CHART =====
function saveDailyData(s, t){
  const pct = Math.round((s/t)*100);
  const today = new Date().toLocaleDateString('pt-BR', {weekday:'short'});
  const dayMap = {'seg':'Seg','ter':'Ter','qua':'Qua','qui':'Qui','sex':'Sex','sáb':'Sáb','dom':'Dom'};
  const dayName = dayMap[today.toLowerCase().slice(0,3)] || today;

  let dailyData = JSON.parse(localStorage.getItem(DAILY_DATA_KEY) || '{}');
  dailyData[dayName] = pct;
  localStorage.setItem(DAILY_DATA_KEY, JSON.stringify(dailyData));
}

// ===== SHOW BEST RECORD =====
function showBestRecord(){
  const rec = JSON.parse(localStorage.getItem(BEST_KEY));
  const bestEl = document.getElementById('bestScoreStat');

  if (rec) {
    bestEl.innerText = `${rec.pct}%`;
    bestEl.style.animation = 'pulse 2s infinite';
  } else {
    bestEl.innerText = '--';
  }
}

// ===== CHART =====
let chartInstance = null;

function renderChart() {
  const chartContainer = document.getElementById('performanceChart');
  if (!chartContainer) return;

  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  // Carrega dados salvos ou gera aleatórios
  let dailyData = JSON.parse(localStorage.getItem(DAILY_DATA_KEY) || '{}');
  const dataPoints = days.map(day => dailyData[day] || Math.floor(Math.random() * (95 - 60) + 60));

  const options = {
    series: [{
      name: 'Acertos (%)',
      data: dataPoints
    }],
    chart: {
      type: 'area',
      height: 240,
      fontFamily: 'Inter, sans-serif',
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 1000,
        animateGradually: { enabled: false },
        dynamicAnimation: { enabled: true, speed: 350 }
      }
    },
    colors: [accentColor],
    stroke: {
      curve: 'smooth',
      width: 3
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.5,
        opacityTo: 0.05,
        stops: [0, 90, 100]
      }
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: days,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { colors: 'rgba(255,255,255,0.6)', fontSize: '12px' }
      }
    },
    yaxis: {
      show: false,
      min: 0,
      max: 100
    },
    grid: {
      show: true,
      borderColor: 'rgba(255, 255, 255, 0.05)',
      strokeDashArray: 4,
      xaxis: { lines: { show: false } }
    },
    tooltip: {
      theme: 'dark',
      y: { formatter: (val) => val + "%" },
      style: { fontSize: '13px' }
    },
    markers: {
      size: 5,
      colors: [accentColor],
      strokeColors: '#fff',
      strokeWidth: 2,
      hover: { size: 8 }
    }
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

    // Shuffle
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
      front.innerHTML = `
        <div style="font-size:11px;opacity:0.7;text-transform:uppercase;letter-spacing:1px">${topicText ||
'Geral'}</div>
        <div style="font-weight:800;margin-top:10px;font-size:14px;line-height:1.4">${frontText}...</div>
        <div style="margin-top:15px;font-size:11px;color:var(--accent);display:flex;align-items:center;gap:5px">
          <span>👆</span> Toque para virar
        </div>
      `;

      const back = document.createElement('div');
      back.className = 'flash-back';
      back.innerHTML = `
        <div style="font-size:11px;opacity:0.7;text-transform:uppercase;letter-spacing:1px">${topicText ||
'Geral'}</div>
        <div style="font-weight:600;margin-top:10px;font-size:14px;line-height:1.5">${backText}</div>
      `;

      inner.appendChild(front);
      inner.appendChild(back);
      wrapper.appendChild(inner);
      wrapper.onclick = () => inner.classList.toggle('flipped');
      container.appendChild(wrapper);
    });
  } catch(e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">Erro ao carregar
cartões.</div>';
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  showBestRecord();
  loadStats();
  setDailyTip();
  updateMobileQuizHeight();

  // Render chart if on home
  if(document.getElementById('home').classList.contains('active')){
    setTimeout(renderChart, 500);
  }
});
