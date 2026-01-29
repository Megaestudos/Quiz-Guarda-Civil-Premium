import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB36ZszS8v_DeOn3at7zEo_tFq86WU0sI4",
  authDomain: "simulados-concursos-22c91.firebaseapp.com",
  projectId: "simulados-concursos-22c91"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

// ✅ Aqui é onde você coloca o onAuthStateChanged
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // não está logado → volta pro login
    window.location.href = "login.html";
  } else {
    // está logado → carregar dados do painel
    $("userEmail").innerText = user.email;
    carregarUsuarios(); // função que você vai ter para puxar dados do Firebase
  }
});

// Função exemplo para puxar usuários
async function carregarUsuarios() {
  const usersCol = collection(db, "usuarios");
  const usersSnapshot = await getDocs(usersCol);
  $("totalUsers").innerText = usersSnapshot.size;
}
