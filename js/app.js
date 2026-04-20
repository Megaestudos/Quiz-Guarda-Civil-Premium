const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx64clSmoa7ymBZls8osmpp6PuwCyqHJ0bcOBz9NI0PqBM_tHr8Px_lGdQEr_9INdMB3g/exec';
const TEMPLATE_QUIZ_SIZE = 20;
let POOL = []; let currentIndex = 0; let score = 0; let quizStarted = false;
let isGrandeDia = false; let grandeDiaInterval = null;
const SOUND_KEY = 'quiz_sound_on'; const SCALE_KEY = 'quiz_card_scale'; const BEST_KEY = 'quiz_best_record';
const XP_KEY = 'quiz_xp'; const STREAK_KEY = 'quiz_streak'; const LAST_DATE_KEY = 'quiz_last_date';

// Navegação entre telas do App
window.showPage = window.go = function(id) {
  // Esconde todas as sections com classe 'page'
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // Mostra a alvo
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  
  // Atualiza as tabs (se existirem)
  document.querySelectorAll('.tabbtn').forEach(btn => {
     btn.classList.toggle('active', btn.getAttribute('data-target') === id);
  });

  // Foco no simulado
  if(id === 'quiz' && quizStarted) document.body.classList.add('quiz-focus');
  else document.body.classList.remove('quiz-focus');

  // Gatilhos extras de carregamento
  if (id === 'home' || id === 'dashboard') {
     showBestRecord();
     updateXPUI();
     checkStreak();
     if(typeof renderBadges === 'function') renderBadges();
     if(typeof renderStatsChart === 'function') renderStatsChart();
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
document.addEventListener('DOMContentLoaded', () => {
    const scaleUpBtn = document.getElementById('scaleUpBtn');
    const scaleDownBtn = document.getElementById('scaleDownBtn');
    
    if (scaleUpBtn) {
        scaleUpBtn.onclick = () => setScale(parseFloat(localStorage.getItem(SCALE_KEY) || 1.0) + 0.05);
    }
    if (scaleDownBtn) {
        scaleDownBtn.onclick = () => setScale(parseFloat(localStorage.getItem(SCALE_KEY) || 1.0) - 0.05);
    }
    
    if(!isMobile()) setScale(parseFloat(localStorage.getItem(SCALE_KEY) || 1.0));
    
    // Inicialização da Home
    showPage('home');
});

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

// Função removida por ser duplicata (agora unificada no topo)

function linkify(text) {
  const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  return text.replace(urlPattern, '<a href="$1" target="_blank">$1</a>');
}

// =====================================================================
// CATÁLOGO DE VÍDEOS E ÁUDIOS POR MATÉRIA
// Para adicionar conteúdo: inclua items no array 'videos' ou 'audios'
// de cada matéria. Para vídeos do YouTube, use apenas o ID do vídeo.
// Para áudios, use a URL direta do arquivo .mp3 / .ogg / ou YouTube.
// =====================================================================
const MEDIA_CATALOG = [
  {
    id: 'crimes-hediondos',
    name: 'Crimes Hediondos',
    icon: 'ph-warning-diamond',
    resumoFile: 'crimes-hediondos.html',
    videos: [
      { title: 'Crimes Hediondos - Aula Completa', youtubeId: 'vi9bOFRQSVc', duration: 'Vídeo' }
    ],
    audios: [
      { title: 'Jurisprudência dos crimes hediondos', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/07%20Jurisprud%C3%AAncia%20dos%20crimes%20hediondos.m4a', duration: 'Áudio' }
    ]
  },
  {
    id: 'direito-constitucional',
    name: 'Direito Constitucional',
    icon: 'ph-book-open',
    resumoFile: 'direito-constitucional.html',
    videos: [],
    audios: []
  },
  {
    id: 'direito-administrativo',
    name: 'Direito Administrativo',
    icon: 'ph-scales',
    resumoFile: 'direito-administrativo.html',
    videos: [],
    audios: []
  },
  {
    id: 'codigo-penal',
    name: 'Código Penal / Direito Penal',
    icon: 'ph-gavel',
    resumoFile: 'codigo-penal.html',
    videos: [
      { title: 'Direito Penal - Aula Completa', youtubeId: 'vXuZA836FDY', duration: 'Vídeo' }
    ],
    audios: [
      { title: 'Direito penal e jurisprudência para concursos', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/09%20Direito%20penal%20e%20jurisprud%C3%AAncia%20para%20concursos.m4a', duration: 'Áudio' }
    ]
  },
  {
    id: 'maria-da-penha',
    name: 'Lei Maria da Penha',
    icon: 'ph-gender-female',
    resumoFile: 'maria-da-penha.html',
    videos: [
      { title: 'Lei Maria da Penha - Aula Completa', youtubeId: 'MJg4lnlTEI4', duration: 'Vídeo' }
    ],
    audios: [
      { title: 'Maria da Penha', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/04%20Maria%20da%20Penha.m4a', duration: 'Áudio' }
    ]
  },
  {
    id: 'eca',
    name: 'Estatuto da Criança (ECA)',
    icon: 'ph-baby',
    resumoFile: 'estatuto-da-criança-e-do-adolescente.html',
    videos: [
      { title: 'ECA - Aula Completa', youtubeId: 'B-1iTZLf-bM', duration: 'Vídeo' }
    ],
    audios: [
      { title: 'ECA - Estatuto da Criança e do Adolescente', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/01%20ECA%20-%20Estatuto%20da%20Crian%C3%A7a%20e%20do%20Adolecente.m4a', duration: 'Áudio' }
    ]
  },
  {
    id: 'lei-de-drogas',
    name: 'Lei de Drogas',
    icon: 'ph-pills',
    resumoFile: 'lei-de-drogas.html',
    videos: [
      { title: 'Lei de Drogas - Aula Completa', youtubeId: 'z7CEDMpeTPI', duration: 'Vídeo' }
    ],
    audios: [
      { title: 'Jurisprudência da Lei de Drogas', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/08%20Jurisprud%C3%AAncia%20da%20Lei%20de%20Drogas.m4a', duration: 'Áudio' }
    ]
  },
  {
    id: 'abuso-de-autoridade',
    name: 'Abuso de Autoridade',
    icon: 'ph-shield-warning',
    resumoFile: 'abuso-de-autoridade.html',
    videos: [
      { title: 'Abuso de Autoridade - Aula Completa', youtubeId: 'E5VDO_sv-mI', duration: 'Vídeo' }
    ],
    audios: [
      { title: 'Abuso de Autoridade', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/02%20Abuso%20de%20Autoridade.m4a', duration: 'Áudio' }
    ]
  },
  {
    id: 'crimes-ambientais',
    name: 'Crimes Ambientais',
    icon: 'ph-tree',
    resumoFile: 'crimes-ambientais.html',
    videos: [
      { title: 'Crimes Ambientais - Aula Completa', youtubeId: 'EQF4Ig5Ojco', duration: 'Vídeo' }
    ],
    audios: [
      { title: 'Crimes Ambientais', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/06%20Crimes%20Ambientais.m4a', duration: 'Áudio' }
    ]
  },
  {
    id: 'crimes-de-tortura',
    name: 'Crimes de Tortura (Lei Anti-tortura)',
    icon: 'ph-hand-palm',
    resumoFile: 'crimes-de-tortura.html',
    videos: [
      { title: 'Lei Anti-tortura - Aula Completa', youtubeId: 'qGliuzL-7pA', duration: 'Vídeo' }
    ],
    audios: [
      { title: 'Lei da Tortura', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/03%20Lei%20da%20Tortura.m4a', duration: 'Áudio' }
    ]
  },
  {
    id: 'crimes-preconceito',
    name: 'Crimes de Preconceito (Injúria Racial)',
    icon: 'ph-users-three',
    resumoFile: 'crimes-preconceito-raça-cor.html',
    videos: [
      { title: 'Injúria Racial - Aula Completa', youtubeId: 'l9GkQYqpvl8', duration: 'Vídeo' }
    ],
    audios: [
      { title: 'Injúria Racial', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/05%20Inj%C3%BAria%20Racial.m4a', duration: 'Áudio' }
    ]
  },
  {
    id: 'procedimentos-penais',
    name: 'Procedimentos Penais',
    icon: 'ph-files',
    resumoFile: 'procedimentos-penais.html',
    videos: [],
    audios: []
  },
  {
    id: 'mbft',
    name: 'Manual Brasileiro de Fiscalização de Trânsito',
    icon: 'ph-car',
    resumoFile: '#', // Adicionei um placeholder, caso tenha um arquivo correspondente, atualize aqui.
    videos: [],
    audios: [
      { title: 'Manual Brasileiro de Fiscalização de Trânsito (MBFT)', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/Manual%20Brasileiro%20de%20Fiscaliza%C3%A7%C3%A3o%20de%20Tr%C3%A2nsito%20%28MBFT.m4a', duration: 'Áudio' }
    ]
  }
];

const GITHUB_RESUMOS_BASE = 'https://megaestudos.github.io/PlenAula/Resumos/';

// Estado de navegação de mídia
let currentSubjectId = null;
let currentMediaType = null; // 'video' | 'audio'

// Funções de navegação entre as views da seção Estudar Leis
function showStudyViews(viewId) {
  ['studyView', 'mediaPicker', 'mediaListView', 'mediaPlayerView'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === viewId) ? 'block' : 'none';
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.backToSubjects = function() {
  stopCurrentMedia();
  showStudyViews('studyView');
};
window.backToPicker = function() {
  stopCurrentMedia();
  showStudyViews('mediaPicker');
};
window.backToMediaList = function() {
  stopCurrentMedia();
  showStudyViews('mediaListView');
};

function stopCurrentMedia() {
  // Para qualquer iframe ou áudio em reprodução
  const pc = document.getElementById('playerContainer');
  if (pc) pc.innerHTML = '';
}

function openSubject(subjectId) {
  currentSubjectId = subjectId;
  const subject = MEDIA_CATALOG.find(s => s.id === subjectId);
  if (!subject) return;

  // Atualiza título
  document.getElementById('mediaPickerTitle').innerHTML =
    `<i class="ph-fill ${subject.icon}"></i> ${subject.name}`;

  // Atualiza contadores
  const vCount = subject.videos.length;
  const aCount = subject.audios.length;
  document.getElementById('videoCount').textContent =
    vCount > 0 ? `${vCount} aula${vCount !== 1 ? 's' : ''} disponível${vCount !== 1 ? 'is' : ''}` : 'Em breve';
  document.getElementById('audioCount').textContent =
    aCount > 0 ? `${aCount} aula${aCount !== 1 ? 's' : ''} disponível${aCount !== 1 ? 'is' : ''}` : 'Em breve';

  // Link do resumo em texto
  const resumoLink = document.getElementById('resumoTextLink');
  if (resumoLink) resumoLink.href = GITHUB_RESUMOS_BASE + subject.resumoFile;

  // Desabilita botões sem conteúdo
  const videoBtn = document.querySelector('.video-btn');
  const audioBtn = document.querySelector('.audio-btn');
  if (videoBtn) videoBtn.style.opacity = vCount > 0 ? '1' : '0.5';
  if (audioBtn) audioBtn.style.opacity = aCount > 0 ? '1' : '0.5';

  showStudyViews('mediaPicker');
}

window.showMediaList = function(type) {
  const subject = MEDIA_CATALOG.find(s => s.id === currentSubjectId);
  if (!subject) return;

  currentMediaType = type;
  const items = type === 'video' ? subject.videos : subject.audios;

  // Atualiza título
  const icon = type === 'video' ? 'ph-video' : 'ph-headphones';
  const label = type === 'video' ? 'Aulas em Vídeo' : 'Aulas em Áudio';
  document.getElementById('mediaListTitle').innerHTML =
    `<i class="ph-fill ${icon}"></i> ${label} — ${subject.name}`;

  // Renderiza lista
  const listEl = document.getElementById('mediaItemsList');
  listEl.innerHTML = '';

  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="media-empty-state">
        <i class="ph ph-${type === 'video' ? 'video-camera-slash' : 'speaker-slash'}"></i>
        <h4>Conteúdo em breve</h4>
        <p>As ${label.toLowerCase()} de <strong>${subject.name}</strong> estão sendo preparadas e serão disponibilizadas em breve.</p>
      </div>`;
    showStudyViews('mediaListView');
    return;
  }

  items.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'media-item-card';
    card.innerHTML = `
      <div class="media-item-thumb ${type === 'audio' ? 'audio-thumb' : ''}">
        ${item.youtubeId
          ? `<img src="https://img.youtube.com/vi/${item.youtubeId}/mqdefault.jpg" alt="${item.title}" onerror="this.parentElement.innerHTML='<i class=\\'ph-fill ph-${type === 'video' ? 'video' : 'headphones'}\\'></i>'">`
          : `<i class="ph-fill ph-${type === 'video' ? 'video' : 'headphones'}"></i>`
        }
        <div class="media-play-overlay"><i class="ph-fill ph-play-circle"></i></div>
      </div>
      <div class="media-item-info">
        <div class="media-item-num">Aula ${index + 1}</div>
        <div class="media-item-title">${item.title}</div>
        ${item.duration ? `<div class="media-item-dur"><i class="ph ph-clock"></i> ${item.duration}</div>` : ''}
      </div>
      <i class="ph ph-caret-right media-item-arrow"></i>
    `;
    card.onclick = () => openMediaPlayer(item, type);
    listEl.appendChild(card);
  });

  showStudyViews('mediaListView');
};

function openMediaPlayer(item, type) {
  const subject = MEDIA_CATALOG.find(s => s.id === currentSubjectId);
  const titleEl = document.getElementById('playerTitle');
  titleEl.innerHTML = `<i class="ph-fill ph-${type === 'video' ? 'video' : 'headphones'}"></i> ${item.title}`;

  const pc = document.getElementById('playerContainer');
  pc.innerHTML = '';

  if (item.youtubeId) {
    // Player YouTube embutido
    pc.innerHTML = `
      <div class="yt-player-wrapper">
        <iframe
          src="https://www.youtube.com/embed/${item.youtubeId}?rel=0&autoplay=1&playsinline=1"
          title="${item.title}"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen>
        </iframe>
      </div>
      <div class="player-info-box">
        <div class="player-subject-tag"><i class="ph-fill ${subject.icon}"></i> ${subject.name}</div>
        <h4 class="player-item-title">${item.title}</h4>
        ${item.duration ? `<div class="player-duration"><i class="ph ph-clock"></i> Duração: ${item.duration}</div>` : ''}
      </div>`;
  } else if (item.url) {
    if (type === 'audio') {
      // Player de áudio nativo
      pc.innerHTML = `
        <div class="audio-player-wrapper">
          <div class="audio-player-art">
            <i class="ph-fill ph-waveform"></i>
          </div>
          <div class="audio-player-info">
            <div class="player-subject-tag"><i class="ph-fill ${subject.icon}"></i> ${subject.name}</div>
            <h4 class="player-item-title">${item.title}</h4>
            ${item.duration ? `<div class="player-duration"><i class="ph ph-clock"></i> Duração: ${item.duration}</div>` : ''}
          </div>
          <audio id="audioPlayer" controls autoplay style="width:100%; margin-top:20px; border-radius:12px;">
            <source src="${item.url}" type="audio/mpeg">
            <source src="${item.url}" type="audio/ogg">
            Seu navegador não suporta áudio HTML5.
          </audio>
        </div>`;
    } else {
      // Vídeo direto (não YouTube)
      pc.innerHTML = `
        <div class="yt-player-wrapper">
          <video controls autoplay playsinline style="width:100%; border-radius:16px; background:#000;">
            <source src="${item.url}" type="video/mp4">
          </video>
        </div>
        <div class="player-info-box">
          <div class="player-subject-tag"><i class="ph-fill ${subject.icon}"></i> ${subject.name}</div>
          <h4 class="player-item-title">${item.title}</h4>
        </div>`;
    }
  }

  showStudyViews('mediaPlayerView');
}

async function renderStudies() {
  const container = document.getElementById('studyList');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted)"><i class="ph ph-spinner-gap ph-spin" style="font-size:24px;"></i><br><br>Carregando matérias...</div>';

  try {
    container.innerHTML = '';
    MEDIA_CATALOG.forEach(subject => {
      const totalMedia = subject.videos.length + subject.audios.length;
      const card = document.createElement('div');
      card.className = 'resumo-card';
      card.innerHTML = `
        <div class="resumo-icon"><i class="ph-fill ${subject.icon}"></i></div>
        <div class="resumo-info">
          <h4>${subject.name}</h4>
          <p>${totalMedia > 0 ? `${subject.videos.length} vídeo${subject.videos.length !== 1 ? 's' : ''} · ${subject.audios.length} áudio${subject.audios.length !== 1 ? 's' : ''}` : 'Resumo + Mídia'}</p>
        </div>
        <div class="resumo-action"><i class="ph ph-arrow-right"></i></div>
      `;
      card.onclick = () => openSubject(subject.id);
      container.appendChild(card);
    });
  } catch (e) {
    console.error(e);
    container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--danger)">Erro ao carregar matérias.</div>';
  }
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

    const select = document.getElementById('topicSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Carregando tópicos...</option>';

    try {
      const db = getFirestoreDb();
      const snap = await db.collection('materias').get();
      
      select.innerHTML = '<option value="Todos">Todas as Matérias</option>';
      
      let materias = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d.ativo !== false) {
          materias.push({ nome: d.nome, ordem: d.ordem || 99 });
        }
      });

      materias.sort((a, b) => a.ordem - b.ordem);

      materias.forEach(m => {
        const nome = (m.nome || '').toString().trim();
        if (nome) select.innerHTML += `<option value="${nome}">${nome}</option>`;
      });

      if (materias.length === 0) {
          log("Aviso: Nenhuma matéria encontrada no banco.", "warning");
      }
    } catch (err) {
      console.error("Erro ao carregar tópicos:", err);
      select.innerHTML = '<option value="Todos">Todas as Matérias (Erro ao Carregar)</option>';
    }
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
