var SCRIPT_URL =
"https://script.google.com/macros/s/AKfycbx64clSmoa7ymBZls8osmpp6PuwCyqHJ0bcOBz9NI0PqBM_tHr8Px_lGdQEr_9INdMB3g/exec"https://script.google.com/macros/s/AKfycbx64clSmoa7ymBZls8osmpp6PuwCyqHJ0bcOBz9NI0PqBM_tHr8Px_lGdEr_9INdMB3g/exec";
var TEMPLATE_QUIZ_SIZE = 20;
var POOL = [];
var currentIndex = 0;
var score = 0;
var quizStarted = false;
var SOUND_KEY = "quiz_sound_on";
var SCALE_KEY = "quiz_card_scale";
var BEST_KEY = "quiz_best_record";
var STREAK_KEY = "quiz_streak";
var QUESTIONS_KEY = "quiz_total_questions";
var LAST_VISIT_KEY = "quiz_last_visit";
var DAILY_DATA_KEY = "quiz_daily_data";
var audioCtx = null;
var chartInstance = null;

function q_text(q) { return q.pergunta || q.perguntas || q.question || ""; }
function q_topic(q) { return q.materia || q.topico || q.topico || q.topic || ""; }
function q_expl(q) { return q.explicacao || q.explicacao || q.explanation || ""; }
function q_answer_letter(q) { var a = (q.resposta || q.answer || "").toString().trim(); return
a.substr(0,1).toUpperCase(); }
function q_option(q, letter) { return q[letter.toUpperCase()] || q[letter.toLowerCase()] || ""; }

function getFirestoreDb() { try { if (window.firebase && firebase.firestore) { return firebase.firestore(); } }
catch(e) {} return null; }
function isMobile() { return window.matchMedia && window.matchMedia("(max-width: 600px)").matches; }

function updateMobileQuizHeight() {
  if(!isMobile()) return;
  var header = document.getElementById("cardHeader");
  var tabs = document.getElementById("tabsBar");
  var headerVisible = header && getComputedStyle(header).display !== "none";
  var headerH = headerVisible ? Math.ceil(header.getBoundingClientRect().height) : 0;
  var tabsH = tabs ? Math.ceil(tabs.getBoundingClientRect().height + 20) : 86;
  document.documentElement.style.setProperty("--header-h", headerH + "px");
  document.documentElement.style.setProperty("--tabs-h", tabsH + "px");
  var extra = 26;
  var quizH = Math.max(360, Math.floor(window.innerHeight - headerH - tabsH - extra));
  document.documentElement.style.setProperty("--quiz-h", quizH + "px");
}

function applyQuizViewportMode(on) {
  var quizEl = document.getElementById("quiz");
  if(!quizEl) return;
  document.body.classList.toggle("quiz-mode", !!on);
  if(isMobile() && on) {
    document.body.classList.add("lock-scroll");
    quizEl.classList.add("quiz-viewport");
    requestAnimationFrame(function() { updateMobileQuizHeight(); });
  } else {
    document.body.classList.remove("lock-scroll");
    quizEl.classList.remove("quiz-viewport");
    updateMobileQuizHeight();
  }
}

window.addEventListener("resize", function() { updateMobileQuizHeight(); });

function ensureAudio() { if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }

function playTone(freq, dur, type, gainVal) {
  if (dur === undefined) dur = 120;
  if (type === undefined) type = "sine";
  if (gainVal === undefined) gainVal = 0.06;
  if (localStorage.getItem(SOUND_KEY) === "0") return;
  try {
    ensureAudio();
    var o = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gainVal;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    setTimeout(function() { o.stop(); o.disconnect(); g.disconnect(); }, dur);
  } catch(e) {}
}

function playCorrect() { playTone(880, 120, "sine", 0.06); }
function playWrong() { playTone(220, 220, "sawtooth", 0.08); }

