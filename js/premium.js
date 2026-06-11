/* =====================================================
   PREMIUM — PlenAula Fase 4
   XP Flutuante · Favoritos · Nível · Sons · Locks
   ===================================================== */

// ─── Configuração de Níveis ───────────────────────────────────────────────────
const NIVEIS = [
  { nivel: 1,  nome: 'Recruta',      min: 0    },
  { nivel: 2,  nome: 'Candidato',    min: 100  },
  { nivel: 3,  nome: 'Aspirante',    min: 250  },
  { nivel: 4,  nome: 'Soldado',      min: 500  },
  { nivel: 5,  nome: 'Cabo',         min: 900  },
  { nivel: 6,  nome: 'Sargento',     min: 1400 },
  { nivel: 7,  nome: 'Tenente',      min: 2000 },
  { nivel: 8,  nome: 'Capitão',      min: 2800 },
  { nivel: 9,  nome: 'Major',        min: 3800 },
  { nivel: 10, nome: 'Coronel',      min: 5000 },
  { nivel: 11, nome: 'Comandante',   min: 6500 },
  { nivel: 12, nome: 'Delegado',     min: 8500 },
  { nivel: 15, nome: 'Elite',        min: 12000},
  { nivel: 20, nome: 'Lenda',        min: 20000},
];

window.getNivelInfo = function(xp) {
  let atual = NIVEIS[0];
  let proximo = NIVEIS[1];
  for (let i = 0; i < NIVEIS.length; i++) {
    if (xp >= NIVEIS[i].min) {
      atual = NIVEIS[i];
      proximo = NIVEIS[i + 1] || null;
    }
  }
  const progresso = proximo
    ? Math.round(((xp - atual.min) / (proximo.min - atual.min)) * 100)
    : 100;
  const xpNaFaixa  = xp - atual.min;
  const xpMeta     = proximo ? proximo.min - atual.min : xpNaFaixa;
  return { ...atual, proximo, progresso, xpNaFaixa, xpMeta, xpTotal: xp };
};

// ─── Barra de Nível (Home) ────────────────────────────────────────────────────
window.renderLevelBar = function() {
  const container = document.getElementById('levelBarContainer');
  if (!container) return;
  const xp = parseInt(localStorage.getItem('quiz_xp') || '0');
  const info = window.getNivelInfo(xp);
  const proximoNome = info.proximo ? info.proximo.nome : 'Máximo';

  container.innerHTML = `
    <div class="lvl-bar-wrap">
      <div class="lvl-bar-left">
        <div class="lvl-badge">
          <span class="lvl-num">${info.nivel}</span>
        </div>
        <div class="lvl-info">
          <div class="lvl-nome">${info.nome}</div>
          <div class="lvl-xp">${info.xpNaFaixa} / ${info.xpMeta} XP → ${proximoNome}</div>
        </div>
      </div>
      <div class="lvl-pct">${info.progresso}%</div>
    </div>
    <div class="lvl-track">
      <div class="lvl-fill" style="width: ${info.progresso}%"></div>
    </div>
  `;
};

// ─── XP Flutuante (+25 XP) ───────────────────────────────────────────────────
window.mostrarXPGanho = function(xp, origem = null) {
  if (!xp || xp <= 0) return;

  // Descobre a posição de origem (botão clicado, center se não informado)
  let x = window.innerWidth / 2;
  let y = window.innerHeight * 0.65;
  if (origem instanceof Element) {
    const r = origem.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top;
  } else if (origem && typeof origem === 'object' && origem.x) {
    x = origem.x; y = origem.y;
  }

  const el = document.createElement('div');
  el.className = 'xp-float';
  el.textContent = `+${xp} XP`;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  document.body.appendChild(el);

  // Remove após animação
  setTimeout(() => el.remove(), 1500);

  // Atualiza a barra de nível se estiver visível
  setTimeout(() => window.renderLevelBar(), 600);
};

// Hook na função addXP global
const _addXPOriginal = window.addXP;
window.addXP = function(amount, origem) {
  if (typeof _addXPOriginal === 'function') _addXPOriginal(amount, origem);
  if (amount > 0) {
    setTimeout(() => window.mostrarXPGanho(amount, origem), 100);
    setTimeout(() => window.renderLevelBar(), 700);
    setTimeout(window.checarLevelUp, 800);
  }
};

// ─── Som de Recompensa (opcional, silencioso por padrão) ──────────────────────
let _somAtivado = localStorage.getItem('plenAula_som') !== 'off';

