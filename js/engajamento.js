/* =====================================================
   ENGAJAMENTO — PlenAula Fase 3
   Retenção e Engajamento Diário
   ===================================================== */

// ─── Constantes de localStorage ───────────────────────────────────────────────
const ENG_TEMPO_KEY   = 'jornada_tempo_estudo';
const ENG_QUESTOES_KEY = 'quiz_topic_stats';
const ENG_BADGES_KEY  = 'quiz_unlocked_badges';
const ENG_FLASH_REVIEW_PREFIX = 'flashcard_review_';

// ─── Lista expandida de conquistas ────────────────────────────────────────────
const CONQUISTAS_LISTA = [
  // Início
  { id: 'first_blood',    nome: 'Primeira Missão',   icon: 'ph-footprints',        cor: '#10B981', desc: 'Complete sua primeira missão',        tipo: 'missao',   meta: 1   },
  { id: 'missoes_5',      nome: '5 Missões',          icon: 'ph-medal',             cor: '#3B82F6', desc: 'Conclua 5 missões na Jornada',         tipo: 'missao',   meta: 5   },
  { id: 'missoes_25',     nome: '25 Missões',         icon: 'ph-trophy',            cor: '#F59E0B', desc: 'Conclua 25 missões na Jornada',        tipo: 'missao',   meta: 25  },
  { id: 'missoes_50',     nome: 'Veterano',           icon: 'ph-star',              cor: '#EF4444', desc: 'Conclua 50 missões na Jornada',        tipo: 'missao',   meta: 50  },
  // Sequência
  { id: 'streak_3',       nome: 'Focado',             icon: 'ph-fire',              cor: '#F59E0B', desc: '3 dias seguidos de estudo',            tipo: 'streak',   meta: 3   },
  { id: 'streak_7',       nome: '7 Dias Seguidos',    icon: 'ph-sneaker',           cor: '#EF4444', desc: 'Uma semana sem parar!',                tipo: 'streak',   meta: 7   },
  { id: 'streak_30',      nome: '30 Dias Seguidos',   icon: 'ph-crown',             cor: '#F59E0B', desc: 'Um mês de dedicação!',                 tipo: 'streak',   meta: 30  },
  // Questões
  { id: 'questoes_10',    nome: 'Primeira Centena',   icon: 'ph-target',            cor: '#8B5CF6', desc: 'Responda 10 questões no total',        tipo: 'questoes', meta: 10  },
  { id: 'questoes_100',   nome: '100 Questões',       icon: 'ph-books',             cor: '#06B6D4', desc: 'Responda 100 questões no total',       tipo: 'questoes', meta: 100 },
  { id: 'questoes_500',   nome: 'Mestre das Leis',    icon: 'ph-scales',            cor: '#7C3AED', desc: 'Responda 500 questões no total',       tipo: 'questoes', meta: 500 },
  // Revisão
  { id: 'flash_10',       nome: 'Rei da Revisão',     icon: 'ph-cards',             cor: '#10B981', desc: 'Revise 10 flashcards na Jornada',      tipo: 'flash',    meta: 10  },
  { id: 'flash_50',       nome: 'Memória de Ouro',    icon: 'ph-brain',             cor: '#F59E0B', desc: 'Revise 50 flashcards no total',        tipo: 'flash',    meta: 50  },
  // Desempenho
  { id: 'acerto_90',      nome: 'Precisão Máxima',    icon: 'ph-crosshair',         cor: '#10B981', desc: 'Acerte 90%+ numa missão final',        tipo: 'acerto',   meta: 90  },
  { id: 'grande_dia',     nome: 'Aprovado',           icon: 'ph-seal-check',        cor: '#F59E0B', desc: 'Acerte 80%+ num Simulado Completo',   tipo: 'simulado', meta: 80  },
  { id: 'mestre',         nome: 'Comandante',         icon: 'ph-shield-star',       cor: '#EF4444', desc: 'Alcance 3000+ XP',                    tipo: 'xp',       meta: 3000},
  // Módulo/Carreira
  { id: 'modulo_ok',      nome: 'Módulo Concluído',   icon: 'ph-check-circle',      cor: '#3B82F6', desc: 'Conclua um módulo completo',           tipo: 'modulo',   meta: 1   },
];

