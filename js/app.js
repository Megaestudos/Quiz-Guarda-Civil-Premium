const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx64clSmoa7ymBZls8osmpp6PuwCyqHJ0bcOBz9NI0PqBM_tHr8Px_lGdQEr_9INdMB3g/exec';
  const TEMPLATE_QUIZ_SIZE = 20;
  let POOL = []; let currentIndex = 0; let score = 0; let quizStarted = false;
  const SOUND_KEY = 'quiz_sound_on'; const SCALE_KEY = 'quiz_card_scale'; const BEST_KEY = 'quiz_best_record';

  function q_text(q){ return q.pergunta || q.perguntas || q.question || ''; }
  function q_topic(q){ return q.materia || q.topico || q.tópico || q.topic || ''; }
  function q_expl(q){ return q.explicacao || q.explicação || q.explanation || ''; }
  function q_answer_letter(q){ const a = (q.resposta || q.answer || '').toString().trim(); return a.substr(0,1).toUpperCase(); }
  function q_option(q, letter){ return q[letter.toUpperCase()] || q[letter.toLowerCase()] || ''; }

  // ====== Ajuste de altura do QUIZ no mobile (sem rolagem da página) ======
  function isMobile(){ return window.matchMedia && window.matchMedia('(max-width: 600px)').matches; }

  function updateMobileQuizHeight(){
    if(!isMobile()) return;

    const header = document.getElementById('cardHeader');
    const tabs = document.getElementById('tabsBar');

    // Se estiver no modo quiz (header escondido), headerH vira 0
    const headerVisible = header && getComputedStyle(header).display !== 'none';
    const headerH = headerVisible ? Math.ceil(header.getBoundingClientRect().height) : 0;

    const tabsH = tabs ? Math.ceil(tabs.getBoundingClientRect().height + 20) : 86; // + respiro

    document.documentElement.style.setProperty('--header-h', headerH + 'px');
    document.documentElement.style.setProperty('--tabs-h', tabsH + 'px');

    // margem extra (cards/paddings)
    const extra = 26;
    const quizH = Math.max(360, Math.floor(window.innerHeight - headerH - tabsH - extra));
    document.documentElement.style.setProperty('--quiz-h', quizH + 'px');
  }

  function applyQuizViewportMode(on){
    const quizEl = document.getElementById('quiz');
    if(!quizEl) return;

    // (NOVO) classe que esconde o topo só no mobile e só no simulado
    document.body.classList.toggle('quiz-mode', !!on);

    if(isMobile() && on){
      document.body.classList.add('lock-scroll');
      quizEl.classList.add('quiz-viewport');

      // espera o CSS aplicar (header sumir) e recalcula altura certinho
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

  // ====== Scale (mantém) ======
  function setScale(v){
    v = Math.max(0.8, Math.min(1.4, Number(v)));
    document.getElementById('appRoot').style.transform = `scale(${v.toFixed(2)})`;
    document.getElementById('appRoot').style.transformOrigin = 'top center';
    document.getElementById('scaleLabel').innerText = 'x' + v.toFixed(2);
    localStorage.setItem(SCALE_KEY, v.toFixed(2));

    // recalcula alturas no mobile (porque header muda com scale)
    updateMobileQuizHeight();
  }
  document.getElementById('scaleUpBtn').onclick = () => setScale(parseFloat(localStorage.getItem(SCALE_KEY) || 1.0) + 0.05);
  document.getElementById('scaleDownBtn').onclick = () => setScale(parseFloat(localStorage.getItem(SCALE_KEY) || 1.0) - 0.05);
  setScale(parseFloat(localStorage.getItem(SCALE_KEY) || 1.0));

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

  document.getElementById('soundToggle').onclick = function() {
    const current = localStorage.getItem(SOUND_KEY) !== '0';
    localStorage.setItem(SOUND_KEY, current ? '0' : '1');
    this.innerText = current ? '🔇' : '🔊';
  };
  if (localStorage.getItem(SOUND_KEY) === null) localStorage.setItem(SOUND_KEY, '1');
  document.getElementById('soundToggle').innerText = localStorage.getItem(SOUND_KEY) === '0' ? '🔇' : '🔊';

  // ====== Navegação ======
  window.go = function(target){
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(target).classList.add('active');
    document.querySelectorAll('.tabbtn').forEach(b => b.classList.toggle('active', b.dataset.target === target));

    // modo “sem rolagem” + esconder topo só no quiz (mobile)
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
    container.innerHTML = '<div style="text-align:center; padding:20px;">Carregando...</div>';
    try {
      const res = await fetch(`${SCRIPT_URL}?action=getStudies`);
      const js = await res.json();
      if (js.ok && js.studies){
        container.innerHTML = '';
        js.studies.forEach(s => {
          const d = document.createElement('details'); d.className = 'summary';
          const content = linkify(s.conteudo || '');
          d.innerHTML = `<summary>${s.topico || 'Tópico'}</summary><div class="study-content" style="padding:15px">${content}</div>`;
          container.appendChild(d);
        });
      }
    } catch (e) { container.innerHTML = 'Erro ao carregar.'; }
  }

  async function showTopicSelection(){
    try {
      const res = await fetch(`${SCRIPT_URL}?action=getTopics`);
      const js = await res.json();
      const select = document.getElementById('topicSelect');
      select.innerHTML = '<option value="Todos">Todos</option>';
      if (js.ok && js.topics) js.topics.forEach(t => select.innerHTML += `<option value="${t}">${t}</option>`);
    } catch (e) {}
  }

  async function loadTopicQuestions(topic){
    document.getElementById('question').innerText = 'Carregando...';
    try {
      const res = await fetch(`${SCRIPT_URL}?action=getQuestionsByTopic&topic=${encodeURIComponent(topic)}`);
      const js = await res.json();
      POOL = (js.ok && js.questions) ? js.questions.slice(0, TEMPLATE_QUIZ_SIZE) : [];
      currentIndex = 0; score = 0; quizStarted = true;
      renderQuestion();
    } catch (e) {}
  }
  document.getElementById('loadTopicBtn').onclick = () => loadTopicQuestions(document.getElementById('topicSelect').value);

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
      btn.innerText = `${letter}) ${txt}`;
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
    expl.innerHTML = `<strong>${letter === correct ? '✅ Correto!' : '❌ Errado!'}</strong><br>${q_expl(q)}`;
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
    document.getElementById('question').innerText = `Fim! Você acertou ${score} de ${POOL.length}`;
    document.getElementById('opts').innerHTML = '';
    document.getElementById('btnRestart').style.display = 'block';
    saveRecord(score, POOL.length);
    updateMobileQuizHeight();
  }

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

  function saveRecord(s, t){
    if(!t) return;
    const pct = Math.round((s/t)*100);
    const prev = JSON.parse(localStorage.getItem(BEST_KEY) || '{"pct":0}');
    if (pct > prev.pct) localStorage.setItem(BEST_KEY, JSON.stringify({score:s, total:t, pct:pct}));
  }

  function showBestRecord(){
    const rec = JSON.parse(localStorage.getItem(BEST_KEY));
    document.getElementById('bestRecord').innerText = rec ? `🏆 Melhor: ${rec.score}/${rec.total} (${rec.pct}%)` : '🚀 Sem recorde.';
  }

  async function renderCards(){
    const container = document.getElementById('cardsContainer');
    container.innerHTML = '<div style="text-align:center; padding:20px;">Carregando...</div>';
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
        container.innerHTML = '<div style="text-align:center; padding:20px;">Nenhum cartão encontrado.</div>';
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

        front.innerHTML = `<div style="font-size:11px;opacity:0.7">${topicText}</div><div style="font-weight:800;margin-top:8px;font-size:14px;">${frontText}</div><div style="margin-top:12px;font-size:11px;color:var(--accent)">Clique para ver resposta</div>`;
        back.innerHTML = `<div style="font-size:11px;opacity:0.7">${topicText}</div><div style="font-weight:600;margin-top:8px;font-size:13px;">${backText}</div>`;

        inner.appendChild(front); inner.appendChild(back);
        wrapper.appendChild(inner);
        wrapper.onclick = () => inner.classList.toggle('flipped');
        container.appendChild(wrapper);
      });
    } catch(e) {
      container.innerHTML = '<div style="text-align:center; padding:20px;">Erro ao carregar cartões.</div>';
    }
  }

  // Inicial
  showBestRecord();
  updateMobileQuizHeight();
