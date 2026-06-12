/* =====================================================
   JORNADA DE APROVAÇÃO — PlenAula 2.0
   Modelo Híbrido: Carreiras estáticas + Conteúdo Firebase
   FASE 2 — Melhorias da Jornada
   ===================================================== */

// ─── Chaves de armazenamento ──────────────────────────────────────────────────
const JORNADA_KEY       = 'jornada_progress_v2';
const CARREIRA_KEY      = 'jornada_carreira_v1';
const TEMPO_ESTUDO_KEY  = 'jornada_tempo_estudo';
const JORNADA_XP_BONUS  = { missao: 50, modulo: 150, carreira: 500 };

// ─── 8. ARQUITETURA ESCALÁVEL DE CARREIRAS ────────────────────────────────────
// Para adicionar novas carreiras: crie um objeto em CARREIRAS com a mesma
// estrutura (id, nome, emoji, descricao, cor, corGradient, modulos).
// Adicione o id em CARREIRAS_FUTURAS enquanto não estiver pronto.
// Nenhuma outra parte do código precisa ser alterada.
const CARREIRAS_FUTURAS = ['prf','policia_federal','policia_civil','bombeiros','agente_transito','guarda_portuaria'];

// ─── Estado global ────────────────────────────────────────────────────────────
let JORNADA_PROGRESS  = {};
let CARREIRA_ATIVA    = null;
let MODULO_ATIVO_IDX  = null;
let FIREBASE_CONTENT  = {};   // cache: { [chaveMateria]: { videos, audios, slides, questoes, flashcards } }
let _TEMPO_INICIO_SESSAO = null;

// ─── ESTRUTURA ESTÁTICA DE CARREIRAS ─────────────────────────────────────────
const CARREIRAS = {
  guarda_municipal: {
    id: 'guarda_municipal',
    nome: 'Guarda Municipal',
    emoji: '👮',
    descricao: 'Prepare-se para concursos de Guarda Municipal com trilha completa.',
    cor: '#3B82F6',
    corGradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    modulos: []
  },
  policia_militar: {
    id: 'policia_militar',
    nome: 'Polícia Militar',
    emoji: '🚔',
    descricao: 'Trilha completa para concursos da Polícia Militar estadual.',
    cor: '#10B981',
    corGradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    modulos: []
  },
  policia_penal: {
    id: 'policia_penal',
    nome: 'Polícia Penal',
    emoji: '🔒',
    descricao: 'Trilha focada no concurso de Agente/Polícia Penal.',
    cor: '#F59E0B',
    corGradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    modulos: []
  }
};

// ─── CARREGAMENTO DINÂMICO DE MISSÕES (FIREBASE) ─────────────────────────────
window.carregarMissoesFirebase = async function() {
  if (!window.firebase || !firebase.firestore) return;
  try {
    const db = firebase.firestore();

    // Busca todas as questões ativas para extrair a hierarquia
    console.log("=== AUDITORIA JORNADA V2 ===");
    console.log("1. Executando consulta: db.collection('questoes').where('ativo', '==', true).get()");
    const qSnap = await db.collection('questoes').where('ativo', '==', true).get();
    
    console.log(`2. Questões encontradas: ${qSnap.size}`);

    if (qSnap.empty) {
      alert("Nenhuma questão encontrada para gerar a Jornada. Verifique se as questões possuem o campo 'ativo' == true e se a coleção 'questoes' tem permissão de leitura.");
      console.warn("Nenhuma questão ativa retornada pela consulta.");
    }
    
    // Agrupa: Matéria -> Assunto -> Subassunto
    const hierarchy = {};
    const auditMaterias = new Set();
    const auditAssuntos = new Set();
    const auditSubassuntos = new Set();
    
    qSnap.forEach(doc => {
      const data = doc.data();
      const mat = (data.materia || '').trim();
      let ass = (data.assunto || data.topico || data.tópico || data.topic || '').trim();
      const sub = (data.subassunto || '').trim();
      
      if (!mat) return;
      if (!ass) ass = 'Geral'; // Fallback se a questão tiver apenas Matéria
      
      auditMaterias.add(mat);
      if (ass) auditAssuntos.add(`${mat} -> ${ass}`);
      if (sub) auditSubassuntos.add(`${mat} -> ${ass} -> ${sub}`);

      if (!hierarchy[mat]) hierarchy[mat] = {};
      if (ass) {
        if (!hierarchy[mat][ass]) hierarchy[mat][ass] = new Set();
        if (sub && sub.toLowerCase() !== ass.toLowerCase()) {
          hierarchy[mat][ass].add(sub);
        }
      }
    });

    const debugLogs = `
      <div style="position:fixed; top:10px; left:10px; right:10px; z-index:99999; padding:15px; background:rgba(0,0,0,0.9); color:#0f0; border:2px solid #0f0; border-radius:8px; font-family:monospace; font-size:12px; max-height:400px; overflow-y:auto; text-align:left; box-shadow:0 0 20px #000;">
        <h3 style="color:#0f0; margin-top:0;">=== AUDITORIA JORNADA V2 ===</h3>
        <p>1. Executando consulta: db.collection('questoes').where('ativo', '==', true).get()</p>
        <p>2. Questões encontradas: <b>${qSnap.size}</b></p>
        <p>3. Matérias únicas: <b>${auditMaterias.size}</b></p>
        <p>4. Assuntos únicos: <b>${auditAssuntos.size}</b></p>
        <p>5. Subassuntos únicos: <b>${auditSubassuntos.size}</b></p>
        <hr style="border-color:#0f0;">
        <p><b>Matérias:</b> ${Array.from(auditMaterias).join(', ')}</p>
        <button onclick="this.parentElement.remove()" style="margin-top:10px; background:#0f0; color:#000; border:none; padding:5px 10px; cursor:pointer; font-weight:bold;">Fechar Debug</button>
      </div>
    `;

    // Injeta painel flutuante no body (impossível de não ver e não é apagado pelo render do mapa)
    const debugDiv = document.createElement('div');
    debugDiv.innerHTML = debugLogs;
    document.body.appendChild(debugDiv);

    if (qSnap.empty) {
      return;
    }


    // Busca conteúdos anexados pelo Admin
    const conteudos = {}; // chave: "materia|assunto|subassunto" (tudo minusculo para match facil)
    try {
      const cSnap = await db.collection('conteudos_jornada').where('ativo', '==', true).get();
      cSnap.forEach(doc => {
        const d = doc.data();
        const mat = (d.materia || '').trim().toLowerCase();
        const ass = (d.assunto || '').trim().toLowerCase();
        const sub = (d.subassunto || '').trim().toLowerCase();
        const key = `${mat}|${ass}|${sub}`;
        conteudos[key] = d;
      });
    } catch(e) {
      console.warn("Aviso: Não foi possível carregar conteudos_jornada. Verifique as regras do Firestore.", e);
    }


    // Garante que a Carreira principal Guarda Municipal exista
    if (!CARREIRAS['guarda_municipal']) {
      CARREIRAS['guarda_municipal'] = {
        id: 'guarda_municipal',
        nome: 'Guarda Municipal',
        emoji: '🚓',
        descricao: 'Trilha principal focada na Guarda Civil Municipal',
        cor: '#3B82F6',
        corGradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
        modulos: []
      };
    }
    
    CARREIRAS['guarda_municipal'].modulos = [];
    const carreira = CARREIRAS['guarda_municipal'];

    // Para ordenar as matérias (Módulos), vamos buscar a coleção 'materias'
    let materiasOrdem = {};
    try {
      const mSnap = await db.collection('materias').get();
      mSnap.forEach(doc => {
        const d = doc.data();
        materiasOrdem[(d.nome || '').trim().toLowerCase()] = d.ordem || 99;
      });
    } catch(e) {}

    // Constrói a trilha
    const materiasNomes = Object.keys(hierarchy);
    
    // Ordena as matérias com base na coleção materias (ou alfabética se não houver)
    materiasNomes.sort((a, b) => {
      const oa = materiasOrdem[a.toLowerCase()] || 99;
      const ob = materiasOrdem[b.toLowerCase()] || 99;
      if (oa !== ob) return oa - ob;
      return a.localeCompare(b);
    });

    materiasNomes.forEach(mat => {
      const modId = `mod_${mat.replace(/\s+/g, '_').toLowerCase()}`;
      const mod = {
        id: modId,
        nome: mat,
        icon: 'ph-folder',
        cor: carreira.cor,
        missoes: []
      };

      const assuntos = hierarchy[mat];
      
      for (const ass in assuntos) {
        const subassuntos = Array.from(assuntos[ass]);
        
        if (subassuntos.length > 0) {
          // Cada subassunto vira uma missão
          subassuntos.forEach(sub => {
            const cKey = `${mat.toLowerCase()}|${ass.toLowerCase()}|${sub.toLowerCase()}`;
            const cInfo = conteudos[cKey] || conteudos[`${mat.toLowerCase()}|${ass.toLowerCase()}|`] || {}; // fallback pro assunto se nao tiver sub
            
            mod.missoes.push({
              id: `missao_${mat}_${ass}_${sub}`.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
              nome: sub,
              materia: mat,
              assunto: ass,
              subassunto: sub,
              aprender_tipo: cInfo.aprender_tipo || null,
              aprender_url: cInfo.aprender_url || null,
              pdf_url: cInfo.resumo_pdf_url || null,
              xp: 100, // XP total aproximado
              ordem: cInfo.ordem || 99,
              isFinal: false // todas têm as 5 etapas, a etapa 5 é a final
            });
          });
        } else {
          // O próprio assunto vira a missão
          const cKey = `${mat.toLowerCase()}|${ass.toLowerCase()}|`;
          const cInfo = conteudos[cKey] || {};
          
          mod.missoes.push({
            id: `missao_${mat}_${ass}`.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
            nome: ass,
            materia: mat,
            assunto: ass,
            subassunto: '',
            aprender_tipo: cInfo.aprender_tipo || null,
            aprender_url: cInfo.aprender_url || null,
            pdf_url: cInfo.resumo_pdf_url || null,
            xp: 100,
            ordem: cInfo.ordem || 99,
            isFinal: false
          });
        }
      }

      // Ordena missões do módulo usando o campo ordem preenchido pelo admin
      mod.missoes.sort((a, b) => {
        if (a.ordem !== b.ordem) return a.ordem - b.ordem;
        return a.nome.localeCompare(b.nome);
      });

      if (mod.missoes.length > 0) {
        carreira.modulos.push(mod);
      }
    });

    // Força a carreira Guarda Municipal como a ativa para renderizar direto (ignorar seletor se só tem uma)
    if (!CARREIRA_ATIVA) CARREIRA_ATIVA = 'guarda_municipal';

    // Re-render
    if (typeof renderMapaCarreira === 'function') {
      renderMapaCarreira();
    }
  } catch (e) {
    console.error("Erro ao gerar missões a partir do Firebase:", e);
    alert("CRASH JORNADA: " + e.message);
  }
};

