/* =====================================================
   MISSÃO FLOW — PlenAula
   Fluxo de 5 Etapas: Aprender → Exercícios → Revisão
                       → Resumo Rápido → Missão Final
   Resiliente: funciona parcialmente mesmo sem conteúdo
   ===================================================== */

// ─── Estado da sessão de missão ───────────────────────────────────────────────
let _missaoSessao = null;

// ─── Utilitários: detecção resiliente de campos ──────────────────────────────

/**
 * Detecta o texto da frente de um flashcard em múltiplos formatos.
 */
function detectFlashcardFrente(fc) {
  return fc.frente || fc.pergunta || fc.titulo || fc.front || fc.question || null;
}

/**
 * Detecta o texto do verso de um flashcard em múltiplos formatos.
 */
function detectFlashcardVerso(fc) {
  return fc.verso || fc.resposta || fc.conteudo || fc.back || fc.answer || fc.content || null;
}

/**
 * Detecta texto de resumo rápido em prioridade de campos.
 * Prioridade: topicos_rapidos > resumo > descricao > conteudo
 */
function detectResumoRapido(cmsData) {
  if (!cmsData) return null;
  // Retorna array de strings ou converte string em array
  if (cmsData.topicos_rapidos && Array.isArray(cmsData.topicos_rapidos) && cmsData.topicos_rapidos.length > 0) {
    return { tipo: 'lista', itens: cmsData.topicos_rapidos };
  }
  if (cmsData.topicos_rapidos && typeof cmsData.topicos_rapidos === 'string' && cmsData.topicos_rapidos.trim()) {
    return { tipo: 'texto', conteudo: cmsData.topicos_rapidos };
  }
  if (cmsData.resumo && typeof cmsData.resumo === 'string' && cmsData.resumo.trim()) {
    return { tipo: 'texto', conteudo: cmsData.resumo };
  }
  if (cmsData.descricao && typeof cmsData.descricao === 'string' && cmsData.descricao.trim()) {
    return { tipo: 'texto', conteudo: cmsData.descricao };
  }
  if (cmsData.conteudo && typeof cmsData.conteudo === 'string' && cmsData.conteudo.trim()) {
    return { tipo: 'texto', conteudo: cmsData.conteudo };
  }
  return null;
}

/**
 * Embaralha um array (Fisher-Yates).
 */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Formata duração em segundos para mm:ss.
 */
function formatarTempo(segundos) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Busca de dados Firebase (resiliente) ────────────────────────────────────

/**
 * Busca dados CMS da matéria (materias_aulas).
 * Retorna o documento ou null.
 */
async function buscarCmsMissao(materia) {
  try {
    const materiasAulas = typeof window.getMateriasAulas === 'function' ? await window.getMateriasAulas() : [];
    const chave = (materia || '').toLowerCase().trim();
    let resultado = null;
    for (const d of materiasAulas) {
      const nomeCms = (d.name || '').toLowerCase().trim();
      if (nomeCms === chave || chave.includes(nomeCms) || nomeCms.includes(chave)) {
        resultado = d;
        break;
      }
    }
    return resultado;
  } catch (e) {
    console.warn('[MissaoFlow] Erro ao buscar CMS:', e);
    return null;
  }
}

/**
 * Busca questões com fallback de filtro.
 * Prioridade: materia + assunto + subassunto > materia + assunto > materia
 */
async function buscarQuestoesMissao(missao, limite) {
  const db = firebase.firestore();
  const materia = missao.materia || '';
  const assunto = missao.assunto || missao.subassunto || '';
  const subassunto = missao.subassunto || '';

  const tentativas = [];

  // Monta tentativas em ordem de especificidade
  if (materia && assunto && subassunto && assunto !== subassunto) {
    tentativas.push({ materia, assunto, subassunto });
  }
  if (materia && assunto) {
    tentativas.push({ materia, assunto, subassunto: null });
  }
  tentativas.push({ materia, assunto: null, subassunto: null });

  for (const t of tentativas) {
    try {
      let ref = db.collection('questoes').where('ativo', '==', true);
      if (t.materia) ref = ref.where('materia', '==', t.materia);

      const snap = await ref.get();
      let questoes = [];
      snap.forEach(doc => questoes.push({ id: doc.id, ...doc.data() }));

      // Filtra por assunto em memória (evita índice composto obrigatório)
      if (t.assunto) {
        questoes = questoes.filter(q => {
          const qa = (q.assunto || q.topico || '').toLowerCase();
          return qa === t.assunto.toLowerCase() || qa.includes(t.assunto.toLowerCase());
        });
      }
      if (t.subassunto && t.subassunto !== t.assunto) {
        const sub = questoes.filter(q => {
          const qs = (q.subassunto || '').toLowerCase();
          return qs === t.subassunto.toLowerCase() || qs.includes(t.subassunto.toLowerCase());
        });
        if (sub.length >= 3) questoes = sub;
      }

      if (questoes.length > 0) {
        return shuffleArray(questoes).slice(0, limite);
      }
    } catch (e) {
      // Tenta sem filtro ativo (compatibilidade de índices)
      try {
        let ref2 = db.collection('questoes');
        if (t.materia) ref2 = ref2.where('materia', '==', t.materia);
        const snap2 = await ref2.get();
        let questoes2 = [];
        snap2.forEach(doc => questoes2.push({ id: doc.id, ...doc.data() }));
        if (questoes2.length > 0) {
          return shuffleArray(questoes2).slice(0, limite);
        }
      } catch (e2) {}
    }
  }

  // SUPER FALLBACK: Se não encontrou NADA usando filtro exato no Firestore, busca as ultimas 50 questoes e tenta filtrar na memoria (ignorando maiusculas/minusculas)
  try {
    const snap3 = await db.collection('questoes').limit(50).get();
    let q3 = [];
    snap3.forEach(doc => q3.push({ id: doc.id, ...doc.data() }));
    
    // Tenta achar da materia (case insensitive)
    const matLower = materia.toLowerCase().trim();
    let qMat = q3.filter(q => (q.materia || '').toLowerCase().trim() === matLower || (q.materia || '').toLowerCase().includes(matLower));
    
    if (qMat.length > 0) return shuffleArray(qMat).slice(0, limite);
    
    // Se ainda assim nao achou, retorna aleatorias para a interface nao ficar vazia (modo demonstração)
    if (q3.length > 0) return shuffleArray(q3).slice(0, limite);
  } catch(e3) {}

  return [];
}

