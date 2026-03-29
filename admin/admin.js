import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyB36ZszS8v_DeOn3at7zEo_tFq86WU0sI4",
  authDomain: "simulados-concursos-22c91.firebaseapp.com",
  projectId: "simulados-concursos-22c91"
};

const ADMIN_EMAIL = "lomateco@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, "us-central1");

const $ = (id) => document.getElementById(id);

let allUsers = [];
let usersChart = null;

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

  $("statTotal").textContent = total;
  $("statComEmail").textContent = comEmail;
  $("statHoje").textContent = hoje;
  $("statNovosHoje").textContent = novosHoje;
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

function renderChart(users) {
  const canvas = $("usersChart");
  if (!canvas || typeof Chart === "undefined") return;

  const { labels, values } = groupUsersByDay(users);

  if (usersChart) {
    usersChart.destroy();
  }

  usersChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Novos usuários",
          data: values,
          tension: 0.35,
          fill: false,
          borderWidth: 3,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#e5e7eb"
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#94a3b8"
          },
          grid: {
            color: "rgba(148,163,184,.12)"
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#94a3b8",
            precision: 0
          },
          grid: {
            color: "rgba(148,163,184,.12)"
          }
        }
      }
    }
  });
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
  if (!user) {
    window.location.href = "./login.html";
    return;
  }

  if (user.email !== ADMIN_EMAIL) {
    showAccessDenied();
    return;
  }

  setStatus(`Logado como administrador: ${user.email}`);
  await carregarUsuarios();
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
