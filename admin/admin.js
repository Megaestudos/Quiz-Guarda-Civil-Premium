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

/*
  IMPORTANTE:
  Se sua Cloud Function estiver em outra região, troque aqui.
  Exemplo:
  const functions = getFunctions(app, "southamerica-east1");
*/
const functions = getFunctions(app, "southamerica-east1");

const $ = (id) => document.getElementById(id);

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

async function carregarUsuarios() {
  try {
    setStatus("Carregando usuários...");

    const listUsersCall = httpsCallable(functions, "listUsersV2");
    const result = await listUsersCall();

    const tbody = $("tabelaUsuarios");
    tbody.innerHTML = "";

    const users = Array.isArray(result.data) ? result.data : [];

    if (!users.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5">Nenhum usuário encontrado.</td>
        </tr>
      `;
      setStatus("Nenhum usuário cadastrado.");
      return;
    }

    users.forEach((u) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${u.email || ""}</td>
        <td>${u.uid || ""}</td>
        <td>${u.providers || ""}</td>
        <td>${formatDate(u.createdAt)}</td>
        <td>${formatDate(u.lastLogin)}</td>
      `;
      tbody.appendChild(tr);
    });

    setStatus(`Usuários carregados: ${users.length}`);
  } catch (e) {
    console.error("Erro ao carregar usuários:", e);

    const tbody = $("tabelaUsuarios");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5">Erro ao carregar usuários.</td>
        </tr>
      `;
    }

    setStatus("Erro ao carregar usuários.");

    alert(
      "Erro ao carregar usuários.\n\n" +
      "Verifique:\n" +
      "1. Se a função 'listUsers' existe no Firebase\n" +
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
