const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx64clSmoa7ymBZls8osmpp6PuwCyqHJ0bcOBz9NI0PqBM_tHr8Px_lGdQEr_9INdMB3g/exec';
const TEMPLATE_QUIZ_SIZE = 20;
let POOL = []; let currentIndex = 0; let score = 0; let quizStarted = false;
let isGrandeDia = false; let grandeDiaInterval = null;
const SOUND_KEY = 'quiz_sound_on'; const SCALE_KEY = 'quiz_card_scale'; const BEST_KEY = 'quiz_best_record';
const XP_KEY = 'quiz_xp'; const STREAK_KEY = 'quiz_streak'; const LAST_DATE_KEY = 'quiz_last_date';

function checkStreak() {
  let streak = parseInt(localStorage.getItem(STREAK_KEY) || '0');
  let lastDate = localStorage.getItem(LAST_DATE_KEY);
  const todayStr = new Date().toISOString().split('T')[0];
  if (lastDate) {
    const diffDays = Math.floor(Math.abs(new Date(todayStr) - new Date(lastDate)) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) { streak = 0; localStorage.setItem(STREAK_KEY, streak); }
  }
  const el = document.getElementById('streakValue');
  if(el) el.innerText = `${streak} Dia${streak!==1?'s':''}`;
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
  }
  const el = document.getElementById('streakValue');
  if(el) el.innerText = `${streak} Dia${streak!==1?'s':''}`;
}

function getRankName(xp) {
  if(xp < 100) return 'Recruta';
  if(xp < 500) return 'Soldado';
  if(xp < 1500) return 'Cabo';
  if(xp < 3000) return 'Sargento';
  if(xp < 6000) return 'Tenente';
  if(xp < 10000) return 'Capitão';
  return 'Comandante';
}

function updateXPUI() {
  const xp = parseInt(localStorage.getItem(XP_KEY) || '0');
  const elXP = document.getElementById('xpValue');
  const elRank = document.getElementById('rankValue');
  if(elXP) elXP.innerText = xp;
  if(elRank) elRank.innerText = getRankName(xp);
}

function addXP(amount) {
  let xp = parseInt(localStorage.getItem(XP_KEY) || '0');
  xp += amount;
  localStorage.setItem(XP_KEY, xp);
  updateXPUI();
}

function q_text(q){ return q.pergunta || q.perguntas || q.question || ''; }
function q_topic(q){ return q.materia || q.topico || q.tópico || q.topic || ''; }
function q_expl(q){ return q.explicacao || q.explicação || q.explanation || ''; }
function q_answer_letter(q){ const a = (q.resposta || q.answer || '').toString().trim(); return a.substr(0,1).toUpperCase(); }
function q_option(q, letter){ return q[letter.toUpperCase()] || q[letter.toLowerCase()] || ''; }

function getFirestoreDb(){
  if (window.firebase && firebase.firestore) return firebase.firestore();
  throw new Error('Firebase Firestore não está disponível no front.');
}

function isMobile(){ return window.matchMedia && window.matchMedia('(max-width: 600px)').matches; }

function setScale(v){
  if(isMobile()) return;
  v = Math.max(0.8, Math.min(1.4, Number(v)));
  document.getElementById('appRoot').style.transform = `scale(${v.toFixed(2)})`;
  document.getElementById('appRoot').style.transformOrigin = 'top center';
  const label = document.getElementById('scaleLabel');
  if(label) label.innerText = v.toFixed(2) + 'x';
  localStorage.setItem(SCALE_KEY, v.toFixed(2));
}
document.getElementById('scaleUpBtn').onclick = () => setScale(parseFloat(localStorage.getItem(SCALE_KEY) || 1.0) + 0.05);
document.getElementById('scaleDownBtn').onclick = () => setScale(parseFloat(localStorage.getItem(SCALE_KEY) || 1.0) - 0.05);
if(!isMobile()) setScale(parseFloat(localStorage.getItem(SCALE_KEY) || 1.0));

