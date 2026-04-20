const firebaseConfig = {
  apiKey: "AIzaSyD2c_pcK6L9PFrYxBVRWWuZVVh3XKEfr-o",
  authDomain: "simulados-concursos-22c91.firebaseapp.com",
  projectId: "simulados-concursos-22c91",
  storageBucket: "simulados-concursos-22c91.firebasestorage.app",
  messagingSenderId: "863699339166",
  appId: "1:863699339166:web:2fd125a35c090ca1ae388f"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Acesso 100% gratuito e vitalício

async function loginWithEmail(email, password) {
  try {
    await auth.signInWithEmailAndPassword(email, password);
    window.location.href = "app.html";
  } catch (error) {
    console.error("Erro no login: ", error);
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      throw new Error("E-mail ou senha incorretos.");
    } else {
      throw new Error("Ocorreu um erro. Tente novamente.");
    }
  }
}

async function registerWithEmail(name, email, password) {
  try {
    const result = await auth.createUserWithEmailAndPassword(email, password);
    const user = result.user;
    
    await user.updateProfile({
      displayName: name
    });

    const userRef = db.collection('users').doc(user.uid);
    await userRef.set({
      email: user.email,
      displayName: name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      plan: "premium",
      status: "active"
    });

    window.location.href = "app.html";
     
  } catch (error) {
    console.error("Erro no registro: ", error);
    if (error.code === 'auth/email-already-in-use') {
       throw new Error("Este e-mail já está cadastrado.");
    } else if (error.code === 'auth/weak-password') {
       throw new Error("A senha deve ter pelo menos 6 caracteres.");
    } else {
       throw new Error("Erro ao criar conta. Tente novamente.");
    }
  }
}

async function logoutUser() {
  await auth.signOut();
  window.location.href = "index.html";
}