function setScale(v) {
  v = Math.max(0.8, Math.min(1.4, Number(v)));
  var appRoot = document.getElementById("appRoot");
  var scaleLabel = document.getElementById("scaleLabel");
  if(appRoot) appRoot.style.transform = "scale(" + v.toFixed(2) + ")";
  if(appRoot) appRoot.style.transformOrigin = "top center";
  if(scaleLabel) scaleLabel.innerText = "x" + v.toFixed(2);
  localStorage.setItem(SCALE_KEY, v.toFixed(2));
  updateMobileQuizHeight();
}

function go(target) {
  console.log("Navegando para:", target);
  var pages = document.querySelectorAll(".page");
  for(var i = 0; i < pages.length; i++) { pages[i].classList.remove("active"); }
  var targetPage = document.getElementById(target);
  if(targetPage) {
    targetPage.classList.add("active");
    console.log("Pagina ativa:", target);
  }
  var tabbtns = document.querySelectorAll(".tabbtn");
  for(var i = 0; i < tabbtns.length; i++) {
    var isActive = tabbtns[i].dataset.target === target;
    if(isActive) tabbtns[i].classList.add("active");
    else tabbtns[i].classList.remove("active");
  }
  applyQuizViewportMode(target === "quiz");
  window.scrollTo({top: 0, behavior: "smooth"});
  if (target === "home") { showBestRecord(); loadStats(); setDailyTip(); setTimeout(renderChart, 400); }
  if (target === "study") renderStudies();
  if (target === "cards") renderCards();
  if (target === "quiz" && !quizStarted) showTopicSelection();
}

window.go = go;