/**
 * Busca flashcards da matéria.
 * Retorna array (vazio se não encontrar).
 */
async function buscarFlashcardsMissao(missao) {
  const materia = missao.materia || '';
  const assunto = missao.assunto || missao.subassunto || '';
  const db = firebase.firestore();
  
  let cards = [];
  try {
    const snap = await db.collection('flashcards').where('materia', '==', materia).get();
    snap.forEach(doc => cards.push({ id: doc.id, ...doc.data() }));
    
    if (assunto && cards.length > 3) {
      const filtered = cards.filter(c => {
        const ca = (c.assunto || c.topico || '').toLowerCase();
        return ca === assunto.toLowerCase() || ca.includes(assunto.toLowerCase());
      });
      if (filtered.length >= 3) cards = filtered;
    }
  } catch (e) {
    console.error("Erro na busca de flashcards:", e);
  }

  if (cards.length > 0) {
    return shuffleArray(cards).slice(0, 15);
  }

  // SUPER FALLBACK: Se não encontrou NADA, tenta buscar os ultimos flashcards da base
  try {
    const snap2 = await db.collection('flashcards').limit(50).get();
    let todos = [];
    snap2.forEach(doc => todos.push({ id: doc.id, ...doc.data() }));
    
    // Tenta achar da materia (case insensitive)
    const matLower = materia.toLowerCase().trim();
    let fMat = todos.filter(c => (c.materia || '').toLowerCase().trim() === matLower || (c.materia || '').toLowerCase().includes(matLower));
    
    if (fMat.length > 0) return shuffleArray(fMat).slice(0, 15);
    
    // Se não achou, retorna aleatorios
    if (todos.length > 0) return shuffleArray(todos).slice(0, 15);
  } catch(e) {}
  
  return [];
}

// ─── PONTO DE ENTRADA ─────────────────────────────────────────────────────────

window.iniciarFluxoMissao = async function(modId, missaoId) {
  // Fecha modal existente
  const modal = document.getElementById('missaoModal');
  if (modal) modal.classList.remove('show');

  // Localiza missão na estrutura de carreiras
  const carreira = typeof CARREIRAS !== 'undefined' && typeof CARREIRA_ATIVA !== 'undefined'
    ? CARREIRAS[CARREIRA_ATIVA] : null;
  if (!carreira) return;

  const mod = carreira.modulos.find(m => m.id === modId);
  const missao = mod?.missoes.find(m => m.id === missaoId);
  if (!mod || !missao) return;

  // Verifica se já está no container da Jornada
  if (typeof window.go === 'function') window.go('jornada');

  const container = document.getElementById('jornadaContainer');
  if (!container) return;

  // Mostra loading enquanto carrega dados
  container.innerHTML = `
    <div class="mf-loading">
      <div class="mf-loading-icon">
        <i class="ph ph-spinner-gap ph-spin"></i>
      </div>
      <div class="mf-loading-text">Preparando sua missão...</div>
      <div class="mf-loading-sub">${missao.nome}</div>
    </div>
  `;

  // Inicializa sessão
  _missaoSessao = {
    modId,
    missaoId,
    mod,
    missao,
    isFinal: missao.isFinal || false,
    etapa: 1,
    questoesLimite: 30,
    inicioTotal: Date.now(),
    xpTotal: missao.xp || 50,
    // Dados carregados
    cms: null,
    questoesEtapa2: [],
    questoesEtapa5: [],
    flashcards: [],
    resumoRapido: null,
    // Estado das etapas
    etapa2Idx: 0,
    etapa3Idx: 0,
    etapa5Idx: 0,
    etapa5Acertos: 0,
    etapa5Respostas: [],
  };

  // Carrega dados em paralelo
  try {
    const [cms, questoesE2, flashcards, questoesE5] = await Promise.all([
      buscarCmsMissao(missao.materia),
      buscarQuestoesMissao(missao, 10),
      buscarFlashcardsMissao(missao),
      buscarQuestoesMissao(missao, _missaoSessao.questoesLimite),
    ]);

    let finalCms = missao.cms || cms;
    if (finalCms) {
      let arrayBlocks = [];
      if (Array.isArray(finalCms)) {
        arrayBlocks = finalCms;
      } else if (finalCms.aprender || finalCms.resumo) {
        arrayBlocks = [...(finalCms.aprender || []), ...(finalCms.resumo || [])];
      }
      
      if (arrayBlocks.length > 0) {
        const mapped = { videos: [], audios: [], resumo: '' };
        arrayBlocks.forEach(block => {
          if (block.type === 'video') mapped.videos.push(block);
          else if (block.type === 'audio') mapped.audios.push(block);
          else if (block.type === 'resumo' || block.type === 'texto') {
             mapped.resumo += block.conteudo + "\\n\\n";
          }
        });
        finalCms = mapped;
      }
    }
    _missaoSessao.cms = finalCms;
    _missaoSessao.questoesEtapa2 = questoesE2;
    _missaoSessao.flashcards = flashcards;
    _missaoSessao.questoesEtapa5 = questoesE5;
    _missaoSessao.resumoRapido = detectResumoRapido(cms);
  } catch (e) {
    console.warn('[MissaoFlow] Erro ao carregar dados:', e);
  }

  renderEtapa(1);
};

// ─── Render de etapa ──────────────────────────────────────────────────────────