window.toggleSom = function() {
  _somAtivado = !_somAtivado;
  localStorage.setItem('plenAula_som', _somAtivado ? 'on' : 'off');
  const btn = document.getElementById('btnSomToggle');
  if (btn) btn.innerHTML = _somAtivado
    ? '<i class="ph-fill ph-speaker-high"></i>'
    : '<i class="ph-fill ph-speaker-slash"></i>';
};

window.tocarSom = function(tipo) {
  if (!_somAtivado) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.type = 'sine';
    if (tipo === 'acerto') {
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
    } else if (tipo === 'erro') {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.15);
    } else if (tipo === 'conquista') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(550, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.16);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.24);
    } else if (tipo === 'nivel') {
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.setValueAtTime(495, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.2);
      osc.frequency.setValueAtTime(990, ctx.currentTime + 0.3);
    }
    osc.start(); osc.stop(ctx.currentTime + 0.5);
  } catch(e) {}
};

// ─── Sistema de Favoritos ────────────────────────────────────────────────────
const FAVORITOS_KEY = 'plenAula_favoritos';

function _getFavoritos() {
  try { return JSON.parse(localStorage.getItem(FAVORITOS_KEY) || '{}'); } catch(e) { return {}; }
}

function _saveFavoritos(fav) {
  localStorage.setItem(FAVORITOS_KEY, JSON.stringify(fav));
}

window.toggleFavorito = function(tipo, id, nome, extra = {}) {
  const fav = _getFavoritos();
  const key = `${tipo}_${id}`;
  if (fav[key]) {
    delete fav[key];
    _saveFavoritos(fav);
    _atualizarBotoesFavorito(key, false);
    mostrarToastFavorito(false, nome);
  } else {
    fav[key] = { tipo, id, nome, extra, ts: Date.now() };
    _saveFavoritos(fav);
    _atualizarBotoesFavorito(key, true);
    mostrarToastFavorito(true, nome);
  }
  window.renderFavoritos();
};

window.isFavorito = function(tipo, id) {
  const fav = _getFavoritos();
  return !!fav[`${tipo}_${id}`];
};

function _atualizarBotoesFavorito(key, isFav) {
  document.querySelectorAll(`[data-fav-key="${key}"]`).forEach(btn => {
    btn.classList.toggle('fav-ativo', isFav);
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = isFav ? 'ph-fill ph-star' : 'ph ph-star';
    }
  });
}

function mostrarToastFavorito(adicionado, nome) {
  let t = document.getElementById('fav-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'fav-toast';
    document.body.appendChild(t);
  }
  t.className = 'fav-toast-anim';
  t.innerHTML = adicionado
    ? `<i class="ph-fill ph-star" style="color:#F59E0B;"></i> <span>⭐ Adicionado aos Favoritos</span>`
    : `<i class="ph ph-star"></i> <span>Removido dos Favoritos</span>`;
  
  t.style.animation = 'none';
  void t.offsetWidth;
  t.style.animation = null;
}

window.renderFavoritos = function() {
  const container = document.getElementById('favoritosLista');
  if (!container) return;
  const fav = _getFavoritos();
  const lista = Object.values(fav).sort((a, b) => b.ts - a.ts);

  if (lista.length === 0) {
    container.innerHTML = `
      <div class="fav-empty">
        <i class="ph ph-star" style="font-size:36px; color:rgba(255,255,255,0.15);"></i>
        <p>Nenhum favorito ainda</p>
        <small>Toque na ⭐ em matérias e flashcards para salvar.</small>
      </div>
    `;
    return;
  }

  const icones = { materia: 'ph-book-open', flashcard: 'ph-cards', aula: 'ph-video', missao: 'ph-map-pin' };
  const cores  = { materia: '#3B82F6', flashcard: '#F59E0B', aula: '#8B5CF6', missao: '#10B981' };

  container.innerHTML = lista.map(f => `
    <div class="fav-item" onclick="${f.tipo === 'materia' ? `go('resumos')` : ''}">
      <div class="fav-item-icon" style="background:${cores[f.tipo] || '#7C3AED'}22; border-color:${cores[f.tipo] || '#7C3AED'}44;">
        <i class="ph-fill ${icones[f.tipo] || 'ph-star'}" style="color:${cores[f.tipo] || '#7C3AED'};"></i>
      </div>
      <div class="fav-item-info">
        <div class="fav-item-nome">${f.nome}</div>
        <div class="fav-item-tipo">${f.tipo.charAt(0).toUpperCase() + f.tipo.slice(1)}</div>
      </div>
      <button class="fav-star-btn fav-ativo" data-fav-key="${f.tipo}_${f.id}"
        onclick="event.stopPropagation(); window.toggleFavorito('${f.tipo}', '${f.id}', '${f.nome.replace(/'/g, "\\'")}')">
        <i class="ph-fill ph-star"></i>
      </button>
    </div>
  `).join('');
};