function linkify(text) {
  if(!text) return "";
  var urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  return text.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

function renderStudies() {
  var container = document.getElementById("studyList");
  if(!container) return;
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando...</p></div>';
  fetch(SCRIPT_URL + "?action=getStudies").then(function(res) { return res.json(); }).then(function(js) {
    if (js.ok && js.studies && js.studies.length > 0) {
      container.innerHTML = "";
      for(var i = 0; i < js.studies.length; i++) {
        var s = js.studies[i];
        var d = document.createElement("details");
        d.className = "summary";
        var content = linkify(s.conteudo || "");
        d.innerHTML = "<summary>" + (s.topico || "Topico") + "</summary><div class=\"study-content\">" + content +
"</div>";
        container.appendChild(d);
      }
    } else {
      container.innerHTML = '<div style="text-align:center;padding:30px;">Nenhum conteudo.</div>';
    }
  }).catch(function(e) {
    console.error("Erro:", e);
    container.innerHTML = '<div style="text-align:center;padding:30px;">Erro ao carregar.</div>';
  });
}

function showTopicSelection() {
  var select = document.getElementById("topicSelect");
  if(!select) return;
  select.innerHTML = '<option value="Todos">Todos</option>';
  var db = getFirestoreDb();
  if(!db) { select.innerHTML += '<option value="Demo">Modo Demo</option>'; return; }
  db.collection("materias").where("ativo", "==", true).orderBy("ordem", "asc").get().then(function(snap) {
    snap.forEach(function(doc) {
      var data = doc.data() || {};
      var nome = (data.nome || "").toString().trim();
      if (nome) select.innerHTML += '<option value="' + nome + '">' + nome + "</option>";
    });
  }).catch(function(e) {
    console.error("Erro:", e);
    select.innerHTML += '<option value="Demo">Modo Demo</option>';
  });
}

function generateDemoQuestions() {
  return [
    { pergunta: "Qual lei regula o Estatuto da Guarda Civil?", materia: "Legislacao", A: "Lei 13.022/2014", B:
"Lei 8.112/1990", C: "Lei 10.406/2002", D: "Lei 9.784/1999", resposta: "A", explicacao: "Lei 13.022/2014." },
    { pergunta: "Qual principio exige publicidade?", materia: "Dir. Administrativo", A: "Legalidade", B:
"Publicidade", C: "Impessoalidade", D: "Moralidade", resposta: "B", explicacao: "Principio da Publicidade." },
    { pergunta: "O que significa ECA?", materia: "Legislacao Especial", A: "Estatuto do Cidadao Adulto", B:
"Estatuto da Crianca e do Adolescente", C: "Estatuto de Capacitacao", D: "Estatuto de Conduta", resposta: "B",
explicacao: "ECA = Lei 8.069/1990." }
  ];
}

function loadTopicQuestions(topic) {
  var questionEl = document.getElementById("question");
  if(questionEl) questionEl.innerText = "Carregando...";
  var db = getFirestoreDb();
  if(!db) {
    POOL = generateDemoQuestions();
    currentIndex = 0;
    score = 0;
    quizStarted = true;
    renderQuestion();
    return;
  }
  var ref = db.collection("questoes").where("ativo", "==", true);
  if (topic && topic !== "Todos") ref = ref.where("materia", "==", topic);
  ref.orderBy("ordem", "asc").limit(TEMPLATE_QUIZ_SIZE).get().then(function(snap) {
    POOL = [];
    snap.forEach(function(doc) { POOL.push({ id: doc.id, ...doc.data() }); });
    currentIndex = 0;
    score = 0;
    quizStarted = true;
    renderQuestion();
  }).catch(function(e) {
    console.error("Erro:", e);
    POOL = generateDemoQuestions();
    currentIndex = 0;
    score = 0;
    quizStarted = true;
    renderQuestion();
  });
}

function renderQuestion() {
  var questionEl = document.getElementById("question");
  var optsEl = document.getElementById("opts");
  var explainEl = document.getElementById("explain");
  var nextBtn = document.getElementById("nextBtn");
  if(explainEl) explainEl.style.display = "none";
  if(nextBtn) nextBtn.disabled = true;
  if (currentIndex >= POOL.length) { finishQuiz(); return; }
  var q = POOL[currentIndex];
  if(questionEl) questionEl.innerText = "📘 " + q_topic(q) + "\n" + q_text(q);
  if(optsEl) optsEl.innerHTML = "";
  var letters = ["A","B","C","D"];
  for(var i = 0; i < letters.length; i++) {
    var letter = letters[i];
    var txt = q_option(q, letter);
    if (!txt) continue;
    var btn = document.createElement("button");
    btn.className = "opt";
    btn.id = "opt_" + letter;
    btn.innerHTML = "<span style=\"color:var(--accent);margin-right:10px;font-weight:900\">" + letter + ")</span>
" + txt;
    btn.onclick = function(l) { return function() { selectOption(l); }; }(letter);
    if(optsEl) optsEl.appendChild(btn);
  }
  updateProgressUI();
  updateMobileQuizHeight();
}

function selectOption(letter) {
  var q = POOL[currentIndex];
  var correct = q_answer_letter(q);
  var opts = document.querySelectorAll(".opt");
  for(var i = 0; i < opts.length; i++) { opts[i].disabled = true; }
  var elCorrect = document.getElementById("opt_" + correct);
  if (elCorrect) elCorrect.classList.add("correct");
  if (letter !== correct) {
    var chosen = document.getElementById("opt_" + letter);
    if (chosen) chosen.classList.add("wrong");
    playWrong();
  } else {
    score++;
    playCorrect();
  }
  var expl = document.getElementById("explain");
  if(expl) {
    expl.style.display = "block";
    expl.innerHTML = "<strong style=\"color:var(--accent);font-size:16px\">" + (letter === correct ? "✅ Correto!"
: "❌ Errado!") + "</strong><br><span style=\"color:var(--muted-light)\">" + q_expl(q) + "</span>";
  }
  var nextBtn = document.getElementById("nextBtn");
  if(nextBtn) nextBtn.disabled = false;
  incrementQuestionsCount();
  updateMobileQuizHeight();
}

function updateProgressUI() {
  var bar = document.getElementById("bar");
  var progressInfo = document.getElementById("progressInfo");
  var progressText = document.getElementById("progressText");
  var pct = POOL.length ? Math.round((currentIndex / POOL.length) * 100) : 0;
  if(bar) bar.style.width = pct + "%";
  if(progressInfo) progressInfo.innerText = POOL.length ? (currentIndex + 1) + " / " + POOL.length : "0 / 0";
  if(progressText) progressText.innerText = "Pontos: " + score;
}

function finishQuiz() {
  quizStarted = false;
  var questionEl = document.getElementById("question");
  var optsEl = document.getElementById("opts");
  var btnRestart = document.getElementById("btnRestart");
  if(questionEl) questionEl.innerHTML = "🎉 <span style=\"color:var(--accent)\">Fim do Simulado!</span>\n\nVoce
acertou <strong style=\"color:var(--accent);font-size:20px\">" + score + "</strong> de <strong>" + POOL.length +
"</strong> questoes";
  if(optsEl) optsEl.innerHTML = "";
  if(btnRestart) btnRestart.style.display = "block";
  saveRecord(score, POOL.length);
  saveDailyData(score, POOL.length);
  updateMobileQuizHeight();
}

function restartQuiz() {
  var btnRestart = document.getElementById("btnRestart");
  var questionEl = document.getElementById("question");
  var optsEl = document.getElementById("opts");
  var explainEl = document.getElementById("explain");
  var bar = document.getElementById("bar");
  var progressInfo = document.getElementById("progressInfo");
  var progressText = document.getElementById("progressText");
  if(btnRestart) btnRestart.style.display = "none";
  quizStarted = false;
  showTopicSelection();
  if(questionEl) questionEl.innerText = "Selecione um topico para comecar.";
  if(optsEl) optsEl.innerHTML = "";
  if(explainEl) explainEl.style.display = "none";
  if(bar) bar.style.width = "0%";
  if(progressInfo) progressInfo.innerText = "0 / 0";
  if(progressText) progressText.innerText = "";
  updateMobileQuizHeight();
}

function saveRecord(s, t) {
  if(!t) return;
  var pct = Math.round((s/t)*100);
  var prev = JSON.parse(localStorage.getItem(BEST_KEY) || '{"pct":0}');
  if (pct > prev.pct) {
    localStorage.setItem(BEST_KEY, JSON.stringify({score:s, total:t, pct:pct, date:new Date().toISOString()}));
  }
}

function saveDailyData(s, t) {
  var pct = Math.round((s/t)*100);
  var today = new Date().toLocaleDateString("pt-BR", {weekday:"short"});
  var dayMap = {"seg":"Seg","ter":"Ter","qua":"Qua","qui":"Qui","sex":"Sex","sab":"Sab","dom":"Dom"};
  var dayName = dayMap[today.toLowerCase().slice(0,3)] || today;
  var dailyData = JSON.parse(localStorage.getItem(DAILY_DATA_KEY) || "{}");
  dailyData[dayName] = pct;
  localStorage.setItem(DAILY_DATA_KEY, JSON.stringify(dailyData));
}

function showBestRecord() {
  var rec = JSON.parse(localStorage.getItem(BEST_KEY));
  var bestEl = document.getElementById("bestScoreStat");
  if(!bestEl) return;
  if (rec) {
    bestEl.innerText = rec.pct + "%";
    bestEl.style.animation = "pulse 2s infinite";
  } else {
    bestEl.innerText = "--";
  }
}

function updateStreak() {
  var today = new Date().toDateString();
  var lastVisit = localStorage.getItem(LAST_VISIT_KEY);
  var streak = parseInt(localStorage.getItem(STREAK_KEY) || "0");
  if (lastVisit !== today) {
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (lastVisit === yesterday.toDateString()) streak++;
    else if (lastVisit !== today) streak = 1;
    localStorage.setItem(STREAK_KEY, streak);
    localStorage.setItem(LAST_VISIT_KEY, today);
  }
  var streakEl = document.getElementById("streakStat");
  if(streakEl) streakEl.innerText = streak;
}

function incrementQuestionsCount() {
  var count = parseInt(localStorage.getItem(QUESTIONS_KEY) || "0");
  count++;
  localStorage.setItem(QUESTIONS_KEY, count);
  var questionsEl = document.getElementById("questionsStat");
  if(questionsEl) questionsEl.innerText = count;
}

function loadStats() {
  var questionsEl = document.getElementById("questionsStat");
  if(questionsEl) questionsEl.innerText = localStorage.getItem(QUESTIONS_KEY) || "0";
  updateStreak();
}

var dailyTips = [
  "Estude 30 minutos por dia.",
  "Faca pausas de 5 min a cada 25 min.",
  "Revise o conteudo do dia anterior.",
  "Durma bem!",
  "Pratique simulados.",
  "Anote duvidas.",
  "Ensine para alguem.",
  "Use flashcards.",
  "Hidrate-se.",
  "Celebre vitorias!",
  "Foque nos pontos fracos.",
  "Respire fundo."
];

function setDailyTip() {
  var today = new Date().getDay();
  var tipIndex = today % dailyTips.length;
  var tipEl = document.getElementById("dailyTipText");
  if(tipEl) tipEl.innerText = dailyTips[tipIndex];
}

function renderChart() {
  var chartContainer = document.getElementById("performanceChart");
  if (!chartContainer) return;
  if (typeof ApexCharts === "undefined") {
    console.log("ApexCharts nao carregou");
    return;
  }
  var accentColor = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  var days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
  var dailyData = JSON.parse(localStorage.getItem(DAILY_DATA_KEY) || "{}");
  var dataPoints = [];
  for(var i = 0; i < days.length; i++) {
    dataPoints.push(dailyData[days[i]] || Math.floor(Math.random() * (95 - 60) + 60));
  }
  var options = {
    series: [{ name: "Acertos (%)", data: dataPoints }],
    chart: { type: "area", height: 240, fontFamily: "Inter, sans-serif", toolbar: { show: false }, animations: {
enabled: true, easing: "easeinout", speed: 1000 } },
    colors: [accentColor],
    stroke: { curve: "smooth", width: 3 },
    fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.05, stops: [0, 90,
100] } },
    dataLabels: { enabled: false },
    xaxis: { categories: days, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors:
"rgba(255,255,255,0.6)", fontSize: "12px" } } },
    yaxis: { show: false, min: 0, max: 100 },
    grid: { show: true, borderColor: "rgba(255, 255, 255, 0.05)", strokeDashArray: 4 },
    tooltip: { theme: "dark", y: { formatter: function(val) { return val + "%"; } } },
    markers: { size: 5, colors: [accentColor], strokeColors: "#fff", strokeWidth: 2 }
  };
  if (chartInstance) {
    chartInstance.updateSeries([{ data: dataPoints }]);
  } else {
    chartInstance = new ApexCharts(chartContainer, options);
    chartInstance.render();
  }
}