// Chamar ao carregar
setTimeout(() => {
  if (window.carregarMissoesFirebase) window.carregarMissoesFirebase();
}, 1000);
window.CARREIRAS = CARREIRAS;

// ─── Carreiras futuras (Em Breve) — Escalabilidade ───────────────────────────
// Gera entradas visuais para carreiras planejadas sem precisar reescrever a Jornada
const CARREIRAS_PLANEJADAS = [
  { id: 'prf',             nome: 'PRF',              emoji: '🚔', descricao: 'Polícia Rodoviária Federal — em breve.', cor: '#3B82F6' },
  { id: 'policia_federal', nome: 'Polícia Federal',  emoji: '🕵️', descricao: 'Agente e Escrivão da Polícia Federal.', cor: '#8B5CF6' },
  { id: 'policia_civil',   nome: 'Polícia Civil',    emoji: '🔍', descricao: 'Delegado, Investigador e Escrivão.', cor: '#EF4444' },
  { id: 'bombeiros',       nome: 'Bombeiros',        emoji: '🚒', descricao: 'Soldado e Cabo do Corpo de Bombeiros.', cor: '#F59E0B' },
  { id: 'agente_transito', nome: 'Agente de Trânsito', emoji: '🚦', descricao: 'Agente de Trânsito Municipal.', cor: '#10B981' },
  { id: 'guarda_portuaria',nome: 'Guarda Portuária', emoji: '⚓', descricao: 'Guarda Portuário e Segurança Patrimonial.', cor: '#06B6D4' },
];

// ─── Progress helpers ─────────────────────────────────────────────────────────
function carregarProgress() {
  try { JORNADA_PROGRESS = JSON.parse(localStorage.getItem(JORNADA_KEY) || '{}'); }
  catch(e) { JORNADA_PROGRESS = {}; }
}

function salvarProgress() {
  try {
    localStorage.setItem(JORNADA_KEY, JSON.stringify(JORNADA_PROGRESS));
    sincronizarCloud();
  } catch(e) {}
}

let _sincronizarTimeout = null;
window.sincronizarCloud = async function() {
  if (_sincronizarTimeout) clearTimeout(_sincronizarTimeout);
  _sincronizarTimeout = setTimeout(async () => {
    try {
      if (!window.firebase || !firebase.auth().currentUser) return;
      
      const payload = {
        jornada_progress: JORNADA_PROGRESS,
        jornada_carreira: CARREIRA_ATIVA,
        tempo_estudo: parseInt(localStorage.getItem(TEMPO_ESTUDO_KEY) || '0'),
        quiz_topic_stats: JSON.parse(localStorage.getItem('quiz_topic_stats') || '{}'),
        quiz_xp: parseInt(localStorage.getItem('quiz_xp') || '0'),
        quiz_streak: parseInt(localStorage.getItem('quiz_streak') || '0'),
        quiz_unlocked_badges: JSON.parse(localStorage.getItem('quiz_unlocked_badges') || '[]')
      };

      await firebase.firestore()
        .collection('users_progress').doc(firebase.auth().currentUser.uid)
        .set(payload, { merge: true });
        
      console.log("Progresso salvo no Firestore com sucesso.");
    } catch(e) {
      console.error("Erro ao salvar no Firestore:", e);
    }
  }, 2000);
}

