import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyB36ZszS8v_DeOn3at7zEo_tFq86WU0sI4",
  authDomain: "simulados-concursos-22c91.firebaseapp.com",
  projectId: "simulados-concursos-22c91"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, "southamerica-east1");

const $ = (id) => document.getElementById(id);

let allUsers = [];
let usersChart = null;
let monthlyChart = null;

function setStatus(msg) {
  const el = $("statusMsg");
  if (el) el.textContent = msg;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  if (isNaN(date.getTime())) return false;

  const now = new Date();

  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function isThisWeek(value) {
  if (!value) return false;
  const date = new Date(value);
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays <= 7;
}

function isInactive(value) {
  if (!value) return true;
  const date = new Date(value);
  if (isNaN(date.getTime())) return true;
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays > 30;
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderProviders(providers) {
  if (!providers) return '<span class="badge">Sem provedor</span>';

  const list = String(providers)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!list.length) return '<span class="badge">Sem provedor</span>';

  return list
    .map((item) => `<span class="badge">${escapeHtml(item)}</span>`)
    .join("");
}

function renderStatusBadge(disabled) {
  if (disabled) {
    return '<span class="badge badge-disabled">Bloqueado</span>';
  }
  return '<span class="badge">Ativo</span>';
}

function updateDashboard(users) {
  const total = users.length;
  const comEmail = users.filter((u) => u.email).length;
  const hoje = users.filter((u) => isToday(u.lastLogin)).length;
  const novosHoje = users.filter((u) => isToday(u.createdAt)).length;
  const semana = users.filter((u) => isThisWeek(u.lastLogin)).length;
  const inativos = users.filter((u) => isInactive(u.lastLogin)).length;

  $("statTotal").textContent = total;
  $("statComEmail").textContent = comEmail;
  $("statHoje").textContent = hoje;
  $("statNovosHoje").textContent = novosHoje;
  if ($("statSemana")) $("statSemana").textContent = semana;
  if ($("statInativos")) $("statInativos").textContent = inativos;
}

function updateResultInfo(total, filtered) {
  const el = $("resultInfo");
  if (!el) return;

  if (filtered === total) {
    el.textContent = `${filtered} resultado${filtered === 1 ? "" : "s"}`;
    return;
  }

  el.textContent = `${filtered} de ${total} resultado${filtered === 1 ? "" : "s"}`;
}

function groupUsersByDay(users) {
  const map = new Map();

  users.forEach((u) => {
    if (!u.createdAt) return;
    const date = new Date(u.createdAt);
    if (isNaN(date.getTime())) return;

    const key = date.toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + 1);
  });

  const sortedEntries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const lastEntries = sortedEntries.slice(-10);

  return {
    labels: lastEntries.map(([date]) => {
      const d = new Date(date + "T00:00:00");
      return d.toLocaleDateString("pt-BR");
    }),
    values: lastEntries.map(([, count]) => count)
  };
}

function groupUsersByMonth(users) {
  const map = new Map();

  users.forEach((u) => {
    if (!u.createdAt) return;
    const date = new Date(u.createdAt);
    if (isNaN(date.getTime())) return;

    const key = date.toISOString().slice(0, 7);
    map.set(key, (map.get(key) || 0) + 1);
  });

  const sortedEntries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  return {
    labels: sortedEntries.map(([dateKey]) => {
      const [year, month] = dateKey.split("-");
      return `${monthNames[parseInt(month, 10) - 1]}/${year}`;
    }),
    values: sortedEntries.map(([, count]) => count)
  };
}

function renderChart(users) {
  const canvas = $("usersChart");
  if (canvas && typeof Chart !== "undefined") {
    const { labels, values } = groupUsersByDay(users);

    if (usersChart) usersChart.destroy();

    usersChart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Novos usuários (Diário)",
          data: values,
          tension: 0.35,
          fill: false,
          borderWidth: 3,
          pointRadius: 4,
          borderColor: "#2563eb"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#e5e7eb" } } },
        scales: {
          x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,.12)" } },
          y: { beginAtZero: true, ticks: { color: "#94a3b8", precision: 0 }, grid: { color: "rgba(148,163,184,.12)" } }
        }
      }
    });
  }

  const canvasMonth = $("monthlyChart");
  if (canvasMonth && typeof Chart !== "undefined") {
    const { labels, values } = groupUsersByMonth(users);
    
    if (monthlyChart) monthlyChart.destroy();

    monthlyChart = new Chart(canvasMonth, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Novos usuários (Mensal)",
          data: values,
          backgroundColor: "#10b981",
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#e5e7eb" } } },
        scales: {
          x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: "#94a3b8", precision: 0 }, grid: { color: "rgba(148,163,184,.12)" } }
        }
      }
    });
  }
}

