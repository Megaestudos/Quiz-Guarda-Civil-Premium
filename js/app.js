const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx64clSmoa7ymBZls8osmpp6PuwCyqHJ0bcOBz9NI0PqBM_tHr8Px_lGdQEr_9INdMB3g/exec';
const TEMPLATE_QUIZ_SIZE = 20;
let POOL = []; let currentIndex = 0; let score = 0; let quizStarted = false;
const SOUND_KEY = 'quiz_sound_on'; const SCALE_KEY = 'quiz_card_scale'; const BEST_KEY = 'quiz_best_record';

function q_text(q){ return q.pergunta || q.perguntas || q.question || ''; }
function q_topic(q){ return q.materia || q.topico || q.tópico || q.topic || ''; }
function q_expl(q){ return q.explicacao || q.explicação || q.explanation || ''; }
function q_answer_letter(q){ const a = (q.resposta || q.answer || '').toString().trim(); return a.substr(0,1).toUpperCase(); }
function q_option(q, letter){ return q[letter.toUpperCase()] || q[letter.toLowerCase()] || ''; }

// ====== Firebase / Firestore (somente para o simulado) ======
function getFirestoreDb(){
  if (window.firebase && firebase.firestore) {
    return firebase.firestore();
  }
  throw new Error('Firebase Firestore não está disponível no front.');
}

// ====== Ajuste de altura do QUIZ no mobile (sem rolagem da página) ======
function isMobile(){ return window.matchMedia && window.matchMedia('(max-width: 600px)').matches; }

function updateMobileQuizHeight(){
  if(!isMobile()) return;

  const header = document.getElementById('cardHeader');
  const tabs = document.getElementById('tabsBar');

  const headerVisible = header && getComputedStyle(header).display !== 'none';
  const headerH = headerVisible ? Math.ceil(header.getBoundingClientRect().height) : 0;

  const tabsH = tabs ? Math.ceil(tabs.getBoundingClientRect().height + 20) : 86; // + respiro

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

    requestAnimationFrame(() => {
      updateMobileQuizHeight();
    });
  }else{
    document.body.classList.remove('lock-scroll');
    quizEl.classList.remove('quiz-viewport');
    updateMobileQuizHeight();
  }
}

window.addEventListener('resize', () => {
  updateMobileQuizHeight();
});

// ====== Scale ======
function setScale(v){
  if(isMobile()) return; // Ignora escala no mobile para evitar quebras visuais
  v = Math.max(0.8, Math.min(1.4, Number(v)));
  document.getElementById('appRoot').style.transform = `scale(${v.toFixed(2)})`;
  document.getElementById('appRoot').style.transformOrigin = 'top center';
  
  const label = document.getElementById('scaleLabel');
  if(label) label.innerText = v.toFixed(2) + 'x';
  
  localStorage.setItem(SCALE_KEY, v.toFixed(2));
  updateMobileQuizHeight();
}
document.getElementById('scaleUpBtn').onclick = () => setScale(parseFloat(localStorage.getItem(SCALE_KEY) || 1.0) + 0.05);
document.getElementById('scaleDownBtn').onclick = () => setScale(parseFloat(localStorage.getItem(SCALE_KEY) || 1.0) - 0.05);
if(!isMobile()) setScale(parseFloat(localStorage.getItem(SCALE_KEY) || 1.0));

// ====== Som ======
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

function updateSoundUI() {
  const isOff = localStorage.getItem(SOUND_KEY) === '0';
  const ic = document.getElementById('soundIcon');
  if(ic) ic.className = isOff ? 'ph ph-speaker-slash' : 'ph ph-speaker-high';
}
document.getElementById('soundToggle').onclick = function() {
  const currentOff = localStorage.getItem(SOUND_KEY) === '0';
  localStorage.setItem(SOUND_KEY, currentOff ? '1' : '0');
  updateSoundUI();
};
if (localStorage.getItem(SOUND_KEY) === null) localStorage.setItem(SOUND_KEY, '1');
updateSoundUI();