let audioCtx = null;
function ensureAudio(){ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playTone(freq, dur=120, type='sine', gainVal=0.06){
  if (localStorage.getItem(SOUND_KEY) === '0') return;
  try{
    ensureAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = gainVal;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); setTimeout(()=>{ o.stop(); o.disconnect(); g.disconnect(); }, dur);
  }catch(e){}
}
function playCorrect(){
  playTone(880,120,'sine',0.06);
  if(navigator.vibrate) navigator.vibrate([50]); 
}
function playWrong(){
  playTone(220,220,'sawtooth',0.08);
  if(navigator.vibrate) navigator.vibrate([100, 50, 100]); // Vibrar quando erra
}

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

window.go = function(target){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(target).classList.add('active');
  document.querySelectorAll('.tabbtn').forEach(b => b.classList.toggle('active', b.dataset.target === target));
  
  if(target === 'quiz' && quizStarted) document.body.classList.add('quiz-focus');
  else document.body.classList.remove('quiz-focus');

  window.scrollTo({top: 0, behavior: 'smooth'});
  if (target === 'home') {
    showBestRecord();
  }
  if (target === 'dashboard') {
    if(typeof renderBadges === 'function') renderBadges();
    if(typeof renderStatsChart === 'function') renderStatsChart();
  }
  checkStreak();
  updateXPUI();
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
    if (js.ok && js.studies && js.studies.length){
      container.innerHTML = '';
      js.studies.forEach(s => {
        const d = document.createElement('details'); d.className = 'summary';
        d.innerHTML = `<summary>${s.topico || 'Tópico'}</summary><div class="study-content">${linkify(s.conteudo || '')}</div>`;
        container.appendChild(d);
      });
    } else {
      container.innerHTML = '<div style="text-align:center; padding:20px;"><i class="ph ph-empty"></i><br>Nenhum conteúdo.</div>';
    }
  } catch (e) { container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--danger)">Erro.</div>'; }
}

async function showTopicSelection(){
  try {
    const motivacionais = [
      "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
      "A persistência é o caminho do êxito.",
      "Estude com dedicação e verá os resultados.",
      "Não pare até se orgulhar.",
      "A dor de estudar é passageira, mas a glória da aprovação é eterna.",
      "Seu futuro é criado pelo que você faz hoje, não amanhã.",
      "Foco, força e fé rumo à aprovação a Guarda Civil!",
      "Cada questão resolvida é um passo a mais para sua posse."
    ];
    const motivacionalEl = document.getElementById('motivationalText');
    if (motivacionalEl) {
      motivacionalEl.innerText = motivacionais[Math.floor(Math.random() * motivacionais.length)];
    }

    const snap = await getFirestoreDb().collection('materias').where('ativo', '==', true).orderBy('ordem', 'asc').get();
    const select = document.getElementById('topicSelect');
    select.innerHTML = '<option value="Todos">Todas as Matérias</option>';
    snap.forEach(doc => {
      const nome = (doc.data().nome || '').toString().trim();
      if (nome) select.innerHTML += `<option value="${nome}">${nome}</option>`;
    });
  } catch (e) {}
}

async function loadTopicQuestions(topic){
  isGrandeDia = false;
  if(grandeDiaInterval) { clearInterval(grandeDiaInterval); grandeDiaInterval = null; }
  document.getElementById('quizTimerContainer').style.display = 'none';
  document.getElementById('quizSetup').style.display = 'none';
  document.getElementById('quizActive').style.display = 'flex';
  document.body.classList.add('quiz-focus');
  document.getElementById('question').innerHTML = '<div class="empty-state"><i class="ph ph-spinner-gap ph-spin"></i><p>Preparando...</p></div>';
  
  try {
    let ref = getFirestoreDb().collection('questoes').where('ativo', '==', true);
    if (topic && topic !== 'Todos') ref = ref.where('materia', '==', topic);
    
    // Busca as questões sem limitar inicialmente para permitir sorteio
    const snap = await ref.get();
    
    let allQuestions = [];
    snap.forEach(doc => allQuestions.push({ id: doc.id, ...doc.data() }));
    
    // Embaralha as questões (sorteio aleatório)
    for (let i = allQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }
    
    // Seleciona a quantidade definida para o simulado
    POOL = allQuestions.slice(0, TEMPLATE_QUIZ_SIZE);
    
    currentIndex = 0; score = 0; quizStarted = true;
    renderQuestion();
  } catch (e) {
    POOL = []; currentIndex = 0; score = 0; quizStarted = true; renderQuestion();
  }
}
document.getElementById('loadTopicBtn').onclick = () => loadTopicQuestions(document.getElementById('topicSelect').value);