function renderActionButton(user) {
  if (user.disabled) {
    return `
      <button class="action-btn action-unblock" data-action="toggle-status" data-uid="${escapeHtml(user.uid)}" data-disabled="true">
        Desbloquear
      </button>
    `;
  }

  return `
    <button class="action-btn action-block" data-action="toggle-status" data-uid="${escapeHtml(user.uid)}" data-disabled="false">
      Bloquear
    </button>
  `;
}

function renderTable(users) {
  const tbody = $("tabelaUsuarios");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!users.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">Nenhum usuário encontrado.</td>
      </tr>
    `;
    return;
  }

  users.forEach((u) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="email">${escapeHtml(u.email || "Sem e-mail")}</td>
      <td class="uid">${escapeHtml(u.uid || "")}</td>
      <td>${renderProviders(u.providers)}</td>
      <td>${renderStatusBadge(!!u.disabled)}</td>
      <td>${escapeHtml(formatDate(u.createdAt) || "-")}</td>
      <td>${escapeHtml(formatDate(u.lastLogin) || "-")}</td>
      <td>${renderActionButton(u)}</td>
    `;

    tbody.appendChild(tr);
  });
}

function applyFilter() {
  const term = ($("searchInput")?.value || "").trim().toLowerCase();

  if (!term) {
    renderTable(allUsers);
    updateResultInfo(allUsers.length, allUsers.length);
    return;
  }

  const filtered = allUsers.filter((u) => {
    const email = String(u.email || "").toLowerCase();
    const uid = String(u.uid || "").toLowerCase();
    const providers = String(u.providers || "").toLowerCase();

    return (
      email.includes(term) ||
      uid.includes(term) ||
      providers.includes(term)
    );
  });

  renderTable(filtered);
  updateResultInfo(allUsers.length, filtered.length);
}

async function carregarUsuarios() {
  try {
    setStatus("Carregando usuários...");

    const tbody = $("tabelaUsuarios");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">Carregando usuários...</td>
        </tr>
      `;
    }

    const listUsersCall = httpsCallable(functions, "listUsersV2");
    const result = await listUsersCall();

    allUsers = Array.isArray(result.data) ? result.data : [];

    allUsers.sort((a, b) => {
      const da = new Date(a.createdAt || 0).getTime();
      const db = new Date(b.createdAt || 0).getTime();
      return db - da;
    });

    updateDashboard(allUsers);
    renderChart(allUsers);
    renderTable(allUsers);
    updateResultInfo(allUsers.length, allUsers.length);

    if (!allUsers.length) {
      setStatus("Nenhum usuário cadastrado.");
      return;
    }

    setStatus(`Usuários carregados com sucesso: ${allUsers.length}`);
  } catch (e) {
    console.error("Erro ao carregar usuários:", e);

    const tbody = $("tabelaUsuarios");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">Erro ao carregar usuários.</td>
        </tr>
      `;
    }

    $("statTotal").textContent = "0";
    $("statComEmail").textContent = "0";
    $("statHoje").textContent = "0";
    $("statNovosHoje").textContent = "0";
    updateResultInfo(0, 0);

    if (usersChart) {
      usersChart.destroy();
      usersChart = null;
    }
    if (monthlyChart) {
      monthlyChart.destroy();
      monthlyChart = null;
    }

    setStatus("Erro ao carregar usuários.");
    alert(
      "Erro ao carregar usuários.\n\n" +
      "Verifique:\n" +
      "1. Se a função 'listUsersV2' existe no Firebase\n" +
      "2. Se ela está publicada\n" +
      "3. Se a região da função está correta\n" +
      "4. Se o usuário logado tem permissão de admin"
    );
  }
}

async function toggleUserStatus(uid, currentlyDisabled) {
  try {
    setStatus(currentlyDisabled ? "Desbloqueando usuário..." : "Bloqueando usuário...");

    const toggleStatusCall = httpsCallable(functions, "toggleUserStatus");
    await toggleStatusCall({
      uid,
      disabled: !currentlyDisabled
    });

    await carregarUsuarios();
    applyFilter();

    setStatus(currentlyDisabled ? "Usuário desbloqueado com sucesso." : "Usuário bloqueado com sucesso.");
  } catch (e) {
    console.error("Erro ao alterar status do usuário:", e);
    setStatus("Erro ao alterar status do usuário.");
    alert("Não foi possível alterar o status do usuário.");
  }
}

