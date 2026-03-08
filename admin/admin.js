import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

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

function renderTable(users) {
  const tbody = $("tabelaUsuarios");

  if (!tbody) return;

  tbody.innerHTML = "";

  if (!users.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">Nenhum usuário encontrado.</td>
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
      <td>${escapeHtml(formatDate(u.createdAt) || "-")}</td>
      <td>${escapeHtml(formatDate(u.lastLogin) || "-")}</td>
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
          <td colspan="5" class="empty-state">Carregando usuários...</td>
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
          <td colspan="5" class="empty-state">Erro ao carregar usuários.</td>
        </tr>
      `;
    }

    $("statTotal").textContent = "0";
    $("statComEmail").textContent = "0";
    $("statHoje").textContent = "0";
    $("statNovosHoje").textContent = "0";
    updateResultInfo(0, 0);

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

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./login.html";
    return;
  }

  setStatus(`Logado como: ${user.email || "usuário sem e-mail"}`);
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
  };
}

const searchInput = $("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", applyFilter);
}
