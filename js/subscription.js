let currentUserDoc = null;
let countdownInterval = null;

auth.onAuthStateChanged(async (user) => {
  const path = window.location.pathname.toLowerCase();
  const isResumos = path.includes('/resumos/');
  const isApp = path.includes('app.html');
  const isLanding = (path.endsWith('index.html') && !isResumos) || (path.endsWith('/') && !isResumos) || path.includes('/sass');

  if (!user) {
    if (isApp || isResumos) {
        window.location.href = isResumos ? '../index.html' : 'index.html';
    }
  } else {
    if (isApp || isResumos) {
       await checkSubscription(user);
    } else if (isLanding) {
       window.location.href = 'app.html';
    }
  }
});

async function checkSubscription(user) {
  try {
    const docRef = db.collection('users').doc(user.uid);
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      const data = docSnap.data();
      currentUserDoc = docSnap;
      
      const now = new Date();
      
      // Setup User Name globally if in app
      const userNameEl = document.getElementById('profileUserName');
      if(userNameEl) {
         let rawName = data.displayName || 'Recruta';
         userNameEl.innerText = rawName.toLowerCase().replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());
      }
      
    } else {
      // Falha de sincronia - não existe no firestore, refaz setup ou deloga
      logoutUser();
    }
  } catch(e) {
    console.error("Erro ao checar subscrição:", e);
  }
}