// ─── Checar e desbloquear conquistas ─────────────────────────────────────────
window.verificarConquistas = function(dados = {}) {
  let unlocked = _getUnlocked();
  let novas = [];

  const add = (id) => {
    if (!unlocked.includes(id)) { unlocked.push(id); novas.push(id); }
  };

  const xp       = parseInt(localStorage.getItem('quiz_xp') || '0');
  const streak   = parseInt(localStorage.getItem('quiz_streak') || '0');
  const missoes  = _getMissoesConcluidas();
  const questoes = _getTotalQuestoes();
  const flash    = _getTotalFlashRevisados();
  const badges   = _getModulosBadges();

  // Missões
  if (missoes >= 1)  add('first_blood');
  if (missoes >= 5)  add('missoes_5');
  if (missoes >= 25) add('missoes_25');
  if (missoes >= 50) add('missoes_50');

  // Streak
  if (streak >= 3)  add('streak_3');
  if (streak >= 7)  add('streak_7');
  if (streak >= 30) add('streak_30');

  // Questões
  if (questoes >= 10)  add('questoes_10');
  if (questoes >= 100) add('questoes_100');
  if (questoes >= 500) add('questoes_500');

  // Flashcards
  if (flash >= 10) add('flash_10');
  if (flash >= 50) add('flash_50');

  // XP
  if (xp >= 3000) add('mestre');

  // Acerto na missão final
  if (dados.acertos !== undefined && dados.total > 0) {
    const pct = Math.round((dados.acertos / dados.total) * 100);
    if (pct >= 90) add('acerto_90');
  }

  // Grande Dia
  if (dados.isGrandeDia && dados.acertos !== undefined && dados.total >= 100) {
    const pct = Math.round((dados.acertos / dados.total) * 100);
    if (pct >= 80) add('grande_dia');
  }

  // Módulo concluído
  if (badges.length > 0) add('modulo_ok');

  if (novas.length > 0) {
    localStorage.setItem(ENG_BADGES_KEY, JSON.stringify(unlocked));
    novas.forEach(id => _mostrarToastConquista(id));
    if (window.syncGamificationToCloud) window.syncGamificationToCloud();
  }
};

// Checa ao carregar a página
window.verificarConquistas();

// ─── Helpers de dados ─────────────────────────────────────────────────────────
function _getUnlocked() {
  try { return JSON.parse(localStorage.getItem(ENG_BADGES_KEY) || '[]'); } catch(e) { return []; }
}

function _getMissoesConcluidas() {
  try {
    const prog = JSON.parse(localStorage.getItem('jornada_progress_v2') || '{}');
    return Object.values(prog).filter(v => v.concluido).length;
  } catch(e) { return 0; }
}

function _getTotalQuestoes() {
  try {
    const stats = JSON.parse(localStorage.getItem(ENG_QUESTOES_KEY) || '{}');
    return Object.values(stats).reduce((s, v) => s + (v.t || 0), 0);
  } catch(e) { return 0; }
}

function _getTotalFlashRevisados() {
  try {
    return Object.keys(localStorage).filter(k => k.startsWith(ENG_FLASH_REVIEW_PREFIX)).length;
  } catch(e) { return 0; }
}

function _getFlashDificeis() {
  try {
    const dificeis = [];
    Object.keys(localStorage).forEach(k => {
      if (!k.startsWith(ENG_FLASH_REVIEW_PREFIX)) return;
      const val = JSON.parse(localStorage.getItem(k) || '{}');
      if (val.nivel === 'dificil') {
        dificeis.push({ key: k, ...val });
      }
    });
    return dificeis;
  } catch(e) { return []; }
}