window.baixarDadosCloud = async function() {
  try {
    if (!window.firebase || !firebase.auth().currentUser) return;
    const uid = firebase.auth().currentUser.uid;
    const docSnap = await firebase.firestore().collection('users_progress').doc(uid).get();
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.jornada_progress) localStorage.setItem(JORNADA_KEY, JSON.stringify(data.jornada_progress));
      if (data.jornada_carreira) localStorage.setItem(CARREIRA_KEY, data.jornada_carreira);
      if (data.tempo_estudo !== undefined) localStorage.setItem(TEMPO_ESTUDO_KEY, data.tempo_estudo);
      if (data.quiz_topic_stats) localStorage.setItem('quiz_topic_stats', JSON.stringify(data.quiz_topic_stats));
      if (data.quiz_xp !== undefined) localStorage.setItem('quiz_xp', data.quiz_xp);
      if (data.quiz_streak !== undefined) localStorage.setItem('quiz_streak', data.quiz_streak);
      if (data.quiz_unlocked_badges) localStorage.setItem('quiz_unlocked_badges', JSON.stringify(data.quiz_unlocked_badges));
      
      console.log("Progresso baixado do Firestore com sucesso.");
      
      // Reload in-memory variables
      carregarProgress();
      carregarCarreira();
      
      // Re-render UI
      if (typeof renderMissaoDoDia === 'function') renderMissaoDoDia();
      if (typeof renderJornadaHomeStats === 'function') renderJornadaHomeStats();
      if (typeof renderResumoDesempenho === 'function') renderResumoDesempenho();
      if (typeof renderMapList === 'function') renderMapList(CARREIRA_ATIVA);
    }
  } catch (e) {
    console.error("Erro ao baixar dados do Firestore:", e);
  }
}

function carregarCarreira() {
  CARREIRA_ATIVA = localStorage.getItem(CARREIRA_KEY) || null;
}

function salvarCarreira(id) {
  CARREIRA_ATIVA = id;
  localStorage.setItem(CARREIRA_KEY, id);
  if (window.sincronizarCloud) window.sincronizarCloud();
}

// ─── Registro de tempo de estudo ──────────────────────────────────────────────
function iniciarSessao() {
  _TEMPO_INICIO_SESSAO = Date.now();
}

function registrarTempoSessao() {
  if (!_TEMPO_INICIO_SESSAO) return;
  const mins = Math.round((Date.now() - _TEMPO_INICIO_SESSAO) / 60000);
  const total = parseInt(localStorage.getItem(TEMPO_ESTUDO_KEY) || '0') + mins;
  localStorage.setItem(TEMPO_ESTUDO_KEY, total);
  _TEMPO_INICIO_SESSAO = null;
  if (window.sincronizarCloud) window.sincronizarCloud();
}