function renderEtapa(num) {
  _missaoSessao.etapa = num;
  const container = document.getElementById('jornadaContainer');
  if (!container) return;

  const { mod, missao, isFinal } = _missaoSessao;

  // Header com progresso das etapas
  const etapas = [
    { num: 1, icon: 'ph-book-open', label: 'Aprender' },
    { num: 2, icon: 'ph-target', label: 'Exercícios' },
    { num: 3, icon: 'ph-cards', label: 'Revisão' },
    { num: 4, icon: 'ph-lightning', label: 'Resumo' },
    { num: 5, icon: 'ph-trophy', label: 'Missão Final' },
  ];

  const etapasHTML = etapas.map(e => `
    <div class="mf-etapa-dot ${e.num < num ? 'mf-dot-done' : e.num === num ? 'mf-dot-ativa' : 'mf-dot-futura'}">
      <div class="mf-dot-circulo">
        ${e.num < num
          ? '<i class="ph-fill ph-check"></i>'
          : `<i class="ph-fill ${e.icon}"></i>`
        }
      </div>
      <span class="mf-dot-label">${e.label}</span>
    </div>
    ${e.num < 5 ? `<div class="mf-etapa-linha ${e.num < num ? 'mf-linha-done' : ''}"></div>` : ''}
  `).join('');

  // Botão voltar
  const voltarDestino = num === 1 ? `voltarJornadaMissoes()` : `renderEtapa(${num - 1})`;
  const voltarLabel = num === 1 ? 'Missões' : 'Etapa Anterior';

  container.innerHTML = `
    <div class="mf-container">
      <div class="mf-header">
        <button class="btn-sm mf-btn-voltar" onclick="${voltarDestino}">
          <i class="ph ph-arrow-left"></i> ${voltarLabel}
        </button>
        <div class="mf-titulo-missao">
          <div class="mf-mod-icon" style="background:${mod.cor}22; border-color:${mod.cor}44;">
            <i class="ph-fill ${mod.icon}" style="color:${mod.cor};"></i>
          </div>
          <div>
            <div class="mf-missao-nome">${missao.nome}</div>
            <div class="mf-mod-nome" style="color:${mod.cor};">${mod.nome}</div>
          </div>
        </div>
      </div>

      <div class="mf-etapas-bar">
        ${etapasHTML}
      </div>

      <div class="mf-conteudo" id="mfConteudo">
        <div class="mf-loading">
          <i class="ph ph-spinner-gap ph-spin"></i>
        </div>
      </div>
    </div>
  `;

  // Renderiza conteúdo da etapa
  switch (num) {
    case 1: renderEtapa1(); break;
    case 2: renderEtapa2(); break;
    case 3: renderEtapa3(); break;
    case 4: renderEtapa4(); break;
    case 5: renderEtapa5(); break;
  }
}

// ─── ETAPA 1 — APRENDER ───────────────────────────────────────────────────────

function renderEtapa1() {
  const el = document.getElementById('mfConteudo');
  if (!el) return;
  const { cms, missao, mod } = _missaoSessao;

  const videos = cms?.videos || [];
  const audios = cms?.audios || [];
  const slides = cms?.slides || [];
  const temConteudo = videos.length > 0 || audios.length > 0 || slides.length > 0;

  // Mapa mental — gerado a partir das missões do módulo (dados estáticos)
  const mapaMentalHTML = renderMapaMental(mod, missao);

  // Vídeo principal (primeiro disponível)
  let videoHTML = '';
  if (videos.length > 0) {
    const v = videos[0];
    if (v.youtubeId) {
      videoHTML = `
        <div class="mf-secao">
          <div class="mf-secao-titulo"><i class="ph-fill ph-video" style="color:#8B5CF6;"></i> Aula em Vídeo</div>
          <div class="mf-yt-wrap">
            <iframe
              src="https://www.youtube.com/embed/${v.youtubeId}?rel=0&playsinline=1"
              title="${v.title || 'Aula'}"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen>
            </iframe>
          </div>
          <div class="mf-video-titulo">${v.title || 'Aula'}</div>
          ${videos.length > 1 ? `<div class="mf-mais-aulas">+${videos.length - 1} vídeo${videos.length > 2 ? 's' : ''} disponível${videos.length > 2 ? 'is' : ''}</div>` : ''}
        </div>`;
    } else if (v.url) {
      videoHTML = `
        <div class="mf-secao">
          <div class="mf-secao-titulo"><i class="ph-fill ph-video" style="color:#8B5CF6;"></i> Aula em Vídeo</div>
          <div class="mf-yt-wrap">
            <video controls playsinline style="width:100%; border-radius:12px; background:#000;">
              <source src="${v.url}" type="video/mp4">
            </video>
          </div>
          <div class="mf-video-titulo">${v.title || 'Aula'}</div>
        </div>`;
    }
  }

  // Resumo
  let resumoHTML = '';
  const resumoData = detectResumoRapido(cms);
  if (resumoData) {
    const textoResumo = resumoData.tipo === 'lista'
      ? resumoData.itens.map(i => `<li>${i}</li>`).join('')
      : resumoData.conteudo;
    resumoHTML = `
      <div class="mf-secao">
        <div class="mf-secao-titulo"><i class="ph-fill ph-file-text" style="color:#10B981;"></i> Resumo</div>
        <div class="mf-resumo-box">
          ${resumoData.tipo === 'lista'
            ? `<ul class="mf-resumo-lista">${textoResumo}</ul>`
            : `<p class="mf-resumo-texto">${textoResumo}</p>`}
        </div>
      </div>`;
  }

  // Áudio
  let audioHTML = '';
  if (audios.length > 0) {
    const a = audios[0];
    const audioSrc = a.url || a.youtubeId ? a.url : null;
    if (audioSrc) {
      audioHTML = `
        <div class="mf-secao">
          <div class="mf-secao-titulo"><i class="ph-fill ph-headphones" style="color:#F59E0B;"></i> Áudio</div>
          <div class="mf-audio-card">
            <div class="mf-audio-art"><i class="ph-fill ph-waveform"></i></div>
            <div class="mf-audio-info">
              <div class="mf-audio-titulo">${a.title || 'Áudio da Aula'}</div>
              ${a.duration ? `<div class="mf-audio-dur"><i class="ph ph-clock"></i> ${a.duration}</div>` : ''}
            </div>
            <audio controls style="width:100%; margin-top:12px; border-radius:8px;">
              <source src="${audioSrc}" type="audio/mpeg">
              <source src="${audioSrc}" type="audio/ogg">
            </audio>
          </div>
        </div>`;
    } else if (a.youtubeId) {
      // Áudio via YouTube embed
      audioHTML = `
        <div class="mf-secao">
          <div class="mf-secao-titulo"><i class="ph-fill ph-headphones" style="color:#F59E0B;"></i> Áudio</div>
          <div class="mf-audio-card">
            <iframe
              src="https://www.youtube.com/embed/${a.youtubeId}?rel=0"
              title="${a.title || 'Áudio'}"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media"
              style="width:100%; height:80px; border-radius:8px;">
            </iframe>
          </div>
        </div>`;
    }
  }

  // Estado vazio se nenhum conteúdo disponível
  if (!temConteudo && !resumoData) {
    el.innerHTML = `
      <div class="mf-etapa-titulo">
        <i class="ph-fill ph-book-open" style="color:#8B5CF6;"></i>
        <span>Aprender</span>
      </div>
      <div class="mf-empty-state">
        <i class="ph-fill ph-clock" style="color:#F59E0B; font-size:36px;"></i>
        <p>Conteúdo em atualização</p>
        <small>O material desta missão será disponibilizado em breve.</small>
      </div>
      ${mapaMentalHTML}
      <button class="btn btn-primary mf-btn-avancar" onclick="renderEtapa(2)">
        <i class="ph-fill ph-arrow-right"></i> Continuar para Exercícios
      </button>
    `;
    return;
  }

  el.innerHTML = `
    <div class="mf-etapa-titulo">
      <i class="ph-fill ph-book-open" style="color:#8B5CF6;"></i>
      <span>Aprender</span>
    </div>
    ${videoHTML}
    ${resumoHTML}
    ${audioHTML}
    ${mapaMentalHTML}
    <button class="btn btn-primary mf-btn-avancar" onclick="renderEtapa(2)">
      <i class="ph-fill ph-check-circle"></i> Concluir Conteúdo
    </button>
  `;
}