function _getModulosBadges() {
  try {
    const badges = JSON.parse(localStorage.getItem(ENG_BADGES_KEY) || '[]');
    return badges.filter(b => b.startsWith('modulo_'));
  } catch(e) { return []; }
}

function _getTaxaAcertos() {
  try {
    const stats = JSON.parse(localStorage.getItem(ENG_QUESTOES_KEY) || '{}');
    let total = 0, corretas = 0;
    Object.values(stats).forEach(v => { total += v.t || 0; corretas += v.c || 0; });
    return total > 0 ? Math.round((corretas / total) * 100) : null;
  } catch(e) { return null; }
}

function _getTempoEstudado() {
  const mins = parseInt(localStorage.getItem(ENG_TEMPO_KEY) || '0');
  if (mins === 0) return '0 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ─── Toast de conquista desbloqueada ─────────────────────────────────────────
function _mostrarToastConquista(id) {
  const conquista = CONQUISTAS_LISTA.find(c => c.id === id);
  if (!conquista) return;

  let t = document.getElementById('conquista-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'conquista-toast';
    t.className = 'conquista-toast';
    document.body.appendChild(t);
  }

  t.innerHTML = `
    <div class="ct-icon" style="background:${conquista.cor}22; border-color:${conquista.cor}44;">
      <i class="ph-fill ${conquista.icon}" style="color:${conquista.cor};"></i>
    </div>
    <div class="ct-info">
      <div class="ct-titulo">🏅 Conquista Desbloqueada!</div>
      <div class="ct-nome">${conquista.nome}</div>
    </div>
  `;

  t.classList.remove('ct-show', 'ct-hide');
  void t.offsetWidth; // reflow
  t.classList.add('ct-show');
  
  // Dispara o confetti
  if(window.dispararConfete) window.dispararConfete();

  setTimeout(() => {
    t.classList.add('ct-hide');
    setTimeout(() => t.classList.remove('ct-show', 'ct-hide'), 500);
  }, 3000);
}

// ─── RENDER: Revisões Pendentes (Home) ────────────────────────────────────────
window.renderRevisoesPendentes = function() {
  const container = document.getElementById('revisoesPendentesCard');
  if (!container) return;

  const dificeis = _getFlashDificeis();
  const questoesErradas = _getQuestoesErradas();

  const totalPendentes = dificeis.length + questoesErradas;

  if (totalPendentes === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  const itens = [];
  if (dificeis.length > 0) {
    itens.push(`<span class="rp-item"><i class="ph-fill ph-cards" style="color:#F59E0B;"></i> ${dificeis.length} flashcard${dificeis.length > 1 ? 's' : ''} difícil${dificeis.length > 1 ? 'is' : ''}</span>`);
  }
  if (questoesErradas > 0) {
    itens.push(`<span class="rp-item"><i class="ph-fill ph-x-circle" style="color:#EF4444;"></i> ${questoesErradas} questão${questoesErradas > 1 ? 'ões' : ''} para reforçar</span>`);
  }

  container.innerHTML = `
    <div class="rp-card">
      <div class="rp-left">
        <div class="rp-icon"><i class="ph-fill ph-brain" style="color:#7C3AED;"></i></div>
        <div class="rp-info">
          <div class="rp-titulo">🧠 Revisões Pendentes</div>
          <div class="rp-itens">${itens.join('')}</div>
        </div>
      </div>
      <button class="btn btn-secondary rp-btn" onclick="iniciarRevisaoPendente()">
        <i class="ph-fill ph-arrows-clockwise"></i> Revisar
      </button>
    </div>
  `;
};

function _getQuestoesErradas() {
  try {
    const stats = JSON.parse(localStorage.getItem(ENG_QUESTOES_KEY) || '{}');
    let erros = 0;
    Object.values(stats).forEach(v => { erros += (v.t || 0) - (v.c || 0); });
    return Math.min(erros, 99); // cap para não assustar
  } catch(e) { return 0; }
}

window.iniciarRevisaoPendente = function() {
  // Vai para flashcards — maior impacto de revisão
  if (typeof window.go === 'function') window.go('cards');
};

// ─── RENDER: Perfil Completo com Estatísticas e Conquistas ────────────────────
window.renderPerfilEngajamento = function(container) {
  if (!container) return;

  const xp       = parseInt(localStorage.getItem('quiz_xp') || '0');
  const streak   = parseInt(localStorage.getItem('quiz_streak') || '0');
  const missoes  = _getMissoesConcluidas();
  const questoes = _getTotalQuestoes();
  const taxa     = _getTaxaAcertos();
  const tempo    = _getTempoEstudado();
  const flash    = _getTotalFlashRevisados();
  const unlocked = _getUnlocked();

  // Stats visuais
  const statsHTML = `
    <div class="eng-section">
      <div class="eng-section-title"><i class="ph-fill ph-chart-bar" style="color:var(--primary);"></i> Estatísticas</div>
      <div class="eng-stats-grid">
        <div class="eng-stat-card">
          <div class="eng-stat-icon" style="background:#3B82F620; border-color:#3B82F640;">
            <i class="ph-fill ph-clock" style="color:#3B82F6;"></i>
          </div>
          <div class="eng-stat-val">${tempo}</div>
          <div class="eng-stat-label">Tempo Estudado</div>
        </div>
        <div class="eng-stat-card">
          <div class="eng-stat-icon" style="background:#10B98120; border-color:#10B98140;">
            <i class="ph-fill ph-target" style="color:#10B981;"></i>
          </div>
          <div class="eng-stat-val">${questoes}</div>
          <div class="eng-stat-label">Questões Feitas</div>
        </div>
        <div class="eng-stat-card">
          <div class="eng-stat-icon" style="background:#8B5CF620; border-color:#8B5CF640;">
            <i class="ph-fill ph-map-pin" style="color:#8B5CF6;"></i>
          </div>
          <div class="eng-stat-val">${missoes}</div>
          <div class="eng-stat-label">Missões</div>
        </div>
        <div class="eng-stat-card">
          <div class="eng-stat-icon" style="background:#F59E0B20; border-color:#F59E0B40;">
            <i class="ph-fill ph-percent" style="color:#F59E0B;"></i>
          </div>
          <div class="eng-stat-val">${taxa !== null ? taxa + '%' : '—'}</div>
          <div class="eng-stat-label">Taxa de Acerto</div>
        </div>
        <div class="eng-stat-card">
          <div class="eng-stat-icon" style="background:#EF444420; border-color:#EF444440;">
            <i class="ph-fill ph-fire" style="color:#EF4444;"></i>
          </div>
          <div class="eng-stat-val">${streak} dia${streak !== 1 ? 's' : ''}</div>
          <div class="eng-stat-label">Sequência</div>
        </div>
        <div class="eng-stat-card">
          <div class="eng-stat-icon" style="background:#06B6D420; border-color:#06B6D440;">
            <i class="ph-fill ph-cards" style="color:#06B6D4;"></i>
          </div>
          <div class="eng-stat-val">${flash}</div>
          <div class="eng-stat-label">Cards Revisados</div>
        </div>
      </div>

      ${_renderMiniChart()}
    </div>
  `;

  // Conquistas expandidas
  const conquistasHTML = `
    <div class="eng-section">
      <div class="eng-section-title"><i class="ph-fill ph-trophy" style="color:#F59E0B;"></i> Conquistas
        <span class="eng-badge-count">${unlocked.length}/${CONQUISTAS_LISTA.length}</span>
      </div>
      <div class="eng-conquistas-grid">
        ${CONQUISTAS_LISTA.map(c => {
          const on = unlocked.includes(c.id);
          return `
            <div class="eng-conquista ${on ? 'eng-conq-on' : 'eng-conq-off'}" title="${c.desc}">
              <div class="eng-conq-icon" style="${on ? `background:${c.cor}22; border-color:${c.cor}44;` : ''}">
                <i class="ph-fill ${c.icon}" style="color:${on ? c.cor : 'rgba(255,255,255,0.2)'};"></i>
              </div>
              <div class="eng-conq-nome">${c.nome}</div>
              ${on ? '<div class="eng-conq-check"><i class="ph-fill ph-check"></i></div>' : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', statsHTML + conquistasHTML);
};

function _renderMiniChart() {
  try {
    const stats = JSON.parse(localStorage.getItem(ENG_QUESTOES_KEY) || '{}');
    const tops = Object.entries(stats)
      .filter(([, v]) => v.t > 0)
      .sort(([, a], [, b]) => b.t - a.t)
      .slice(0, 5);

    if (tops.length === 0) return '';

    const barras = tops.map(([nome, v]) => {
      const pct = Math.round((v.c / v.t) * 100);
      const cor = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444';
      const nomeAbrev = nome.length > 20 ? nome.substring(0, 18) + '…' : nome;
      return `
        <div class="eng-chart-row">
          <div class="eng-chart-nome">${nomeAbrev}</div>
          <div class="eng-chart-bar-wrap">
            <div class="eng-chart-bar" style="width:${pct}%; background:linear-gradient(90deg, ${cor}, ${cor}88);"></div>
          </div>
          <div class="eng-chart-pct" style="color:${cor};">${pct}%</div>
        </div>
      `;
    }).join('');

    return `
      <div class="eng-chart-section">
        <div class="eng-chart-title">Desempenho por Matéria</div>
        ${barras}
      </div>
    `;
  } catch(e) { return ''; }
}

// ─── Hook: sobrescreve renderPerfil para incluir engajamento ─────────────────
// Aguarda todos os scripts carregarem antes de instalar o hook
function _instalarHookRenderPerfil() {
  const _renderPerfilOriginal = window.renderPerfil;
  window.renderPerfil = function() {
    if (typeof _renderPerfilOriginal === 'function') _renderPerfilOriginal();
    setTimeout(() => {
      const container = document.getElementById('perfilContent');
      if (!container) return;
      container.querySelectorAll('.eng-section').forEach(el => el.remove());
      window.renderPerfilEngajamento(container);
      window.verificarConquistas();
    }, 50);
  };
}
// Instala depois que todos os scripts carregaram
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _instalarHookRenderPerfil);
} else {
  setTimeout(_instalarHookRenderPerfil, 0);
}

// ─── Hook: verificar conquistas ao concluir missão ────────────────────────────
const _concluirMissaoOriginal = window.concluirMissao;
window.concluirMissao = function(modId, missaoId, dados = {}) {
  if (typeof _concluirMissaoOriginal === 'function') _concluirMissaoOriginal(modId, missaoId, dados);
  window.verificarConquistas(dados);
  // Atualiza revisões pendentes na home se estiver visível
  if (typeof window.renderRevisoesPendentes === 'function') window.renderRevisoesPendentes();
};


// ─── Inicialização ────────────────────────────────────────────────────────────
(function initEngajamento() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.renderRevisoesPendentes();
    });
  } else {
    setTimeout(() => window.renderRevisoesPendentes(), 200);
  }
})();

// ─── Gamificação Visual (Floating XP e Confetti) ────────────────────────────────
window.animarGanhoXP = function(amount) {
  const el = document.createElement('div');
  el.className = 'floating-xp-anim';
  el.textContent = `+${amount} XP`;
  
  // Posicionar aleatoriamente perto do centro da tela para ficar visível
  const rx = Math.random() * 40 - 20; // -20 a +20px
  el.style.left = `calc(50% + ${rx}px)`;
  
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500); // Remove o elemento do DOM
};

window.dispararConfete = function() {
  if (window.confetti) {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#7C3AED', '#2563EB', '#10B981', '#F59E0B', '#EF4444'],
      zIndex: 9999
    });
  }
};
