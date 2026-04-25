const firebaseConfig = {
  // ATENÇÃO: Substitua a apiKey e o appId com os valores do seu novo projeto no Console do Firebase
  apiKey: "AIzaSyD2c_pcK6L9PFrYxBVRWWuZVVh3XKEfr-o", 
  authDomain: "simulados-concursos-22c91.firebaseapp.com",
  projectId: "simulados-concursos-22c91",
  storageBucket: "simulados-concursos-22c91.firebasestorage.app",
  messagingSenderId: "COLE_SEU_MESSAGING_SENDER_ID_AQUI",
  appId: "COLE_SEU_APP_ID_AQUI",
  measurementId: "COLE_SEU_MEASUREMENT_ID_AQUI"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

const TRIAL_DAYS = 4;
const PREMIUM_DAYS = 365;

async function loginWithGoogle() {
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    
    const userRef = db.collection('users').doc(user.uid);
    const doc = await userRef.get();

    if (!doc.exists) {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + (TRIAL_DAYS * 24 * 60 * 60 * 1000));
      
      await userRef.set({
        email: user.email,
        displayName: user.displayName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        plan: "free",
        trialStart: now.toISOString(),
        trialEnd: trialEnd.toISOString(),
        status: "active"
      });
    }

    window.location.href = "app.html";
     
  } catch (error) {
    console.error("Erro no login: ", error);
    if(error.code !== 'auth/popup-closed-by-user') {
      alert("Falha ao entrar com Google. Tente novamente.");
    }
  }
}

async function logoutUser() {
  await auth.signOut();
  window.location.href = "login.html";
}

// Login com E-mail e Senha
async function loginWithEmailPassword(email, password) {
  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    window.location.href = "app.html";
  } catch (error) {
    console.error("Erro no login: ", error);
    let msg = "Erro ao entrar. Verifique seu e-mail e senha.";
    if (error.code === 'auth/user-not-found') msg = "Usuário não encontrado.";
    if (error.code === 'auth/wrong-password') msg = "Senha incorreta.";
    alert(msg);
    throw error;
  }
}

// Redirecionamento automático se já estiver logado
auth.onAuthStateChanged(user => {
  const isLoginPage = window.location.pathname.includes('index.html') || window.location.pathname.includes('login.html');
  if (user && isLoginPage) {
    window.location.href = "app.html";
  }
});
