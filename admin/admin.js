import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB36ZszS8v_DeOn3at7zEo_tFq86WU0sI4",
  authDomain: "simulados-concursos-22c91.firebaseapp.com",
  projectId: "simulados-concursos-22c91"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);

// Proteção do painel
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    $("userEmail").innerText = user.email;
    await carregarUsuarios();
  }
});

// Carregar dados de usuários
async function carregarUsuarios() {
  try {
    const usuariosCol = collection(db, "usuarios");
    const snapshot = await getDocs(usuariosCol);
    $("totalUsers").innerText = snapshot.size;

    const logins = snapshot.docs
      .map(doc => doc.data().lastLogin)
      .filter(Boolean)
      .sort((a,b)=>new Date(b)-new Date(a));

    $("lastLogin").innerText = logins[0] ? new Date(logins[0]).toLocaleString("pt-BR") : "—";

    $("recentLogins").innerText = logins.slice(0,3).map(d=>new Date(d).toLocaleString("pt-BR")).join(", ") || "—";
  } catch(err) {
    console.error("Erro ao carregar usuários:", err);
  }
}

// Logout
$("btnLogout").onclick = async () => {
  await signOut(auth);
  window.location.href = "login.html";
};