function renderCards() {
  var container = document.getElementById("cardsContainer");
  if(!container) return;
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando...</p></div>';
  var sheetName = "cartoes";
  fetch(SCRIPT_URL + "?action=getCards&sheet=" + encodeURIComponent(sheetName),
{cache:"no-store"}).then(function(res) { return res.json(); }).then(function(js) {
    var list = (js.ok && js.cards) ? js.cards : (js.ok && js.questions ? js.questions : []);
    if (!list.length) {
      container.innerHTML = '<div style="text-align:center;padding:40px;">Nenhum cartao.</div>';
      return;
    }
    container.innerHTML = "";
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = list[i];
      list[i] = list[j];
      list[j] = temp;
    }
    var limit = list.length < 12 ? list.length : 12;
    for(var idx = 0; idx < limit; idx++) {
      var q = list[idx];
      var frontText = (q.pergunta || q.perguntas || q.question || "").toString().slice(0, 100);
      var topicText = (q.topico || q.topico || q.materia || "").toString();
      var backText = (q.resposta || q.respostas || q.explanation || "").toString().slice(0, 150);
      var wrapper = document.createElement("div");
      wrapper.className = "flashcard";
      wrapper.style.animationDelay = (idx * 0.1) + "s";
      var inner = document.createElement("div");
      inner.className = "flash-inner";
      var front = document.createElement("div");
      front.className = "flash-front";
      front.innerHTML = "<div style=\"font-size:11px;opacity:0.7\">" + (topicText || "Geral") + "</div><div
style=\"font-weight:800;margin-top:10px;font-size:14px\">" + frontText + "...</div><div
style=\"margin-top:15px;font-size:11px;color:var(--accent)\">👆 Toque para virar</div>";
      var back = document.createElement("div");
      back.className = "flash-back";
      back.innerHTML = "<div style=\"font-size:11px;opacity:0.7\">" + (topicText || "Geral") + "</div><div
style=\"font-weight:600;margin-top:10px;font-size:14px\">" + backText + "</div>";
      inner.appendChild(front);
      inner.appendChild(back);
      wrapper.appendChild(inner);
      wrapper.onclick = function() { inner.classList.toggle("flipped"); };
      container.appendChild(wrapper);
    }
  }).catch(function(e) {
    console.error("Erro:", e);
    container.innerHTML = '<div style="text-align:center;padding:40px;">Erro ao carregar.</div>';
  });
}