function showAccessDenied() {
  document.body.className = "";
  document.body.innerHTML = `
    <div style="
      display:flex;
      align-items:center;
      justify-content:center;
      min-height:100vh;
      font-family:Inter,sans-serif;
      background:#0b1220;
      color:#fff;
      padding:24px;
    ">
      <div style="
        width:100%;
        max-width:520px;
        background:#0f172a;
        border:1px solid #1e293b;
        border-radius:18px;
        padding:32px 24px;
        text-align:center;
        box-shadow:0 10px 30px rgba(0,0,0,.35);
      ">
        <h1 style="margin:0 0 10px;font-size:30px;">Acesso negado</h1>
        <p style="margin:0 0 20px;opacity:.8;line-height:1.6;">
          Este painel é restrito ao administrador autorizado.
        </p>
        <button
          id="btnLogoutBlock"
          style="
            padding:12px 18px;
            border-radius:12px;
            border:none;
            background:#2563eb;
            color:#fff;
            cursor:pointer;
            font-weight:700;
          "
        >
          Voltar ao login
        </button>
      </div>
    </div>
  `;

  const btn = document.getElementById("btnLogoutBlock");
  if (btn) {
    btn.onclick = async () => {
      try {
        await signOut(auth);
      } catch (e) {
        console.error("Erro ao sair:", e);
      }
      window.location.href = "./login.html";
    };
  }
}

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      showAccessDenied();
      return;
    }

    const token = await user.getIdTokenResult(true);
    if (token.claims.admin !== true) {
      showAccessDenied();
      return;
    }

    document.body.classList.remove('admin-pending');
    document.body.classList.add('admin-authorized');
    setStatus(`Logado como administrador: ${user.email}`);
    await carregarUsuarios();
  } catch (error) {
    console.error('Falha ao verificar a permissão administrativa:', error);
    showAccessDenied();
  }
});

const btnLogout = $("btnLogout");
if (btnLogout) {
  btnLogout.onclick = async () => {
    try {
      await signOut(auth);
      window.location.href = "./login.html";
    } catch (e) {
      console.error("Erro ao sair:", e);
      alert("Não foi possível sair.");
    }
  };
}

const btnRefresh = $("btnRefresh");
if (btnRefresh) {
  btnRefresh.onclick = async () => {
    await carregarUsuarios();
    applyFilter();
  };
}

