const firebaseConfig = {
  apiKey: "AIzaSyDXBrNIPfIBAkom9fafCorwhUw1FQ9nSCg",
  authDomain: "plenaula-concursos.firebaseapp.com",
  projectId: "plenaula-concursos",
  storageBucket: "plenaula-concursos.firebasestorage.app",
  messagingSenderId: "433280443325",
  appId: "1:433280443325:web:8ed2a8bea4b3e4d6d9a8d4",
  measurementId: "G-908KRQCKS8"
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
  window.location.href = "index.html";
}