function initButtons() {
  var scaleUpBtn = document.getElementById("scaleUpBtn");
  var scaleDownBtn = document.getElementById("scaleDownBtn");
  if(scaleUpBtn) scaleUpBtn.onclick = function() { setScale(parseFloat(localStorage.getItem(SCALE_KEY) || "1.0") +
0.05); };
  if(scaleDownBtn) scaleDownBtn.onclick = function() { setScale(parseFloat(localStorage.getItem(SCALE_KEY) ||
"1.0") - 0.05); };
  var savedScale = parseFloat(localStorage.getItem(SCALE_KEY) || "1.0");
  setScale(savedScale);

  var soundToggle = document.getElementById("soundToggle");
  if(soundToggle) {
    if (localStorage.getItem(SOUND_KEY) === null) localStorage.setItem(SOUND_KEY, "1");
    soundToggle.innerText = localStorage.getItem(SOUND_KEY) === "0" ? "🔇" : "🔊";
    soundToggle.onclick = function() {
      var current = localStorage.getItem(SOUND_KEY) !== "0";
      localStorage.setItem(SOUND_KEY, current ? "0" : "1");
      this.innerText = current ? "🔇" : "🔊";
    };
  }

  var fullscreenBtn = document.getElementById("fullscreenBtn");
  if(fullscreenBtn) {
    fullscreenBtn.onclick = function() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function(err) {});
        this.innerText = "🗗";
      } else {
        document.exitFullscreen();
        this.innerText = "⛶";
      }
    };
  }

  var loadTopicBtn = document.getElementById("loadTopicBtn");
  if(loadTopicBtn) {
    loadTopicBtn.onclick = function() {
      var select = document.getElementById("topicSelect");
      var topic = select ? select.value : "Todos";
      loadTopicQuestions(topic);
    };
  }

  var nextBtn = document.getElementById("nextBtn");
  if(nextBtn) {
    nextBtn.onclick = function() { currentIndex++; renderQuestion(); };
  }

  var btnRestart = document.getElementById("btnRestart");
  if(btnRestart) {
    btnRestart.onclick = function() { restartQuiz(); };
  }

  var tabbtns = document.querySelectorAll(".tabbtn");
  for(var i = 0; i < tabbtns.length; i++) {
    tabbtns[i].onclick = function() {
      var target = this.dataset.target;
      if(target) go(target);
    };
  }
}

function init() {
  console.log("Iniciando app...");
  initButtons();
  showBestRecord();
  loadStats();
  setDailyTip();
  updateMobileQuizHeight();
  var homeEl = document.getElementById("home");
  if(homeEl && homeEl.classList.contains("active")) {
    setTimeout(renderChart, 500);
  }
  console.log("App pronto!");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