function renderQuestion(){
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
    btn.className = 'opt'; btn.id = 'opt_' + letter;
    btn.innerHTML = `<span style="font-weight:800; color:var(--primary); min-width:24px;">${letter})</span> <span>${txt}</span>`;
    btn.onclick = () => selectOption(letter);
    opts.appendChild(btn);
  });

  const pct = POOL.length ? Math.round((currentIndex / POOL.length) * 100) : 0;
  document.getElementById('bar').style.width = pct + '%';
  document.getElementById('progressInfo').innerText = POOL.length ? `${currentIndex + 1} / ${POOL.length}` : '0 / 0';
  document.getElementById('progressText').innerText = `Pontos: ${score}`;
  
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
  
  document.getElementById('explainBody').innerHTML = `
    <div style="color:${colorClass}; font-size: 24px; font-weight:800; display:flex; align-items:center; gap:8px; margin-bottom: 12px;">${iconHtml}</div>
    <div style="font-size:15px; color:var(--text-main); line-height:1.6;">${q_expl(q) || 'Nenhuma explicação técnica fornecida para esta questão.'}</div>
  `;
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
  showTopicSelection();
}

function finishQuiz(){
  quizStarted = false;
  if(grandeDiaInterval) { clearInterval(grandeDiaInterval); grandeDiaInterval = null; }
  document.getElementById('quizTimerContainer').style.display = 'none';

  document.getElementById('question').innerHTML = `
    <div class="finish-title">
      <i class="ph-fill ph-check-circle"></i> Fim! Você acertou ${score} de ${POOL.length}
    </div>
  `;
  document.getElementById('opts').innerHTML = '';
  document.getElementById('btnRestart').style.display = 'block';
  document.getElementById('btnQuit').style.display = 'none';
  saveRecord(score, POOL.length);
  checkBadges(score, POOL.length);
}

function saveRecord(s, t){
  if(!t) return;
  const pct = Math.round((s/t)*100);
  const prev = JSON.parse(localStorage.getItem(BEST_KEY) || '{"pct":-1}');
  
  registerStudyDay();
  addXP(s * 10); // 10 XP por acerto
  
  if (pct > prev.pct) {
    localStorage.setItem(BEST_KEY, JSON.stringify({score:s, total:t, pct:pct}));
    if(window.confetti && pct > 0) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#10B981', '#3B82F6', '#F59E0B', '#ffffff'] });
    }
  }
}