// Botão de favorito genérico — renderiza inline
window.renderBotaoFavorito = function(tipo, id, nome, extra = {}) {
  const key = `${tipo}_${id}`;
  const on = window.isFavorito(tipo, id);
  return `
    <button class="fav-star-btn ${on ? 'fav-ativo' : ''}" data-fav-key="${key}"
      onclick="event.stopPropagation(); window.toggleFavorito('${tipo}', '${id}', '${nome.replace(/'/g, "\\'")}', ${JSON.stringify(extra).replace(/"/g, "'")})">
      <i class="${on ? 'ph-fill' : 'ph'} ph-star"></i>
    </button>
  `;
};

// ─── Confetti Premium (cores da carreira) ─────────────────────────────────────
window.confettiPremium = function(cor1 = '#7C3AED', cor2 = '#F59E0B') {
  if (!window.confetti) return;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
  const randomBetween = (min, max) => Math.random() * (max - min) + min;

  const interval = setInterval(() => {
    const timeLeft = 2000 - (Date.now() - startTime);
    if (timeLeft <= 0) { clearInterval(interval); return; }
    const particleCount = 50 * (timeLeft / 2000);
    confetti({ ...defaults, particleCount, origin: { x: randomBetween(0.1, 0.3), y: Math.random() - 0.2 }, colors: [cor1, cor2, '#fff', '#10B981'] });
    confetti({ ...defaults, particleCount, origin: { x: randomBetween(0.7, 0.9), y: Math.random() - 0.2 }, colors: [cor1, cor2, '#fff', '#F59E0B'] });
  }, 250);
  const startTime = Date.now();
};

// ─── Level Up! Toast ─────────────────────────────────────────────────────────
let _xpAnterior = parseInt(localStorage.getItem('quiz_xp') || '0');

window.checarLevelUp = function() {
  const xpAtual = parseInt(localStorage.getItem('quiz_xp') || '0');
  const nivelAntes = window.getNivelInfo(_xpAnterior);
  const nivelAgora = window.getNivelInfo(xpAtual);
  _xpAnterior = xpAtual;

  if (nivelAgora.nivel > nivelAntes.nivel) {
    _mostrarLevelUpOverlay(nivelAgora);
  }
};

function _mostrarLevelUpOverlay(info) {
  window.tocarSom('nivel');
  window.confettiPremium('#7C3AED', '#F59E0B');

  let overlay = document.getElementById('levelUpOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'levelUpOverlay';
    overlay.className = 'lvlup-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="lvlup-card" onclick="this.parentElement.classList.remove('lvlup-show')">
      <div class="lvlup-badge">NÍVEL</div>
      <div class="lvlup-num">${info.nivel}</div>
      <div class="lvlup-nome">${info.nome}</div>
      <div class="lvlup-sub">Nova patente desbloqueada! 🎖</div>
      <div class="lvlup-toque">Toque para continuar</div>
    </div>
  `;

  overlay.classList.remove('lvlup-show');
  void overlay.offsetWidth;
  overlay.classList.add('lvlup-show');
}

// ─── Preparação Premium (locks visuais) ───────────────────────────────────────
window.renderPremiumLock = function(label = 'Premium') {
  return `
    <div class="premium-lock">
      <i class="ph-fill ph-lock-key"></i>
      <span>${label}</span>
    </div>
  `;
};

window.isPremiumUser = function() {
  // Verificar se o usuário tem acesso premium (Firebase)
  try {
    const user = firebase.auth().currentUser;
    if (!user) return false;
    // Pode verificar custom claims ou Firestore aqui no futuro
    return false; // por enquanto todos são free
  } catch(e) { return false; }
};

// ─── Inicialização ────────────────────────────────────────────────────────────
(function initPremium() {
  function setup() {
    window.renderLevelBar();
    window.renderFavoritos();

    // Hook consolidado no topo do arquivo
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setTimeout(setup, 150);
  }
})();