function renderMapaMental(mod, missao) {
  const irmãs = mod.missoes.filter(m => !m.isFinal);
  if (irmãs.length < 2) return '';

  return `
    <div class="mf-secao">
      <div class="mf-secao-titulo"><i class="ph-fill ph-graph" style="color:#3B82F6;"></i> Mapa Mental — ${mod.nome}</div>
      <div class="mf-mapa-mental">
        <div class="mf-mapa-centro" style="background:${mod.cor}22; border-color:${mod.cor};">
          <i class="ph-fill ${mod.icon}" style="color:${mod.cor};"></i>
          <span>${mod.nome}</span>
        </div>
        <div class="mf-mapa-nos">
          ${irmãs.map(m => `
            <div class="mf-mapa-no ${m.id === missao.id ? 'mf-mapa-no-ativo' : ''}"
                 style="border-color:${m.id === missao.id ? mod.cor : 'rgba(255,255,255,0.15)'};">
              ${m.id === missao.id
                ? `<i class="ph-fill ph-map-pin" style="color:${mod.cor};"></i>`
                : '<i class="ph ph-circle" style="color:rgba(255,255,255,0.3);"></i>'}
              <span>${m.nome}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ─── ETAPA 2 — EXERCÍCIOS ─────────────────────────────────────────────────────

function renderEtapa2() {
  const el = document.getElementById('mfConteudo');
  if (!el) return;
  const { questoesEtapa2 } = _missaoSessao;

  if (questoesEtapa2.length === 0) {
    el.innerHTML = `
      <div class="mf-etapa-titulo">
        <i class="ph-fill ph-target" style="color:#EF4444;"></i>
        <span>Exercícios</span>
      </div>
      <div class="mf-empty-state">
        <i class="ph-fill ph-clock" style="color:#F59E0B; font-size:36px;"></i>
        <p>Questões em atualização</p>
        <small>As questões desta matéria serão disponibilizadas em breve.</small>
      </div>
      <button class="btn btn-primary mf-btn-avancar" onclick="_missaoSessao.etapa2Idx=0; renderEtapa(3)">
        <i class="ph-fill ph-arrow-right"></i> Ir para Revisão
      </button>
    `;
    return;
  }

  _missaoSessao.etapa2Idx = 0;
  renderQuestaoEtapa2();
}

function renderQuestaoEtapa2() {
  const el = document.getElementById('mfConteudo');
  if (!el) return;
  const { questoesEtapa2, etapa2Idx } = _missaoSessao;
  const total = questoesEtapa2.length;

  if (etapa2Idx >= total) {
    // Todas as questões respondidas
    el.innerHTML = `
      <div class="mf-etapa-titulo">
        <i class="ph-fill ph-target" style="color:#EF4444;"></i>
        <span>Exercícios Concluídos!</span>
      </div>
      <div class="mf-etapa-concluida">
        <i class="ph-fill ph-check-circle" style="color:#10B981; font-size:52px;"></i>
        <p>Você respondeu todas as questões de exercício.</p>
        <small>Agora é hora de revisar com os flashcards!</small>
      </div>
      <button class="btn btn-primary mf-btn-avancar" onclick="renderEtapa(3)">
        <i class="ph-fill ph-cards"></i> Ir para Revisão
      </button>
    `;
    return;
  }

  const q = questoesEtapa2[etapa2Idx];
  const pct = Math.round((etapa2Idx / total) * 100);
  const texto = q.pergunta || q.perguntas || q.question || '';
  const expl = q.explicacao || q.explicação || q.explanation || '';
  const resposta = (q.resposta || q.answer || '').toString().trim().charAt(0).toUpperCase();
  const letras = ['A', 'B', 'C', 'D', 'E'];

  const opcoesHTML = letras.map(l => {
    const txt = q[l] || q[l.toLowerCase()] || '';
    if (!txt) return '';
    return `
      <button class="mf-questao-opt" id="mfOpt_${l}" onclick="responderEtapa2('${l}')">
        <span class="mf-opt-letra">${l})</span>
        <span class="mf-opt-txt">${txt}</span>
      </button>`;
  }).join('');

  el.innerHTML = `
    <div class="mf-etapa-titulo">
      <i class="ph-fill ph-target" style="color:#EF4444;"></i>
      <span>Exercícios — ${etapa2Idx + 1}/${total}</span>
    </div>
    <div class="mf-progress-mini">
      <div class="mf-prog-barra">
        <div class="mf-prog-fill" style="width:${pct}%; background:#EF4444;"></div>
      </div>
      <span class="mf-prog-label">${pct}%</span>
    </div>
    <div class="mf-questao-box">
      ${q.materia || q.assunto ? `<div class="mf-questao-tag">${q.materia || ''}${q.assunto ? ' · ' + q.assunto : ''}</div>` : ''}
      <p class="mf-questao-texto">${texto}</p>
    </div>
    <div class="mf-questao-opcoes" id="mfOpcoes">
      ${opcoesHTML}
    </div>
    <div class="mf-correcao" id="mfCorrecao" style="display:none;"></div>
    <button class="btn btn-primary mf-btn-avancar" id="mfBtnProxima" style="display:none;"
      onclick="_missaoSessao.etapa2Idx++; renderQuestaoEtapa2()">
      ${etapa2Idx < total - 1 ? '<i class="ph-fill ph-arrow-right"></i> Próxima Questão' : '<i class="ph-fill ph-check-circle"></i> Concluir Exercícios'}
    </button>
  `;
}

window.responderEtapa2 = function(letra) {
  const { questoesEtapa2, etapa2Idx } = _missaoSessao;
  const q = questoesEtapa2[etapa2Idx];
  const resposta = (q.resposta || q.answer || '').toString().trim().charAt(0).toUpperCase();
  const correta = letra === resposta;

  // Desabilita todos os botões
  document.querySelectorAll('.mf-questao-opt').forEach(b => b.disabled = true);

  // Destaca correto e errado
  const elCorreta = document.getElementById(`mfOpt_${resposta}`);
  if (elCorreta) elCorreta.classList.add('mf-opt-correta');

  if (!correta) {
    const elErrada = document.getElementById(`mfOpt_${letra}`);
    if (elErrada) elErrada.classList.add('mf-opt-errada');
  }

  // Mostra correção
  const elCorrecao = document.getElementById('mfCorrecao');
  if (elCorrecao) {
    const expl = q.explicacao || q.explicação || q.explanation || 'Sem explicação cadastrada para esta questão.';
    elCorrecao.style.display = 'block';
    elCorrecao.innerHTML = `
      <div class="mf-correcao-inner ${correta ? 'mf-correcao-ok' : 'mf-correcao-erro'}">
        <div class="mf-correcao-titulo">
          ${correta
            ? '<i class="ph-fill ph-check-circle"></i> Correto!'
            : `<i class="ph-fill ph-x-circle"></i> Incorreto — Resposta: ${resposta}`}
        </div>
        <p class="mf-correcao-texto">${expl}</p>
      </div>
    `;
  }

  const btnProxima = document.getElementById('mfBtnProxima');
  if (btnProxima) btnProxima.style.display = 'block';
};

// ─── ETAPA 3 — REVISÃO (FLASHCARDS) ──────────────────────────────────────────

function renderEtapa3() {
  const el = document.getElementById('mfConteudo');
  if (!el) return;
  const { flashcards } = _missaoSessao;

  if (flashcards.length === 0) {
    el.innerHTML = `
      <div class="mf-etapa-titulo">
        <i class="ph-fill ph-cards" style="color:#F59E0B;"></i>
        <span>Revisão</span>
      </div>
      <div class="mf-empty-state">
        <i class="ph-fill ph-clock" style="color:#F59E0B; font-size:36px;"></i>
        <p>Flashcards em atualização</p>
        <small>Os flashcards desta matéria serão disponibilizados em breve.</small>
      </div>
      <button class="btn btn-primary mf-btn-avancar" onclick="_missaoSessao.etapa3Idx=0; renderEtapa(4)">
        <i class="ph-fill ph-arrow-right"></i> Ir para Resumo
      </button>
    `;
    return;
  }

  _missaoSessao.etapa3Idx = 0;
  renderFlashcard();
}

function renderFlashcard() {
  const el = document.getElementById('mfConteudo');
  if (!el) return;
  const { flashcards, etapa3Idx } = _missaoSessao;
  const total = flashcards.length;

  if (etapa3Idx >= total) {
    el.innerHTML = `
      <div class="mf-etapa-titulo">
        <i class="ph-fill ph-cards" style="color:#F59E0B;"></i>
        <span>Revisão Concluída!</span>
      </div>
      <div class="mf-etapa-concluida">
        <i class="ph-fill ph-check-circle" style="color:#10B981; font-size:52px;"></i>
        <p>Você revisou todos os flashcards!</p>
      </div>
      <button class="btn btn-primary mf-btn-avancar" onclick="renderEtapa(4)">
        <i class="ph-fill ph-lightning"></i> Ir para Resumo Rápido
      </button>
    `;
    return;
  }

  const fc = flashcards[etapa3Idx];
  const frente = detectFlashcardFrente(fc);
  const verso = detectFlashcardVerso(fc);
  const pct = Math.round((etapa3Idx / total) * 100);

  if (!frente && !verso) {
    // Flashcard sem formato reconhecível, pula para o próximo
    _missaoSessao.etapa3Idx++;
    renderFlashcard();
    return;
  }

  el.innerHTML = `
    <div class="mf-etapa-titulo">
      <i class="ph-fill ph-cards" style="color:#F59E0B;"></i>
      <span>Revisão — ${etapa3Idx + 1}/${total}</span>
    </div>
    <div class="mf-progress-mini">
      <div class="mf-prog-barra">
        <div class="mf-prog-fill" style="width:${pct}%; background:#F59E0B;"></div>
      </div>
      <span class="mf-prog-label">${pct}%</span>
    </div>

    <div class="mf-flashcard-wrap" id="mfFlashcardWrap">
      <div class="mf-flashcard" id="mfFlashcard" onclick="virarFlashcard()">
        <div class="mf-flashcard-frente">
          <div class="mf-flashcard-hint"><i class="ph ph-hand-tap"></i> Toque para revelar</div>
          <p class="mf-flashcard-texto">${frente || '(sem conteúdo na frente)'}</p>
          <div class="mf-flashcard-icon-frente"><i class="ph-fill ph-question"></i></div>
        </div>
        <div class="mf-flashcard-verso">
          <div class="mf-flashcard-hint-verso"><i class="ph-fill ph-check-circle"></i> Resposta</div>
          <p class="mf-flashcard-texto">${verso || '(sem conteúdo no verso)'}</p>
        </div>
      </div>
    </div>

    <div class="mf-classificacao" id="mfClassificacao" style="display:none;">
      <p class="mf-classif-label">Como foi essa?</p>
      <div class="mf-classif-btns">
        <button class="mf-classif-btn mf-classif-dificil" onclick="classificarFlashcard('dificil')">
          <i class="ph-fill ph-smiley-sad"></i> Difícil
        </button>
        <button class="mf-classif-btn mf-classif-medio" onclick="classificarFlashcard('medio')">
          <i class="ph-fill ph-smiley-meh"></i> Médio
        </button>
        <button class="mf-classif-btn mf-classif-facil" onclick="classificarFlashcard('facil')">
          <i class="ph-fill ph-smiley"></i> Fácil
        </button>
      </div>
    </div>
  `;
}

window.virarFlashcard = function() {
  const card = document.getElementById('mfFlashcard');
  if (!card) return;
  card.classList.toggle('mf-flashcard-virado');
  const classif = document.getElementById('mfClassificacao');
  if (classif) setTimeout(() => classif.style.display = 'block', 200);
};

window.classificarFlashcard = function(nivel) {
  const { flashcards, etapa3Idx, missao } = _missaoSessao;
  const fc = flashcards[etapa3Idx];

  // Salva classificação no localStorage
  try {
    const key = `flashcard_review_${fc.id || etapa3Idx}`;
    localStorage.setItem(key, JSON.stringify({ nivel, missaoId: missao.id, ts: Date.now() }));
  } catch (e) {}

  _missaoSessao.etapa3Idx++;
  renderFlashcard();
};

// ─── ETAPA 4 — RESUMO RÁPIDO ──────────────────────────────────────────────────

function renderEtapa4() {
  const el = document.getElementById('mfConteudo');
  if (!el) return;
  const { resumoRapido, missao, mod } = _missaoSessao;

  if (!resumoRapido) {
    el.innerHTML = `
      <div class="mf-etapa-titulo">
        <i class="ph-fill ph-lightning" style="color:#7C3AED;"></i>
        <span>Resumo Rápido</span>
      </div>
      <div class="mf-empty-state">
        <i class="ph-fill ph-clock" style="color:#F59E0B; font-size:36px;"></i>
        <p>Resumo em atualização</p>
        <small>O material de revisão rápida será disponibilizado em breve.</small>
      </div>
      <button class="btn btn-primary mf-btn-avancar" onclick="renderEtapa(5)">
        <i class="ph-fill ph-trophy"></i> Ir para Missão Final
      </button>
    `;
    return;
  }

  let conteudoHTML = '';
  if (resumoRapido.tipo === 'lista') {
    conteudoHTML = `
      <div class="mf-rr-lista">
        ${resumoRapido.itens.map((item, i) => `
          <div class="mf-rr-item" style="animation-delay:${i * 0.08}s">
            <div class="mf-rr-bullet" style="background:${mod.cor};"></div>
            <span>${item}</span>
          </div>
        `).join('')}
      </div>`;
  } else {
    // Quebra o texto em parágrafos/tópicos para leitura rápida
    const linhas = resumoRapido.conteudo.split(/\n|\.(?=\s)/).filter(l => l.trim().length > 10);
    conteudoHTML = `
      <div class="mf-rr-lista">
        ${linhas.slice(0, 12).map((linha, i) => `
          <div class="mf-rr-item" style="animation-delay:${i * 0.08}s">
            <div class="mf-rr-bullet" style="background:${mod.cor};"></div>
            <span>${linha.trim()}</span>
          </div>
        `).join('')}
      </div>`;
  }

  el.innerHTML = `
    <div class="mf-etapa-titulo">
      <i class="ph-fill ph-lightning" style="color:#7C3AED;"></i>
      <span>Resumo Rápido</span>
    </div>
    <div class="mf-rr-header">
      <div class="mf-rr-icon" style="background:${mod.cor}22; border-color:${mod.cor}44;">
        <i class="ph-fill ${mod.icon}" style="color:${mod.cor};"></i>
      </div>
      <div>
        <div class="mf-rr-titulo">${missao.nome}</div>
        <div class="mf-rr-sub">Leitura rápida · menos de 2 min</div>
      </div>
    </div>
    <div class="mf-rr-box">
      ${conteudoHTML}
    </div>
    <button class="btn btn-primary mf-btn-avancar" onclick="renderEtapa(5)">
      <i class="ph-fill ph-trophy"></i> Estou Pronto — Missão Final!
    </button>
  `;
}

// ─── ETAPA 5 — MISSÃO FINAL ───────────────────────────────────────────────────

function renderEtapa5() {
  const el = document.getElementById('mfConteudo');
  if (!el) return;
  const { questoesEtapa5, missao, isFinal } = _missaoSessao;

  if (questoesEtapa5.length === 0) {
    el.innerHTML = `
      <div class="mf-etapa-titulo">
        <i class="ph-fill ph-trophy" style="color:#F59E0B;"></i>
        <span>Missão Final</span>
      </div>
      <div class="mf-empty-state">
        <i class="ph-fill ph-clock" style="color:#F59E0B; font-size:36px;"></i>
        <p>Questões em atualização</p>
        <small>O banco de questões desta missão será disponibilizado em breve.</small>
      </div>
      <button class="btn btn-primary mf-btn-avancar" onclick="concluirMissaoSemQuestoes()">
        <i class="ph-fill ph-check-circle"></i> Concluir Missão
      </button>
    `;
    return;
  }

  _missaoSessao.etapa5Idx = 0;
  _missaoSessao.etapa5Acertos = 0;
  _missaoSessao.etapa5Respostas = [];

  renderQuestaoFinal();
}

function renderQuestaoFinal() {
  const el = document.getElementById('mfConteudo');
  if (!el) return;
  const { questoesEtapa5, etapa5Idx, etapa5Acertos, missao, mod, isFinal } = _missaoSessao;
  const total = questoesEtapa5.length;

  if (etapa5Idx >= total) {
    mostrarResultadoFinal();
    return;
  }

  const q = questoesEtapa5[etapa5Idx];
  const pct = Math.round((etapa5Idx / total) * 100);
  const texto = q.pergunta || q.perguntas || q.question || '';
  const resposta = (q.resposta || q.answer || '').toString().trim().charAt(0).toUpperCase();
  const letras = ['A', 'B', 'C', 'D', 'E'];

  const opcoesHTML = letras.map(l => {
    const txt = q[l] || q[l.toLowerCase()] || '';
    if (!txt) return '';
    return `
      <button class="mf-questao-opt mf-questao-opt-final" id="mfFinalOpt_${l}" onclick="responderFinal('${l}')">
        <span class="mf-opt-letra">${l})</span>
        <span class="mf-opt-txt">${txt}</span>
      </button>`;
  }).join('');

  el.innerHTML = `
    <div class="mf-etapa-titulo mf-final-titulo">
      <i class="ph-fill ph-trophy" style="color:#F59E0B;"></i>
      <span>${isFinal ? 'Missão Final do Módulo' : 'Missão Final'} — ${etapa5Idx + 1}/${total}</span>
    </div>
    <div class="mf-final-status">
      <div class="mf-progress-mini">
        <div class="mf-prog-barra">
          <div class="mf-prog-fill mf-prog-final" style="width:${pct}%;"></div>
        </div>
        <span class="mf-prog-label">${etapa5Acertos} acertos</span>
      </div>
    </div>
    <div class="mf-questao-box mf-questao-final">
      ${q.materia || q.assunto ? `<div class="mf-questao-tag">${q.materia || ''}${q.assunto ? ' · ' + q.assunto : ''}</div>` : ''}
      <p class="mf-questao-texto">${texto}</p>
    </div>
    <div class="mf-questao-opcoes" id="mfOpcoesF">
      ${opcoesHTML}
    </div>
    <div class="mf-correcao" id="mfCorrecaoF" style="display:none;"></div>
    <button class="btn btn-primary mf-btn-avancar" id="mfBtnAvancarF" style="display:none;"
      onclick="_missaoSessao.etapa5Idx++; renderQuestaoFinal()">
      ${etapa5Idx < total - 1 ? '<i class="ph-fill ph-arrow-right"></i> Próxima' : '<i class="ph-fill ph-flag-checkered"></i> Ver Resultado'}
    </button>
  `;
}

window.responderFinal = function(letra) {
  const { questoesEtapa5, etapa5Idx } = _missaoSessao;
  const q = questoesEtapa5[etapa5Idx];
  const resposta = (q.resposta || q.answer || '').toString().trim().charAt(0).toUpperCase();
  const correta = letra === resposta;

  if (correta) _missaoSessao.etapa5Acertos++;
  _missaoSessao.etapa5Respostas.push({ letra, resposta, correta });

  document.querySelectorAll('.mf-questao-opt-final').forEach(b => b.disabled = true);

  const elCorreta = document.getElementById(`mfFinalOpt_${resposta}`);
  if (elCorreta) elCorreta.classList.add('mf-opt-correta');
  if (!correta) {
    const elErrada = document.getElementById(`mfFinalOpt_${letra}`);
    if (elErrada) elErrada.classList.add('mf-opt-errada');
  }

  const elCorrecao = document.getElementById('mfCorrecaoF');
  if (elCorrecao) {
    const expl = q.explicacao || q.explicação || q.explanation || 'Sem explicação cadastrada.';
    elCorrecao.style.display = 'block';
    elCorrecao.innerHTML = `
      <div class="mf-correcao-inner ${correta ? 'mf-correcao-ok' : 'mf-correcao-erro'}">
        <div class="mf-correcao-titulo">
          ${correta
            ? '<i class="ph-fill ph-check-circle"></i> Correto!'
            : `<i class="ph-fill ph-x-circle"></i> Incorreto — Resposta: ${resposta}`}
        </div>
        <p class="mf-correcao-texto">${expl}</p>
      </div>
    `;
  }

  const btnAv = document.getElementById('mfBtnAvancarF');
  if (btnAv) btnAv.style.display = 'block';
};

function mostrarResultadoFinal() {
  const el = document.getElementById('mfConteudo');
  if (!el) return;
  const { etapa5Acertos, questoesEtapa5, missao, mod, modId, missaoId, inicioTotal, isFinal } = _missaoSessao;
  const total = questoesEtapa5.length;
  const pct = total > 0 ? Math.round((etapa5Acertos / total) * 100) : 0;
  const aprovado = pct >= 70;
  const tempoSegundos = Math.round((Date.now() - inicioTotal) / 1000);
  const tempoStr = formatarTempo(tempoSegundos);

  const xpGanho = aprovado
    ? (isFinal ? Math.round(missao.xp * 1.5) : missao.xp)
    : Math.round(missao.xp * 0.3);

  const medalha = isFinal ? '🏆' : pct === 100 ? '⭐' : pct >= 90 ? '🥇' : pct >= 70 ? '🥈' : '🎖️';

  if (aprovado) {
    // Confetti!
    if (window.confetti) {
      confetti({ particleCount: 180, spread: 100, origin: { y: 0.3 }, colors: [mod.cor, '#F59E0B', '#fff', '#10B981'] });
      setTimeout(() => confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 }, colors: [mod.cor, '#F59E0B'] }), 600);
    }
    // Registra missão concluída
    if (typeof window.concluirMissao === 'function') {
      window.concluirMissao(modId, missaoId, { tipo: 'missao_final', acertos: etapa5Acertos });
    }
  }

  el.innerHTML = `
    <div class="mf-resultado ${aprovado ? 'mf-resultado-ok' : 'mf-resultado-fail'}">
      <div class="mf-resultado-medalha">${medalha}</div>
      <div class="mf-resultado-titulo">
        ${aprovado ? 'Missão Concluída!' : 'Quase lá!'}
      </div>
      <div class="mf-resultado-sub">
        ${aprovado
          ? 'Parabéns! Você foi aprovado(a) na missão.'
          : `Você precisa de 70% para passar. Tente novamente!`}
      </div>

      <div class="mf-resultado-stats">
        <div class="mf-res-stat">
          <div class="mf-res-stat-val" style="color:${aprovado ? '#10B981' : '#EF4444'};">${pct}%</div>
          <div class="mf-res-stat-label">Acertos</div>
        </div>
        <div class="mf-res-stat">
          <div class="mf-res-stat-val">${etapa5Acertos}/${total}</div>
          <div class="mf-res-stat-label">Questões</div>
        </div>
        <div class="mf-res-stat">
          <div class="mf-res-stat-val" style="color:#3B82F6;">${tempoStr}</div>
          <div class="mf-res-stat-label">Tempo</div>
        </div>
        <div class="mf-res-stat">
          <div class="mf-res-stat-val" style="color:#F59E0B;">+${xpGanho}</div>
          <div class="mf-res-stat-label">XP</div>
        </div>
      </div>

      ${aprovado ? `
        <div class="mf-resultado-conquistas">
          <div class="mf-conquista-item">
            <i class="ph-fill ph-star" style="color:#F59E0B;"></i>
            <span>+${xpGanho} XP conquistados</span>
          </div>
          <div class="mf-conquista-item">
            <i class="ph-fill ph-medal" style="color:#C0A060;"></i>
            <span>Medalha: ${missao.nome} ${medalha}</span>
          </div>
          ${isFinal ? `
          <div class="mf-conquista-item">
            <i class="ph-fill ph-rocket-launch" style="color:${mod.cor};"></i>
            <span>Módulo ${mod.nome} desbloqueado!</span>
          </div>` : `
          <div class="mf-conquista-item">
            <i class="ph-fill ph-lock-open" style="color:#10B981;"></i>
            <span>Próxima missão desbloqueada!</span>
          </div>`}
        </div>
        <button class="btn btn-primary mf-btn-avancar" onclick="voltarJornadaMissoes()" style="background:linear-gradient(135deg, ${mod.cor}, ${mod.cor}bb);">
          <i class="ph-fill ph-map-trifold"></i> Continuar Jornada
        </button>
      ` : `
        <div class="mf-resultado-retry-opts">
          <button class="btn btn-primary mf-btn-avancar" onclick="_missaoSessao.etapa5Idx=0; _missaoSessao.etapa5Acertos=0; _missaoSessao.etapa5Respostas=[]; renderQuestaoFinal()">
            <i class="ph-fill ph-arrows-clockwise"></i> Tentar Novamente
          </button>
          <button class="btn btn-secondary" style="width:100%; margin-top:12px;" onclick="renderEtapa(3)">
            <i class="ph-fill ph-cards"></i> Revisar Flashcards
          </button>
          <button class="btn btn-secondary" style="width:100%; margin-top:8px;" onclick="voltarJornadaMissoes()">
            <i class="ph ph-arrow-left"></i> Voltar às Missões
          </button>
        </div>
      `}
    </div>
  `;

  // Adiciona XP parcial mesmo sem aprovação
  if (!aprovado && typeof window.addXP === 'function' && xpGanho > 0) {
    window.addXP(xpGanho);
  }
}

// ─── Sem questões — conclusão manual ─────────────────────────────────────────

window.concluirMissaoSemQuestoes = function() {
  const { modId, missaoId } = _missaoSessao;
  if (typeof window.concluirMissao === 'function') {
    window.concluirMissao(modId, missaoId, { tipo: 'sem_questoes', acertos: 0 });
  }
  voltarJornadaMissoes();
};

// ─── Voltar para a trilha de missões ──────────────────────────────────────────

window.voltarJornadaMissoes = function() {
  if (!_missaoSessao) { if (typeof window.renderJornada === 'function') window.renderJornada(); return; }
  const { modId } = _missaoSessao;
  const carreira = typeof CARREIRAS !== 'undefined' && typeof CARREIRA_ATIVA !== 'undefined'
    ? CARREIRAS[CARREIRA_ATIVA] : null;
  const idx = carreira?.modulos.findIndex(m => m.id === modId) ?? -1;
  _missaoSessao = null;
  if (idx >= 0 && typeof window.abrirModulo === 'function') {
    window.abrirModulo(idx);
  } else if (typeof window.renderJornada === 'function') {
    window.renderJornada();
  }
};