function showBestRecord(){
  const rec = JSON.parse(localStorage.getItem(BEST_KEY));
  document.getElementById('bestRecord').innerHTML = rec 
    ? `<i class="ph-fill ph-trophy"></i> Recorde: ${rec.score}/${rec.total} (${rec.pct}%)` 
    : '<i class="ph ph-rocket"></i> Faça seu primeiro simulado.';
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

window.swipeFlashcardLeft = function() {
  const container = document.getElementById('cardsList');
  const cards = Array.from(container.querySelectorAll('.flashcard'));
  if (cards.length > 0 && cards[0]) {
     const elTop = cards[0];
     elTop.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
     elTop.style.transform = `translate(-${window.innerWidth}px, 0) rotate(-30deg)`;
     elTop.style.opacity = '0';
     setTimeout(() => { elTop.remove(); setupTinderSwipe(); }, 400);
  }
}

window.swipeFlashcardRight = function() {
  const container = document.getElementById('cardsList');
  const cards = Array.from(container.querySelectorAll('.flashcard'));
  if (cards.length > 0 && cards[0]) {
     const elTop = cards[0];
     elTop.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
     elTop.style.transform = `translate(${window.innerWidth}px, 0) rotate(30deg)`;
     elTop.style.opacity = '0';
     setTimeout(() => { elTop.remove(); setupTinderSwipe(); }, 400);
  }
}

/* --- NOVAS FUNCIONALIDADES: O Grande Dia --- */
window.startGrandeDia = async function() {
  document.getElementById('quizSetup').style.display = 'none';
  document.getElementById('quizActive').style.display = 'flex';
  document.getElementById('quizTimerContainer').style.display = 'flex';
  document.body.classList.add('quiz-focus');
  document.getElementById('question').innerHTML = '<div class="empty-state"><i class="ph ph-spinner-gap ph-spin"></i><p>Preparando O Grande Dia...</p></div>';
  
  try {
    const snap = await getFirestoreDb().collection('questoes').where('ativo', '==', true).get();
    let allQ = [];
    snap.forEach(doc => allQ.push({ id: doc.id, ...doc.data() }));
    // Sorteio
    for(let i=allQ.length-1; i>0; i--){ const j=Math.floor(Math.random()*(i+1)); [allQ[i],allQ[j]]=[allQ[j],allQ[i]]; }
    POOL = allQ.slice(0, 60); // 60 Questões
    
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
  display.style.color = 'var(--danger)'; // Reset color
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
const BADGES_LIST = [
  { id: 'first_blood', name: 'Iniciante', icon: 'ph-footprints' },
  { id: 'streak_3', name: 'Focado', icon: 'ph-fire' },
  { id: 'streak_7', name: 'Maratonista', icon: 'ph-sneaker' },
  { id: 'mestre', name: 'Mestre GCM', icon: 'ph-crown' },
  { id: 'grande_dia', name: 'Aprovado', icon: 'ph-star' }
];

function checkBadges(scoreVal, totalVal) {
  let unlocked = JSON.parse(localStorage.getItem('quiz_unlocked_badges') || '[]');
  let newlyUnlocked = false;
  
  const addBadge = (id) => { if(!unlocked.includes(id)) { unlocked.push(id); newlyUnlocked = true; } };
  
  if (totalVal > 0) addBadge('first_blood');
  
  const streak = parseInt(localStorage.getItem(STREAK_KEY) || '0');
  if (streak >= 3) addBadge('streak_3');
  if (streak >= 7) addBadge('streak_7');
  
  const xp = parseInt(localStorage.getItem(XP_KEY) || '0');
  if (xp >= 3000) addBadge('mestre');
  
  // Condição para badge O Grande Dia (+80% acertos)
  if (isGrandeDia && totalVal >= 60 && (scoreVal / totalVal) >= 0.8) {
    addBadge('grande_dia');
  }
  
  if (newlyUnlocked) {
    localStorage.setItem('quiz_unlocked_badges', JSON.stringify(unlocked));
    if (typeof renderBadges === 'function') renderBadges();
  }
}

window.renderBadges = function() {
  const container = document.getElementById('badgesGrid');
  if(!container) return;
  const unlocked = JSON.parse(localStorage.getItem('quiz_unlocked_badges') || '[]');
  
  container.innerHTML = '';
  BADGES_LIST.forEach(b => {
    const isUnlocked = unlocked.includes(b.id);
    container.innerHTML += `
      <div class="badge-item ${isUnlocked ? 'unlocked' : ''}">
        <div class="badge-icon"><i class="ph-fill ${b.icon}"></i></div>
        <div class="badge-name">${b.name}</div>
      </div>
    `;
  });
}

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

showBestRecord();
checkStreak();
updateXPUI();
if (typeof renderBadges === 'function') renderBadges();
if (typeof renderStatsChart === 'function') renderStatsChart();