const btnExportCSV = $("btnExportCSV");
if (btnExportCSV) {
  btnExportCSV.onclick = () => {
    if (!allUsers.length) return alert("Nenhum usuário para exportar.");
    
    const headers = ["Email", "UID", "Provedores", "Status", "Data_Criacao", "Ultimo_Login"];
    let csvContent = headers.join(";") + "\n";
    
    allUsers.forEach(u => {
      const email = u.email || "";
      const uid = u.uid || "";
      const providers = u.providers || "";
      const status = u.disabled ? "Bloqueado" : "Ativo";
      const createdAt = formatDate(u.createdAt) || "";
      const lastLogin = formatDate(u.lastLogin) || "";
      
      const row = [email, uid, providers, status, createdAt, lastLogin].map(v => `"${v}"`);
      csvContent += row.join(";") + "\n";
    });
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `usuarios_plenaula_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
}

const searchInput = $("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", applyFilter);
}

document.addEventListener("click", async (event) => {
  const btn = event.target.closest('[data-action="toggle-status"]');
  if (!btn) return;

  const uid = btn.dataset.uid;
  const currentlyDisabled = btn.dataset.disabled === "true";

  const confirmMessage = currentlyDisabled
    ? "Deseja desbloquear este usuário?"
    : "Deseja bloquear este usuário?";

  const confirmed = window.confirm(confirmMessage);
  if (!confirmed) return;

  await toggleUserStatus(uid, currentlyDisabled);
});

// ==========================================
// MÓDULO DE GESTÃO DE CONTEÚDO (CMS)
// ==========================================
const db = getFirestore(app);
let subjectsData = [];

window.loadSubjects = async function() {
  const grid = $("subjectsGrid");
  if(!grid) return;
  grid.innerHTML = '<div class="empty-state">Carregando matérias do sistema...</div>';
  try {
    const snap = await getDocs(collection(db, "materias_aulas"));
    subjectsData = [];
    
    // Auto-Migrate from old array if Empty!
    if(snap.empty) {
      grid.innerHTML = '<div class="empty-state">Banco zerado. Migrando catálogo antigo automaticamente, aguarde...</div>';
      await autoMigrateOldCatalog();
      const newSnap = await getDocs(collection(db, "materias_aulas"));
      newSnap.forEach(doc => { subjectsData.push({ id: doc.id, ...doc.data() }); });
    } else {
      snap.forEach(doc => { subjectsData.push({ id: doc.id, ...doc.data() }); });
    }
    
    renderSubjects();
  } catch(e) {
    grid.innerHTML = '<div class="empty-state">Erro de permissão ou conexão ao carregar matérias. Lembre-se de adicionar a regra no console do Firestore!</div>';
    console.error(e);
  }
}

async function autoMigrateOldCatalog() {
  const OLD_MEDIA_CATALOG = [
    { id: 'crimes-hediondos', name: 'Crimes Hediondos', icon: 'ph-warning-diamond', resumoFile: 'crimes-hediondos.html', videos: [{ title: 'Crimes Hediondos - Aula Completa', youtubeId: 'vi9bOFRQSVc', duration: 'Vídeo' }], audios: [{ title: 'Jurisprudência dos crimes hediondos', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/07%20Jurisprud%C3%AAncia%20dos%20crimes%20hediondos.m4a', duration: 'Áudio' }] },
    { id: 'direito-constitucional', name: 'Direito Constitucional', icon: 'ph-book-open', resumoFile: 'direito-constitucional.html', videos: [], audios: [] },
    { id: 'direito-administrativo', name: 'Direito Administrativo', icon: 'ph-scales', resumoFile: 'direito-administrativo.html', videos: [], audios: [] },
    { id: 'codigo-penal', name: 'Código Penal / Direito Penal', icon: 'ph-gavel', resumoFile: 'codigo-penal.html', videos: [{ title: 'Direito Penal - Aula Completa', youtubeId: 'vXuZA836FDY', duration: 'Vídeo' }], audios: [{ title: 'Direito penal e jurisprudência para concursos', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/09%20Direito%20penal%20e%20jurisprud%C3%AAncia%20para%20concursos.m4a', duration: 'Áudio' }] },
    { id: 'maria-da-penha', name: 'Lei Maria da Penha', icon: 'ph-gender-female', resumoFile: 'maria-da-penha.html', videos: [{ title: 'Lei Maria da Penha - Aula Completa', youtubeId: 'MJg4lnlTEI4', duration: 'Vídeo' }], audios: [{ title: 'Maria da Penha', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/04%20Maria%20da%20Penha.m4a', duration: 'Áudio' }] },
    { id: 'eca', name: 'Estatuto da Criança (ECA)', icon: 'ph-baby', resumoFile: 'estatuto-da-criança-e-do-adolescente.html', videos: [{ title: 'ECA - Aula Completa', youtubeId: 'B-1iTZLf-bM', duration: 'Vídeo' }], audios: [{ title: 'ECA', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/01%20ECA%20-%20Estatuto%20da%20Crian%C3%A7a%20e%20do%20Adolecente.m4a', duration: 'Áudio' }], slides: [{ title: 'ECA - Estatuto da Criança', url: 'https://drive.google.com/file/d/19O1RntU-PKnycl2xDkeFnZUrzSnUUtLQ/preview', duration: 'PDF' }] },
    { id: 'lei-de-drogas', name: 'Lei de Drogas', icon: 'ph-pills', resumoFile: 'lei-de-drogas.html', videos: [{ title: 'Lei de Drogas - Aula Completa', youtubeId: 'z7CEDMpeTPI', duration: 'Vídeo' }], audios: [{ title: 'Jurisprudência da Lei de Drogas', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/08%20Jurisprud%C3%AAncia%20da%20Lei%20de%20Drogas.m4a', duration: 'Áudio' }] },
    { id: 'abuso-de-autoridade', name: 'Abuso de Autoridade', icon: 'ph-shield-warning', resumoFile: 'abuso-de-autoridade.html', videos: [{ title: 'Abuso de Autoridade - Aula Completa', youtubeId: 'E5VDO_sv-mI', duration: 'Vídeo' }], audios: [{ title: 'Abuso de Autoridade', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/02%20Abuso%20de%20Autoridade.m4a', duration: 'Áudio' }], slides: [{ title: 'Abuso de Autoridade', url: 'https://drive.google.com/file/d/1JDRIvg3mLFUMUQnnXb7Zc2HKjM2diP6L/preview', duration: 'PDF' }] },
    { id: 'crimes-ambientais', name: 'Crimes Ambientais', icon: 'ph-tree', resumoFile: 'crimes-ambientais.html', videos: [{ title: 'Crimes Ambientais - Aula Completa', youtubeId: 'EQF4Ig5Ojco', duration: 'Vídeo' }], audios: [{ title: 'Crimes Ambientais', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/06%20Crimes%20Ambientais.m4a', duration: 'Áudio' }] },
    { id: 'crimes-de-tortura', name: 'Crimes de Tortura', icon: 'ph-hand-palm', resumoFile: 'crimes-de-tortura.html', videos: [{ title: 'Lei Anti-tortura', youtubeId: 'qGliuzL-7pA', duration: 'Vídeo' }], audios: [{ title: 'Lei da Tortura', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/03%20Lei%20da%20Tortura.m4a', duration: 'Áudio' }] },
    { id: 'crimes-preconceito', name: 'Crimes de Preconceito', icon: 'ph-users-three', resumoFile: 'crimes-preconceito-raça-cor.html', videos: [{ title: 'Injúria Racial', youtubeId: 'l9GkQYqpvl8', duration: 'Vídeo' }], audios: [{ title: 'Injúria Racial', url: 'https://ia600604.us.archive.org/34/items/03-lei-da-tortura/05%20Inj%C3%BAria%20Racial.m4a', duration: 'Áudio' }] },
    { id: 'procedimentos-penais', name: 'Procedimentos Penais', icon: 'ph-files', resumoFile: 'procedimentos-penais.html', videos: [], audios: [] },
    { id: 'direitos-humanos', name: 'Direitos Humanos', icon: 'ph-globe-hemisphere-west', resumoFile: 'direitos-humanos.html', videos: [], audios: [], slides: [{ title: 'Direitos Humanos', url: 'https://drive.google.com/file/d/14jEkvsyThDz3-l1CN4lDccerYb9guyFV/preview', duration: 'PDF' }] },
    { id: 'estatuto-das-guardas', name: 'Estatuto das Guardas Municipais', icon: 'ph-shield-check', resumoFile: 'estatuto-das-guardas.html', videos: [], audios: [], slides: [{ title: 'Estatuto das Guardas Municipais', url: 'https://drive.google.com/file/d/1BX5OwoR5llMthpvV1THgEbty7uxhvVz-/preview', duration: 'PDF' }] }
  ];
  for(const sub of OLD_MEDIA_CATALOG) {
    try {
      const { id, ...data } = sub;
      await setDoc(doc(db, "materias_aulas", id), data);
    } catch(e) {}
  }
}

function renderSubjects() {
  const grid = $("subjectsGrid");
  if(!grid) return;
  if(subjectsData.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Nenhuma matéria cadastrada.</div>';
    return;
  }
  let html = '';
  subjectsData.forEach(sub => {
    const vCount = sub.videos ? sub.videos.length : 0;
    const aCount = sub.audios ? sub.audios.length : 0;
    const sCount = sub.slides ? sub.slides.length : 0;
    
    html += `
      <div class="subject-card">
        <h3><i class="${escapeHtml(sub.icon)}"></i> ${escapeHtml(sub.name)}</h3>
        <p>Resumo: <strong>${escapeHtml(sub.resumoFile || 'Nenhum')}</strong></p>
        <div class="subject-actions">
          <button class="btn-sm btn-blue" onclick="window.openSubjectModal('${sub.id}')">Editar Matéria</button>
          <button class="btn-sm btn-red" onclick="window.deleteSubject('${sub.id}')">Excluir</button>
        </div>
        
        <div class="subject-actions" style="margin-bottom:0">
          <button class="btn-sm btn-gray" onclick="window.openMediaModal('${sub.id}')">+ Adicionar Mídia</button>
        </div>
        
        <div class="media-list">
          ${(sub.videos||[]).map((v, i) => `
            <div class="media-item">
              <div class="media-item-info">
                <span class="media-item-type" style="color:#ef4444">VÍDEO</span>
                <strong>${escapeHtml(v.title)}</strong>
              </div>
              <button class="modal-close" style="font-size:16px" onclick="window.deleteMedia('${sub.id}', 'videos', ${i})">×</button>
            </div>
          `).join('')}
          ${(sub.audios||[]).map((a, i) => `
            <div class="media-item">
              <div class="media-item-info">
                <span class="media-item-type" style="color:#10b981">ÁUDIO</span>
                <strong>${escapeHtml(a.title)}</strong>
              </div>
              <button class="modal-close" style="font-size:16px" onclick="window.deleteMedia('${sub.id}', 'audios', ${i})">×</button>
            </div>
          `).join('')}
          ${(sub.slides||[]).map((s, i) => `
            <div class="media-item">
              <div class="media-item-info">
                <span class="media-item-type" style="color:#3b82f6">SLIDE</span>
                <strong>${escapeHtml(s.title)}</strong>
              </div>
              <button class="modal-close" style="font-size:16px" onclick="window.deleteMedia('${sub.id}', 'slides', ${i})">×</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });
  grid.innerHTML = html;
}

window.openSubjectModal = function(id = null) {
  const sub = subjectsData.find(s => s.id === id);
  $('subjectId').value = id || '';
  $('subjectName').value = sub ? sub.name : '';
  $('subjectIcon').value = sub ? sub.icon : '';
  $('subjectResumo').value = sub ? sub.resumoFile : '';
  $('subjectFriendlyId').value = id || '';
  $('subjectFriendlyId').disabled = !!id; // Cannot change ID after creation easily
  $('subjectModalTitle').innerText = id ? 'Editar Matéria' : 'Nova Matéria';
  window.openModal('subjectModal');
}

window.saveSubject = async function() {
  const idToUpdate = $('subjectId').value;
  let docId = $('subjectFriendlyId').value.trim() || idToUpdate;
  if(!docId) return alert("Preencha o ID da matéria.");
  const data = {
    name: $('subjectName').value,
    icon: $('subjectIcon').value,
    resumoFile: $('subjectResumo').value
  };
  try {
    const btn = event.target; btn.textContent = 'Salvando...'; btn.disabled = true;
    await setDoc(doc(db, "materias_aulas", docId), data, {merge: true});
    window.closeModal('subjectModal');
    await window.loadSubjects();
    btn.textContent = 'Salvar Matéria'; btn.disabled = false;
  } catch(e) { alert("Erro ao salvar!"); console.error(e); }
}

window.deleteSubject = async function(id) {
  if(!confirm(`Tem certeza que deseja excluir a matéria ${id} e todas as suas aulas?`)) return;
  try {
    await deleteDoc(doc(db, "materias_aulas", id));
    await window.loadSubjects();
  } catch(e) { alert("Erro ao excluir!"); console.error(e); }
}

window.openMediaModal = function(subjectId) {
  $('mediaSubjectId').value = subjectId;
  $('mediaTitle').value = '';
  $('mediaUrl').value = '';
  $('mediaDur').value = '';
  $('mediaTypeSelect').value = 'videos';
  window.openModal('mediaModal');
}

window.saveMedia = async function() {
  const sid = $('mediaSubjectId').value;
  const type = $('mediaTypeSelect').value;
  const title = $('mediaTitle').value;
  const urlOrId = $('mediaUrl').value;
  const dur = $('mediaDur').value;
  
  if(!title || !urlOrId) return alert("Preencha título e URL.");
  
  const sub = subjectsData.find(s => s.id === sid);
  if(!sub) return;
  
  const newItem = { title: title, duration: dur };
  if(type === 'videos') newItem.youtubeId = urlOrId;
  else newItem.url = urlOrId;
  
  const currentArray = sub[type] || [];
  currentArray.push(newItem);
  
  try {
    const btn = event.target; btn.textContent = 'Salvando...'; btn.disabled = true;
    await updateDoc(doc(db, "materias_aulas", sid), { [type]: currentArray });
    window.closeModal('mediaModal');
    await window.loadSubjects();
    btn.textContent = 'Salvar Mídia'; btn.disabled = false;
  } catch(e) { alert("Erro ao adicionar mídia."); console.error(e); }
}

window.deleteMedia = async function(subjectId, type, index) {
  if(!confirm("Remover esta mídia?")) return;
  const sub = subjectsData.find(s => s.id === subjectId);
  if(!sub) return;
  const currentArray = sub[type] || [];
  currentArray.splice(index, 1);
  try {
    await updateDoc(doc(db, "materias_aulas", subjectId), { [type]: currentArray });
    await window.loadSubjects();
  } catch(e) { alert("Erro ao remover mídia."); }
}

// Inicializa a aba de conteúdo após o login confirmar adm
const originalCarregar = carregarUsuarios;
carregarUsuarios = async function() {
  await originalCarregar();
  await window.loadSubjects();
};