function getTempoEstudado() {
  const mins = parseInt(localStorage.getItem(TEMPO_ESTUDO_KEY) || '0');
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ─── Achar próxima missão disponível na carreira ──────────────────────────────
function getProximaMissao(carreira) {
  if (!carreira) return null;
  carregarProgress();
  for (const mod of carreira.modulos) {
    for (let i = 0; i < mod.missoes.length; i++) {
      if (getMissaoState(mod.missoes[i], i, mod.missoes) === 'disponivel') {
        return { mod, missao: mod.missoes[i], modIdx: carreira.modulos.indexOf(mod) };
      }
    }
  }
  return null;
}

// ─── Desempenho por matéria (quiz_topic_stats) ───────────────────────────────
function getDesempenhoMaterias(carreira) {
  if (!carreira) return [];
  const tStats = (() => {
    try { return JSON.parse(localStorage.getItem('quiz_topic_stats') || '{}'); } catch(e) { return {}; }
  })();
  const vistos = new Set();
  const result = [];
  carreira.modulos.forEach(mod => {
    const materia = mod.nome;
    if (vistos.has(materia)) return;
    vistos.add(materia);
    const s = tStats[materia] || tStats[mod.missoes[0]?.materia] || { t: 0, c: 0 };
    const pct = s.t > 0 ? Math.round((s.c / s.t) * 100) : null;
    result.push({ nome: materia, cor: mod.cor, icon: mod.icon, pct, t: s.t });
  });
  return result.sort((a, b) => (a.pct ?? 50) - (b.pct ?? 50));
}

// ─── Estado de uma missão ─────────────────────────────────────────────────────
function getMissaoState(missao, idxNaLista, todasMissoes) {
  if (JORNADA_PROGRESS[missao.id]?.concluido) return 'concluida';
  if (idxNaLista === 0) return 'disponivel';
  const anterior = todasMissoes[idxNaLista - 1];
  if (anterior && JORNADA_PROGRESS[anterior.id]?.concluido) return 'disponivel';
  return 'bloqueada';
}

// ─── Progresso de um módulo ───────────────────────────────────────────────────
function getModuloProgress(modulo) {
  const total = modulo.missoes.length;
  const feitas = modulo.missoes.filter(m => JORNADA_PROGRESS[m.id]?.concluido).length;
  return { total, feitas, pct: total ? Math.round((feitas / total) * 100) : 0 };
}

// ─── Progresso geral da carreira ──────────────────────────────────────────────
function getCarreiraProgress(carreira) {
  let total = 0, feitas = 0;
  carreira.modulos.forEach(mod => {
    const p = getModuloProgress(mod);
    total += p.total; feitas += p.feitas;
  });
  return { total, feitas, pct: total ? Math.round((feitas / total) * 100) : 0 };
}

// ─── Buscar conteúdo Firebase para uma missão ─────────────────────────────────
async function buscarConteudoMissao(missao) {
  const chave = missao.materia.toLowerCase().trim();
  if (FIREBASE_CONTENT[chave]) return FIREBASE_CONTENT[chave];

  try {
    const db = firebase.firestore();

    // Busca no CMS de aulas (materias_aulas) por nome da matéria usando cache
    const materiasAulas = typeof window.getMateriasAulas === 'function' ? await window.getMateriasAulas() : [];
    let cms = null;
    for (const d of materiasAulas) {
      const nomeCms = (d.name || '').toLowerCase().trim();
      if (nomeCms === chave || chave.includes(nomeCms) || nomeCms.includes(chave)) {
        cms = d;
        break;
      }
    }

    // Busca questões filtradas pela matéria
    let questoesCount = 0;
    try {
      const qSnap = await db.collection('questoes')
        .where('ativo', '==', true)
        .where('materia', '==', missao.materia)
        .get();
      questoesCount = qSnap.size;
    } catch(e) {
      // Fallback sem filtro composto
      try {
        const qSnap2 = await db.collection('questoes').where('materia', '==', missao.materia).get();
        questoesCount = qSnap2.size;
      } catch(e2) {}
    }

    // Busca flashcards
    let flashCount = 0;
    try {
      const fSnap = await db.collection('flashcards').where('materia', '==', missao.materia).get();
      flashCount = fSnap.size;
    } catch(e) {}

    const conteudo = {
      cmsId:     cms?.id || null,
      videos:    cms?.videos    || [],
      audios:    cms?.audios    || [],
      slides:    cms?.slides    || [],
      questoes:  questoesCount,
      flashcards: flashCount,
    };

    FIREBASE_CONTENT[chave] = conteudo;
    return conteudo;
  } catch(e) {
    console.warn('Erro ao buscar conteúdo:', e);
    return { cmsId: null, videos: [], audios: [], slides: [], questoes: 0, flashcards: 0 };
  }
}

// ─── RENDER: Seleção de Carreira ─────────────────────────────────────────────
function renderSelecaoCarreira() {
  const container = document.getElementById('jornadaContainer');
  if (!container) return;

  // Carreiras ativas
  const ativasHTML = Object.values(CARREIRAS).map(c => `
    <button class="carreira-card" onclick="selecionarCarreira('${c.id}')" id="cc_${c.id}">
      <div class="carreira-card-left">
        <div class="carreira-card-emoji" style="background:${c.cor}18; border-color:${c.cor}44;">${c.emoji}</div>
        <div class="carreira-card-info">
          <div class="carreira-card-nome">${c.nome}</div>
          <div class="carreira-card-desc">${c.descricao}</div>
          <div class="carreira-card-meta">${c.modulos.length} módulos · ${c.modulos.reduce((a,m)=>a+m.missoes.length,0)} missões</div>
        </div>
      </div>
      <i class="ph ph-arrow-right carreira-card-arrow"></i>
    </button>
  `).join('');

  // Carreiras futuras (Em Breve) — escalabilidade
  const futurasHTML = CARREIRAS_PLANEJADAS.map(c => `
    <button class="carreira-card em-breve" disabled id="cc_${c.id}">
      <div class="carreira-card-left">
        <div class="carreira-card-emoji" style="background:${c.cor}18; border-color:${c.cor}44;">${c.emoji}</div>
        <div class="carreira-card-info">
          <div class="carreira-card-nome">${c.nome}</div>
          <div class="carreira-card-desc">${c.descricao}</div>
          <div class="carreira-em-breve-badge"><i class="ph-fill ph-clock"></i> Em breve</div>
        </div>
      </div>
    </button>
  `).join('');

  container.innerHTML = `
    <div class="carreira-selection-header">
      <div class="carreira-sel-emoji">🎯</div>
      <h2 class="carreira-sel-title">Escolha sua Carreira</h2>
      <p class="carreira-sel-sub">Selecione o concurso para o qual deseja se preparar</p>
    </div>
    <div class="carreira-cards-list">
      ${ativasHTML}
      ${futurasHTML}
    </div>
  `;
}

// ─── Selecionar carreira ──────────────────────────────────────────────────────
window.selecionarCarreira = function(id) {
  if (!CARREIRAS[id]) return;
  salvarCarreira(id);
  renderMapaCarreira();
};

// ─── 3. PROGRESSO VISUAL DA CARREIRA: gera barra estilo blocos ───────────────
function gerarBarraBlocos(pct, total = 10) {
  const cheios = Math.round((pct / 100) * total);
  const vazios = total - cheios;
  const blocosCheios = '█'.repeat(cheios);
  const blocosVazios = '░'.repeat(vazios);
  return blocosCheios + blocosVazios;
}

// ─── RENDER: Mapa da Carreira (lista de módulos) + Progresso Visual ─────────
function renderMapaCarreira() {
  const carreira = CARREIRAS[CARREIRA_ATIVA];
  if (!carreira) { renderSelecaoCarreira(); return; }

  carregarProgress();
  const { total, feitas, pct } = getCarreiraProgress(carreira);
  const container = document.getElementById('jornadaContainer');
  const xp     = parseInt(localStorage.getItem('quiz_xp') || '0');
  const streak = parseInt(localStorage.getItem('quiz_streak') || '0');
  const tempo  = getTempoEstudado();

  // Acha o primeiro módulo não concluído
  let moduloAtualIdx = carreira.modulos.findIndex(mod => {
    const { feitas, total } = getModuloProgress(mod);
    return feitas < total;
  });
  if (moduloAtualIdx < 0) moduloAtualIdx = carreira.modulos.length - 1;

  // 7. Desempenho por matéria com cores expressivas
  const desempenho = getDesempenhoMaterias(carreira);
  const desempenhoHTML = desempenho.length > 0 ? `
    <div class="desempenho-section">
      <div class="dsm-title"><i class="ph-fill ph-chart-bar" style="color:var(--primary);"></i> Desempenho por Matéria</div>
      ${desempenho.map(d => {
        const corPct = d.pct === null ? 'var(--text-muted)' : d.pct >= 80 ? '#10B981' : d.pct >= 60 ? '#F59E0B' : '#EF4444';
        const alertIcon = d.pct !== null && d.pct < 60
          ? `<i class="ph-fill ph-warning" style="color:#EF4444; font-size:13px; margin-left:4px;" title="Ponto fraco!"></i>`
          : (d.pct !== null && d.pct >= 80 ? `<i class="ph-fill ph-check-circle" style="color:#10B981; font-size:13px; margin-left:4px;"></i>` : '');
        const dsmpct = d.pct !== null ? d.pct : 0;
        const barColor = d.pct === null
          ? 'rgba(255,255,255,0.1)'
          : `linear-gradient(90deg, ${d.pct < 60 ? '#EF4444' : d.pct < 80 ? '#F59E0B' : '#10B981'}, ${d.cor})`;
        return `
        <div class="dsm-row">
          <div class="dsm-nome">
            <i class="ph-fill ${d.icon}" style="color:${d.cor};"></i>
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis;">${d.nome}</span>
            ${alertIcon}
          </div>
          <div class="dsm-bar-wrap">
            <div class="dsm-bar">
              <div class="dsm-fill" style="width:${dsmpct}%; background:${barColor};"></div>
            </div>
            <span class="dsm-pct" style="color:${corPct}">
              ${d.pct !== null ? d.pct + '%' : '—'}
            </span>
          </div>
        </div>`;
      }).join('')}
    </div>` : '';

  // ─── Próximas missões disponíveis (até 3) ──────────────────────────────────
  const proximasMissoes = [];
  for (const mod of carreira.modulos) {
    for (let i = 0; i < mod.missoes.length; i++) {
      if (proximasMissoes.length >= 3) break;
      const state = getMissaoState(mod.missoes[i], i, mod.missoes);
      if (state === 'disponivel') {
        proximasMissoes.push({ missao: mod.missoes[i], mod });
      }
    }
    if (proximasMissoes.length >= 3) break;
  }

  const proximasMissoesHTML = proximasMissoes.length > 0 ? `
    <div class="carreira-proximas-missoes">
      <div class="cpm-title"><i class="ph-fill ph-map-pin"></i> Próximas Missões</div>
      ${proximasMissoes.map(({ missao, mod }) => `
        <div class="cpm-item" onclick="abrirModalMissao('${mod.id}','${missao.id}')">
          <div class="cpm-dot" style="background:${mod.cor}; box-shadow:0 0 6px ${mod.cor}80;"></div>
          <div class="cpm-info">
            <div class="cpm-nome">${missao.nome}</div>
            <div class="cpm-mod">${mod.nome}</div>
          </div>
          <i class="ph ph-arrow-right cpm-arrow"></i>
        </div>
      `).join('')}
    </div>` : '';

  // Módulos concluídos
  const modulosConcluidos = carreira.modulos.filter(mod => {
    const p = getModuloProgress(mod);
    return p.feitas === p.total;
  }).length;

  // ─── Hero Card Premium ──────────────────────────────────────────────────────
  const heroHTML = `
    <div class="carreira-hero-card">
      <div class="carreira-hero-top">
        <div class="carreira-hero-emoji">${carreira.emoji}</div>
        <div class="carreira-hero-info">
          <div class="carreira-hero-tag"><i class="ph-fill ph-shield-star"></i> Sua Carreira</div>
          <div class="carreira-hero-nome">${carreira.nome}</div>
          <div class="carreira-hero-sub">${carreira.descricao.split('.')[0]}</div>
        </div>
        <button class="btn-sm" onclick="trocarCarreira()" style="flex-shrink:0; align-self:flex-start; display:flex; align-items:center; gap:6px;">
          <i class="ph ph-arrows-left-right"></i> Trocar Carreira
        </button>
      </div>

      <div class="carreira-hero-pills">
        <div class="hero-pill"><i class="ph-fill ph-trophy" style="color:#F59E0B;"></i> ${pct}% concluído</div>
        <div class="hero-pill"><i class="ph-fill ph-books" style="color:#A78BFA;"></i> ${modulosConcluidos}/${carreira.modulos.length} módulos</div>
        <div class="hero-pill"><i class="ph-fill ph-fire" style="color:#F87171;"></i> ${streak} dia${streak !== 1 ? 's' : ''}</div>
      </div>

      <div class="carreira-hero-progress-section">
        <div class="carreira-hero-progress-label">
          <span>Progresso Geral</span>
          <span class="carreira-hero-pct">${feitas} / ${total} missões</span>
        </div>
        <div class="carreira-hero-bar-track">
          <div class="carreira-hero-bar-fill" style="width:${pct}%;"></div>
        </div>
      </div>

      ${proximasMissoesHTML}

      ${feitas < total ? `
        <button class="carreira-hero-btn" onclick="${proximasMissoes.length > 0 ? `abrirModalMissao('${proximasMissoes[0].mod.id}','${proximasMissoes[0].missao.id}')` : `go('jornada')`}">
          <i class="ph-fill ph-play-circle"></i> Continuar de onde parei
        </button>` : `
        <div style="text-align:center; padding:16px 0 0; color:#10B981; font-weight:800; font-size:15px; position:relative; z-index:2;">
          <i class="ph-fill ph-seal-check" style="font-size:20px;"></i> Trilha Concluída! Parabéns!
        </div>`}
    </div>
  `;

  container.innerHTML = `
    ${heroHTML}

    <div class="modulos-section-title">
      <i class="ph-fill ph-list-bullets"></i> Módulos da Trilha
    </div>

    <div class="mapa-modulos-trail" id="mapaModulosTrail">
      ${carreira.modulos.map((mod, idx) => renderUnidadeDuolingo(mod, idx, moduloAtualIdx, carreira)).join('')}
    </div>

    ${desempenhoHTML}
  `;

  iniciarSessao();
  
  // Auto-scroll para o módulo atual
  setTimeout(() => {
    const elAtual = document.querySelector('.mod-atual-scroll');
    if(elAtual) elAtual.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
}

// ─── Renderização de Unidade Contínua (Módulo + Missões estilo Duolingo) ─────
function renderUnidadeDuolingo(mod, idx, moduloAtualIdx, carreira) {
  const { total, feitas, pct } = getModuloProgress(mod);
  const completo = feitas === total;
  const isAtual  = idx === moduloAtualIdx;
  const bloqueado = idx > 0 && (() => {
    const { feitas: fAntes, total: tAntes } = getModuloProgress(carreira.modulos[idx - 1]);
    return fAntes < tAntes;
  })();

  const headerHTML = `
    <div class="duo-unit-header ${bloqueado ? 'duo-unit-locked' : ''}" style="background-color: ${bloqueado ? 'rgba(255,255,255,0.05)' : mod.cor}; ${isAtual ? 'box-shadow: 0 0 20px ' + mod.cor + '88;' : ''} ${isAtual ? 'border: 2px solid #fff;' : ''}">
      <div class="duo-unit-info">
        <h3 class="duo-unit-title">Unidade ${idx + 1}</h3>
        <p class="duo-unit-desc">${mod.nome}</p>
      </div>
      <div class="duo-unit-icon" style="color: ${bloqueado ? 'rgba(255,255,255,0.2)' : '#fff'};">
         ${bloqueado ? '<i class="ph ph-lock"></i>' : completo ? '<i class="ph-fill ph-check-circle"></i>' : `<i class="ph-fill ${mod.icon}"></i>`}
      </div>
    </div>
  `;

  let missoesHTML = '';
  mod.missoes.forEach((missao, mIdx) => {
    // Se o módulo está bloqueado, todas as missões estão bloqueadas
    let state = 'bloqueada';
    if (!bloqueado) {
       state = getMissaoState(missao, mIdx, mod.missoes);
    }
    const prog  = JORNADA_PROGRESS[missao.id] || {};

    const lado = mIdx % 2 === 0 ? 'left' : 'right';
    const hasNext = mIdx < mod.missoes.length - 1;
    // Conector do próximo
    let nextState = 'bloqueada';
    if (!bloqueado && hasNext) {
        nextState = getMissaoState(mod.missoes[mIdx+1], mIdx+1, mod.missoes);
    }
    const connectorClass = hasNext ? `duo-connector ${state === 'concluida' ? 'conector-ativo' : ''} conector-to-${mIdx % 2 === 0 ? 'right' : 'left'}` : '';

    missoesHTML += `
      <div class="no-missao-wrapper ${state === 'disponivel' ? 'mod-atual-scroll' : ''}">
        <div class="no-missao-row no-${lado}">
          <div class="no-missao no-${state} ${missao.isFinal ? 'no-final' : ''}"
               onclick="${state !== 'bloqueada' ? `abrirModalMissao('${mod.id}','${missao.id}')` : ''}"
               style="${state !== 'bloqueada' && !completo ? `box-shadow: 0 8px 0 ${mod.cor}88;` : ''}">
            <div class="no-circulo ${state === 'concluida' ? 'no-cir-ok' : state === 'bloqueada' ? 'no-cir-lock' : 'no-cir-play'}"
                 style="background-color: ${state === 'bloqueada' ? '#1E293B' : mod.cor};">
              ${state === 'concluida'
                ? `<i class="ph-bold ph-check" style="font-size:24px; color:#ffffff; filter: drop-shadow(0 0 4px rgba(255,255,255,0.5));"></i>`
                : state === 'bloqueada'
                ? `<i class="ph-fill ph-lock" style="font-size:24px; color:rgba(255,255,255,0.3);"></i>`
                : missao.isFinal
                ? `<i class="ph-fill ph-trophy" style="font-size:28px; color:#fff;"></i>`
                : `<i class="ph-fill ph-star" style="font-size:28px; color:#fff;"></i>`
              }
              ${state === 'disponivel' ? `<div class="no-pulse" style="box-shadow:0 0 0 0 ${mod.cor}; animation: pulseRing 2s infinite cubic-bezier(0.66, 0, 0, 1);"></div>` : ''}
              ${state === 'disponivel' ? `<div class="duo-floating-start" style="animation: bounceSoft 2s infinite;">INICIAR</div>` : ''}
            </div>
          </div>
        </div>
        ${hasNext ? `<div class="${connectorClass}" style="background-color: ${state === 'concluida' ? mod.cor : '#1E293B'}; opacity: ${state === 'bloqueada' ? 0.3 : 1};"></div>` : ''}
      </div>
    `;
  });

  return `
    <div class="duo-unit-container">
      ${headerHTML}
      <div class="missoes-trail duo-trail">
        ${missoesHTML}
      </div>
    </div>
  `;
}

// ─── Modal de Missão → redireciona para Fluxo de 5 Etapas ────────────────────
window.abrirModalMissao = function(modId, missaoId) {
  if (typeof window.iniciarFluxoMissao === 'function') {
    window.iniciarFluxoMissao(modId, missaoId);
  } else {
    console.error('[Jornada] missao-flow.js não carregado.');
  }
};



// ─── Ações de navegação da missão ─────────────────────────────────────────────
window.irParaBiblioteca = function(cmsId, modId, missaoId) {
  fecharMissaoModal();
  if (typeof window.go === 'function') {
    window.go('resumos');
    setTimeout(() => {
      if (typeof window.openSubject === 'function') window.openSubject(cmsId);
    }, 300);
  }
  // Salva pendência, conclui após 5s na biblioteca
  setTimeout(() => concluirMissao(modId, missaoId, { tipo: 'biblioteca', acertos: 0 }), 5000);
};

window.irParaQuestoes = function(materia, modId, missaoId, qtd) {
  fecharMissaoModal();
  window._jornada_pending_no = { modId, missaoId, materia, qtd };
  if (typeof window.go === 'function') {
    window.go('quiz');
    setTimeout(() => {
      const select = document.getElementById('topicSelect');
      if (select) {
        for (let opt of select.options) {
          if (opt.value.toLowerCase().trim() === materia.toLowerCase().trim()) {
            select.value = opt.value; break;
          }
        }
      }
      if (document.getElementById('simuladosDashboard'))
        document.getElementById('simuladosDashboard').style.display = 'none';
      if (document.getElementById('classicTopicSelection'))
        document.getElementById('classicTopicSelection').style.display = 'flex';
      if (typeof window.startRapidClassicJornada === 'function')
        window.startRapidClassicJornada(materia, qtd, modId, missaoId);
      else if (typeof window.startRapidClassic === 'function')
        window.startRapidClassic();
    }, 600);
  }
};

window.concluirMissaoManual = function(modId, missaoId) {
  fecharMissaoModal();
  concluirMissao(modId, missaoId, { tipo: 'manual', acertos: 0 });
  setTimeout(() => {
    const carreira = CARREIRAS[CARREIRA_ATIVA];
    const idx = carreira?.modulos.findIndex(m => m.id === modId) ?? -1;
    if (idx >= 0) abrirModulo(idx);
  }, 600);
};

// ─── Conclusão de missão ──────────────────────────────────────────────────────
window.concluirMissao = function(modId, missaoId, dados = {}) {
  carregarProgress();
  if (JORNADA_PROGRESS[missaoId]?.concluido) return;

  JORNADA_PROGRESS[missaoId] = {
    concluido:  true,
    timestamp:  Date.now(),
    acertos:    dados.acertos   ?? 0,
    tentativas: (JORNADA_PROGRESS[missaoId]?.tentativas || 0) + 1,
    tipo:       dados.tipo      || 'manual',
  };
  salvarProgress();
  registrarTempoSessao();

  const carreira = CARREIRAS[CARREIRA_ATIVA];
  const mod = carreira?.modulos.find(m => m.id === modId);
  const missao = mod?.missoes.find(m => m.id === missaoId);
  const xp = missao?.xp || JORNADA_XP_BONUS.missao;

  if (typeof window.addXP === 'function') window.addXP(xp);

  // Avisa Admin
  try {
    if (window.firebase && firebase.auth().currentUser) {
      const user = firebase.auth().currentUser;
      firebase.firestore().collection('notificacoes_admin').add({
        tipo: 'missao_concluida',
        uid: user.uid,
        nome: user.displayName || 'Aluno',
        email: user.email || '',
        missaoId: missaoId,
        missaoNome: missao ? missao.nome : 'Missão Desconhecida',
        carreira: CARREIRA_ATIVA,
        acertos: dados.acertos || 0,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch(e) {}

  // Verifica se módulo foi concluído
  if (mod) {
    const { feitas, total } = getModuloProgress(mod);
    if (feitas === total) {
      if (typeof window.addXP === 'function') window.addXP(JORNADA_XP_BONUS.modulo);
      mostrarRecompensaModulo(mod);
    } else {
      mostrarToastXP(xp);
    }
  }

  // Atualiza cards da home
  if (typeof renderMissaoDoDia === 'function') renderMissaoDoDia();
  if (typeof renderJornadaHomeStats === 'function') renderJornadaHomeStats();

  // Re-renderiza trilha se estiver aberta
  if (MODULO_ATIVO_IDX !== null && mod) {
    const idx = carreira?.modulos.indexOf(mod);
    if (idx >= 0) setTimeout(() => abrirModulo(idx), 500);
  }
};

// ─── Toasts / Celebração ──────────────────────────────────────────────────────
function mostrarToastXP(xp) {
  let t = document.getElementById('jornadaToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'jornadaToast';
    t.className = 'jornada-toast';
    document.body.appendChild(t);
  }
  t.innerHTML = `<i class="ph-fill ph-star"></i> +${xp} XP conquistado!`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ─── 4. RECOMPENSAS DE MÓDULO — Animação premium ─────────────────────────────
function mostrarRecompensaModulo(mod) {
  // Confetti em 4 rajadas escalonadas para impacto máximo
  if (window.confetti) {
    confetti({ particleCount: 200, spread: 120, origin: { y: 0.2 }, colors: [mod.cor, '#fff', '#F59E0B', '#10B981'] });
    setTimeout(() => confetti({ particleCount: 150, spread: 90,  origin: { y: 0.4 }, colors: [mod.cor, '#F59E0B'] }), 400);
    setTimeout(() => confetti({ particleCount: 100, spread: 70,  origin: { y: 0.6 }, colors: ['#fff', '#F59E0B', mod.cor] }), 900);
    setTimeout(() => confetti({ particleCount: 60,  spread: 40,  angle: 60,  origin: { x: 0, y: 0.5 }, colors: [mod.cor, '#F59E0B'] }), 1300);
    setTimeout(() => confetti({ particleCount: 60,  spread: 40,  angle: 120, origin: { x: 1, y: 0.5 }, colors: [mod.cor, '#F59E0B'] }), 1300);
  }

  // Salva badge de módulo
  try {
    const badges = JSON.parse(localStorage.getItem('quiz_unlocked_badges') || '[]');
    const badgeId = `modulo_${mod.id}`;
    if (!badges.includes(badgeId)) {
      badges.push(badgeId);
      localStorage.setItem('quiz_unlocked_badges', JSON.stringify(badges));
      if (window.sincronizarCloud) window.sincronizarCloud();
    }
  } catch(e) {}

  // Calcula XP total de missões do módulo para exibir corretamente
  const xpModulo = JORNADA_XP_BONUS.modulo;

  // Modal de recompensa com animação premium
  let overlay = document.getElementById('recompensaModuloOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'recompensaModuloOverlay';
    overlay.className = 'recompensa-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) fecharRecompensa(); };
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="recompensa-card">
      <div class="recompensa-glow" style="background:${mod.cor};"></div>
      <div class="recompensa-stars">
        <span class="recompensa-star" style="animation-delay:0.1s">⭐</span>
        <span class="recompensa-star" style="animation-delay:0.2s">⭐</span>
        <span class="recompensa-star" style="animation-delay:0.3s">⭐</span>
      </div>
      <div class="recompensa-trophy">🏆</div>
      <div class="recompensa-titulo">Módulo Concluído!</div>
      <div class="recompensa-nome" style="color:${mod.cor};">${mod.nome}</div>
      <div class="recompensa-recompensas">
        <div class="recompensa-item" style="animation-delay:0.25s">
          <i class="ph-fill ph-star" style="color:#F59E0B;"></i>
          <span>+${xpModulo} XP Conquistados</span>
        </div>
        <div class="recompensa-item" style="animation-delay:0.42s">
          <i class="ph-fill ph-medal" style="color:#C0A060;"></i>
          <span>Medalha de ${mod.nome}</span>
        </div>
        <div class="recompensa-item" style="animation-delay:0.59s">
          <i class="ph-fill ph-seal-check" style="color:${mod.cor};"></i>
          <span>Badge exclusivo no perfil</span>
        </div>
      </div>
      <button class="btn btn-primary recompensa-btn" onclick="fecharRecompensa()" style="background: linear-gradient(135deg, ${mod.cor}, ${mod.cor}bb);">
        <i class="ph-fill ph-rocket-launch"></i> Continuar Jornada
      </button>
      <p class="recompensa-dica">Toque fora para fechar</p>
    </div>
  `;

  // Remove e re-insere para forçar reinício da animação CSS
  overlay.classList.remove('show');
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));
}

window.fecharRecompensa = function() {
  const overlay = document.getElementById('recompensaModuloOverlay');
  if (overlay) overlay.classList.remove('show');
};

// ─── Fechar modal ─────────────────────────────────────────────────────────────
window.fecharMissaoModal = function() {
  const modal = document.getElementById('missaoModal');
  if (modal) modal.classList.remove('show');
};

window.trocarCarreira = function() {
  MODULO_ATIVO_IDX = null;
  renderSelecaoCarreira();
};

// ─── RENDER PRINCIPAL da Jornada ─────────────────────────────────────────────
window.renderJornada = function() {
  carregarProgress();
  carregarCarreira();
  if (!CARREIRA_ATIVA || !CARREIRAS[CARREIRA_ATIVA]) {
    renderSelecaoCarreira();
  } else {
    renderMapaCarreira();
  }
};

// ─── 2. MISSÃO DO DIA — Lógica contextual e visual refinada ─────────────────
window.renderMissaoDoDia = function() {
  const container = document.getElementById('missaoDoDiaCard');
  const body = document.getElementById('mddContentBody');
  if (!container || !body) return;

  carregarProgress();
  carregarCarreira();

  const carreira = CARREIRAS[CARREIRA_ATIVA];
  if (!carreira) {
    body.innerHTML = `
      <div onclick="go('jornada')" style="cursor:pointer; text-align:center;">
        <div style="font-size:16px; font-weight:800; color:var(--text-main); margin-bottom:4px;">Comece sua Jornada</div>
        <div style="font-size:13px; color:var(--text-muted);">Toque para escolher uma carreira e ver trilhas</div>
      </div>`;
    return;
  }

  const proximo = getProximaMissao(carreira);

  if (!proximo) {
    body.innerHTML = `
      <div style="text-align:center;">
        <i class="ph-fill ph-check-circle" style="color:var(--success); font-size:40px; margin-bottom:8px;"></i>
        <div style="font-size:16px; font-weight:800; color:var(--text-main); margin-bottom:4px;">Incrível! Jornada em dia! 🎉</div>
        <div style="font-size:13px; color:var(--text-muted); margin-bottom:14px;">Continue praticando com os Simulados.</div>
        <button class="btn btn-secondary" style="width:100%; border-radius:14px;" onclick="go('quiz')"><i class="ph-fill ph-trophy"></i> Fazer Simulado</button>
      </div>`;
    return;
  }

  const { mod, missao } = proximo;

  body.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <div style="flex:1;">
        <div style="font-size:18px; font-weight:800; color:var(--text-main); margin-bottom:4px; line-height:1.2;">${missao.nome}</div>
        <div style="font-size:13px; color:var(--text-muted); font-weight:600;"><i class="ph-fill ${mod.icon}" style="color:${mod.cor};"></i> ${mod.nome}</div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; margin-left:12px;">
        <span style="background:rgba(245,158,11,0.2); border:1px solid rgba(245,158,11,0.4); color:#FBBF24; padding:4px 8px; border-radius:8px; font-size:13px; font-weight:800; white-space:nowrap;"><i class="ph-fill ph-star"></i> +${missao.xp} XP</span>
        <span style="font-size:12px; color:var(--text-muted); font-weight:700;"><i class="ph-fill ph-clock"></i> ${missao.tempoMin} min</span>
      </div>
    </div>
    <button class="btn btn-primary" onclick="continuarJornada()" style="width:100%; padding:14px; border-radius:14px; font-size:16px; box-shadow:0 4px 15px rgba(16,185,129,0.3); background:linear-gradient(135deg, #10B981, #059669);"><i class="ph-fill ph-play-circle"></i> Iniciar Agora</button>
  `;
};

// ─── Continuar Jornada ────────────────────────────────────────────────────────
window.continuarJornada = function() {
  carregarCarreira();
  carregarProgress();
  const carreira = CARREIRAS[CARREIRA_ATIVA];
  if (!carreira) { go('jornada'); return; }
  const proximo = getProximaMissao(carreira);
  if (!proximo) { go('jornada'); return; }
  const { mod, missao, modIdx } = proximo;
  // Vai direto para o fluxo da missão (sem navegar manualmente)
  if (typeof window.go === 'function') window.go('jornada');
  setTimeout(() => {
    if (typeof window.iniciarFluxoMissao === 'function') {
      window.iniciarFluxoMissao(mod.id, missao.id);
    } else {
      // Fallback: abre o módulo e o modal
      abrirModulo(modIdx);
      setTimeout(() => abrirModalMissao(mod.id, missao.id), 400);
    }
  }, 200);
};

// ─── 1. CONTINUAR JORNADA — Card com progresso do módulo ─────────────────────
window.renderJornadaHomeStats = function() {
  carregarProgress();
  carregarCarreira();
  const carreira = CARREIRAS[CARREIRA_ATIVA];

  // Strip de progresso da jornada (barra inferior da home)
  const el  = document.getElementById('jornadaHomeProgress');
  const bar = document.getElementById('jornadaHomeFill');
  if (carreira) {
    const { total, feitas, pct } = getCarreiraProgress(carreira);
    if (el)  el.innerHTML = `${carreira.emoji} ${carreira.nome} · ${feitas}/${total} missões · ${pct}%`;
    if (bar) bar.style.width = pct + '%';
  }

  // Card "Continuar Jornada"
  const card = document.getElementById('continuarJornadaCard');
  if (!card) return;
  if (!carreira) { card.style.display = 'none'; return; }

  const proximo = getProximaMissao(carreira);
  if (!proximo) { card.style.display = 'none'; return; }

  const { mod, missao, modIdx } = proximo;
  const { feitas: modFeitas, total: modTotal, pct: modPct } = getModuloProgress(mod);
  const missaoNum = mod.missoes.findIndex(m => m.id === missao.id) + 1;

  card.style.display = 'block';

  // Atualiza elementos do card
  const cNome = document.getElementById('cjcCarreiraNome');
  const nm = document.getElementById('cjcMissaoNome');
  const md = document.getElementById('cjcModuloNome');
  const porc = document.getElementById('cjcPorcentagem');
  const progBar = document.getElementById('cjcProgressoBar');

  if (cNome) cNome.textContent = carreira.nome;
  if (nm) nm.textContent = `Missão ${missaoNum} - ${missao.nome}`;
  if (md) md.textContent = `${mod.nome}`;
  if (porc) porc.textContent = `${modPct}% concluído`;
  if (progBar) {
    progBar.style.width = `${modPct}%`;
    progBar.style.background = mod.cor;
  }

  // Cor dinâmica do card via CSS custom property
  const cjcCard = card.querySelector('.continuar-jornada-card');
  if (cjcCard) {
    cjcCard.style.setProperty('--cjc-cor', mod.cor);
    cjcCard.style.borderColor = `${mod.cor}55`;
  }
};

// ─── Hook: quiz finalizado pela Jornada ───────────────────────────────────────
window.jornadaOnQuizFinish = function(score, total, materia) {
  const pending = window._jornada_pending_no;
  if (!pending) return;
  window._jornada_pending_no = null;
  concluirMissao(pending.modId, pending.missaoId, { tipo: 'questoes', acertos: score });
};

// ─── Perfil: estatísticas da Jornada ─────────────────────────────────────────
window.renderPerfil = function() {
  carregarProgress();
  const user    = window.firebase && firebase.auth().currentUser;
  const xp      = parseInt(localStorage.getItem('quiz_xp') || '0');
  const streak  = parseInt(localStorage.getItem('quiz_streak') || '0');
  const rank    = typeof getRankName === 'function' ? getRankName(xp) : 'Recruta';
  const badges  = JSON.parse(localStorage.getItem('quiz_unlocked_badges') || '[]');

  const carreira = CARREIRAS[CARREIRA_ATIVA];
  const { total: totalMissoes, feitas: missoesConcluidas } = carreira
    ? getCarreiraProgress(carreira) : { total: 0, feitas: 0 };

  const avatarLetter = (user?.displayName || user?.email || 'U')[0].toUpperCase();
  const nome  = user?.displayName || 'Estudante';
  const email = user?.email || '';

  const container = document.getElementById('perfilContent');
  if (!container) return;

  container.innerHTML = `
    <div class="perfil-avatar-ring">
      <div class="perfil-avatar">${avatarLetter}</div>
    </div>
    <h2 class="perfil-nome">${nome}</h2>
    <p class="perfil-email">${email}</p>
    ${carreira ? `<div class="perfil-carreira-badge" style="background:${carreira.cor}22; border:1px solid ${carreira.cor}44; color:${carreira.cor};">
      ${carreira.emoji} ${carreira.nome}
    </div>` : ''}
    <div class="perfil-stats-grid">
      <div class="perfil-stat">
        <div class="perfil-stat-val" style="color:#F59E0B;"><i class="ph-fill ph-fire"></i> ${streak}</div>
        <div class="perfil-stat-label">Dias Seguidos</div>
      </div>
      <div class="perfil-stat">
        <div class="perfil-stat-val" style="color:#7C3AED;">${xp}</div>
        <div class="perfil-stat-label">XP Total</div>
      </div>
      <div class="perfil-stat">
        <div class="perfil-stat-val" style="color:#10B981;">${missoesConcluidas}</div>
        <div class="perfil-stat-label">Missões</div>
      </div>
      <div class="perfil-stat">
        <div class="perfil-stat-val" style="color:#3B82F6;">${rank}</div>
        <div class="perfil-stat-label">Patente</div>
      </div>
    </div>
    


    <div class="perfil-section-title"><i class="ph-fill ph-trophy"></i> Conquistas</div>
    <div class="perfil-badges-grid" id="perfilBadgesGrid"></div>
    <button class="btn btn-secondary" style="width:100%; margin-top:24px;" onclick="logoutUser()">
      <i class="ph ph-sign-out"></i> Sair da Conta
    </button>
  `;

  const BADGES_LIST = [
    { id: 'first_blood', name: 'Iniciante',  icon: 'ph-footprints' },
    { id: 'streak_3',   name: 'Focado',      icon: 'ph-fire'       },
    { id: 'streak_7',   name: 'Maratonista', icon: 'ph-sneaker'    },
    { id: 'mestre',     name: 'Mestre',      icon: 'ph-crown'      },
    { id: 'grande_dia', name: 'Aprovado',    icon: 'ph-star'       },
  ];
  const grid = document.getElementById('perfilBadgesGrid');
  if (grid) {
    BADGES_LIST.forEach(b => {
      const un = badges.includes(b.id);
      grid.innerHTML += `
        <div class="badge-item ${un ? 'unlocked' : ''}">
          <div class="badge-icon"><i class="ph-fill ${b.icon}"></i></div>
          <div class="badge-name">${b.name}</div>
        </div>`;
    });
  }
};

// ─── Inicialização ────────────────────────────────────────────────────────────
(function init() {
  carregarProgress();
  carregarCarreira();
  const render = () => {
    renderMissaoDoDia();
    renderJornadaHomeStats();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    setTimeout(render, 100);
  }
  // Registra tempo ao sair da página
  window.addEventListener('beforeunload', registrarTempoSessao);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) registrarTempoSessao(); else iniciarSessao();
  });
})();

window.CARREIRAS = CARREIRAS;