// ====== Navegação ======
window.go = function(target){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(target).classList.add('active');
  document.querySelectorAll('.tabbtn').forEach(b => b.classList.toggle('active', b.dataset.target === target));

  applyQuizViewportMode(target === 'quiz');

  window.scrollTo({top: 0, behavior: 'smooth'});
  if (target === 'home') showBestRecord();
  if (target === 'study') renderStudies();
  if (target === 'cards') renderCards();
  if (target === 'quiz' && !quizStarted) showTopicSelection();
};

function linkify(text) {
  const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  return text.replace(urlPattern, '<a href="$1" target="_blank">$1</a>');
}

async function renderStudies(){
  const container = document.getElementById('studyList');
  container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted)"><i class="ph ph-spinner-gap ph-spin" style="font-size:24px;"></i><br><br>Carregando conteúdos...</div>';
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getStudies`);
    const js = await res.json();
    if (js.ok && js.studies && js.studies.length > 0){
      container.innerHTML = '';
      js.studies.forEach(s => {
        const d = document.createElement('details'); d.className = 'summary';
        const content = linkify(s.conteudo || '');
        d.innerHTML = `<summary>${s.topico || 'Tópico'}</summary><div class="study-content">${content}</div>`;
        container.appendChild(d);
      });
    } else {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted)"><i class="ph ph-empty"></i><br>Nenhum conteúdo encontrado.</div>';
    }
  } catch (e) { container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--danger)"><i class="ph ph-warning"></i><br>Erro ao carregar conteúdos.</div>'; }
}

async function showTopicSelection(){
  try {
    const db = getFirestoreDb();
    const snap = await db.collection('materias')
      .where('ativo', '==', true)
      .orderBy('ordem', 'asc')
      .get();

    const select = document.getElementById('topicSelect');
    select.innerHTML = '<option value="Todos">Todas as Matérias</option>';

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

async function loadTopicQuestions(topic){
  document.getElementById('question').innerHTML = '<div class="empty-state"><i class="ph ph-spinner-gap ph-spin"></i><p>Carregando simulado...</p></div>';
  try {
    const db = getFirestoreDb();
    let ref = db.collection('questoes').where('ativo', '==', true);

    if (topic && topic !== 'Todos') {
      ref = ref.where('materia', '==', topic);
    }

    const snap = await ref.orderBy('ordem', 'asc').limit(TEMPLATE_QUIZ_SIZE).get();

    POOL = [];
    snap.forEach(doc => {
      POOL.push({ id: doc.id, ...doc.data() });
    });

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
document.getElementById('loadTopicBtn').onclick = () => loadTopicQuestions(document.getElementById('topicSelect').value);

function renderQuestion(){
  document.getElementById('explain').style.display = 'none';
  document.getElementById('explain').className = 'explain';
  document.getElementById('nextBtn').disabled = true;

  if (currentIndex >= POOL.length) { finishQuiz(); return; }
  const q = POOL[currentIndex];

  document.getElementById('question').innerHTML = `
    <div class="topic-tag"><i class="ph ph-bookmark-simple"></i> ${q_topic(q)}</div>
    <div class="q-text">${q_text(q)}</div>
  `;

  const opts = document.getElementById('opts');
  opts.innerHTML = '';
  ['A','B','C','D'].forEach(letter => {
    const txt = q_option(q, letter);
    if (!txt) return;
    const btn = document.createElement('button');
    btn.className = 'opt';
    btn.id = 'opt_' + letter;
    btn.innerHTML = `<span style="font-weight:700; color:var(--primary); min-width:24px;">${letter})</span> <span>${txt}</span>`;
    btn.onclick = () => selectOption(letter);
    opts.appendChild(btn);
  });

  updateProgressUI();
  updateMobileQuizHeight();
}

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
  expl.className = letter === correct ? 'explain c-right' : 'explain c-wrong';
  const iconHtml = letter === correct ? '<i class="ph-fill ph-check-circle"></i> Correto!' : '<i class="ph-fill ph-x-circle"></i> Errada!';
  
  expl.innerHTML = `<strong>${iconHtml}</strong><br><div style="margin-top:10px">${q_expl(q)}</div>`;
  
  document.getElementById('nextBtn').disabled = false;
  updateMobileQuizHeight();
}
document.getElementById('nextBtn').onclick = () => { currentIndex++; renderQuestion(); };

function updateProgressUI(){
  const pct = POOL.length ? Math.round((currentIndex / POOL.length) * 100) : 0;
  document.getElementById('bar').style.width = pct + '%';
  document.getElementById('progressInfo').innerText = POOL.length ? `${currentIndex + 1} / ${POOL.length}` : '0 / 0';
  document.getElementById('progressText').innerText = `Pontos: ${score}`;
}

function finishQuiz(){
  quizStarted = false;
  document.getElementById('question').innerHTML = `
    <div class="finish-title">
      <i class="ph-fill ph-check-circle"></i> Fim! Você acertou ${score} de ${POOL.length}
    </div>
  `;
  document.getElementById('opts').innerHTML = '';
  document.getElementById('btnRestart').style.display = 'block';
  saveRecord(score, POOL.length);
  updateMobileQuizHeight();
}

function restartQuiz(){
  document.getElementById('btnRestart').style.display = 'none';
  quizStarted = false;
  showTopicSelection();
  document.getElementById('question').innerHTML = `
    <div class="empty-state">
      <i class="ph ph-hand-pointing"></i>
      <p>Selecione um tópico para começar.</p>
    </div>
  `;
  document.getElementById('opts').innerHTML = '';
  document.getElementById('explain').style.display = 'none';
  document.getElementById('bar').style.width = '0%';
  document.getElementById('progressInfo').innerText = '0 / 0';
  document.getElementById('progressText').innerText = 'Pontos: 0';
  updateMobileQuizHeight();
}

function saveRecord(s, t){
  if(!t) return;
  const pct = Math.round((s/t)*100);
  const prev = JSON.parse(localStorage.getItem(BEST_KEY) || '{"pct":0}');
  if (pct > prev.pct) localStorage.setItem(BEST_KEY, JSON.stringify({score:s, total:t, pct:pct}));
}

function showBestRecord(){
  const rec = JSON.parse(localStorage.getItem(BEST_KEY));
  document.getElementById('bestRecord').innerHTML = rec 
    ? `<i class="ph-fill ph-trophy"></i> Melhor Ranking: ${rec.score}/${rec.total} (${rec.pct}%)` 
    : '<i class="ph ph-rocket"></i> Faça um simulado para ter um recorde.';
}

async function renderCards(){
  const container = document.getElementById('cardsContainer');
  container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); width: 100%;"><i class="ph ph-spinner-gap ph-spin" style="font-size:24px;"></i><br><br>Carregando flashcards...</div>';
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
      container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); width: 100%;"><i class="ph ph-empty"></i><br>Nenhum cartão encontrado.</div>';
      return;
    }

    container.innerHTML = '';
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }

    list.forEach(q => {
      const frontText = (q.pergunta || q.perguntas || q.question || q[Object.keys(q).find(k=>/perg/i.test(k))] || '').toString();
      const topicText = (q.topico || q.tópico || q.materia || q.topic || '').toString();
      const backText = (q.resposta || q.respostas || q.explanation || q.explicacao || q.answer || q[Object.keys(q).find(k=>/resp/i.test(k))] || '').toString();

      const wrapper = document.createElement('div'); wrapper.className = 'flashcard';
      const inner = document.createElement('div'); inner.className = 'flash-inner';
      const front = document.createElement('div'); front.className = 'flash-front';
      const back = document.createElement('div'); back.className = 'flash-back';

      front.innerHTML = `<div class="flash-topic">${topicText}</div><div class="flash-text">${frontText}</div><div class="flash-hint"><i class="ph-fill ph-hand-tap"></i> TOQUE PARA VER RESPOSTA</div>`;
      back.innerHTML = `<div class="flash-topic">${topicText}</div><div class="flash-text">${backText}</div>`;

      inner.appendChild(front); inner.appendChild(back);
      wrapper.appendChild(inner);
      wrapper.onclick = () => inner.classList.toggle('flipped');
      container.appendChild(wrapper);
    });
  } catch(e) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--danger); width:100%;"><i class="ph ph-warning"></i><br>Erro ao carregar flashcards.</div>';
  }
}

// Inicial
showBestRecord();
updateMobileQuizHeight();
