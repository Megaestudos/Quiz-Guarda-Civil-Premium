let currentUserDoc = null;
let countdownInterval = null;

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos

function updateLastActivity() {
  if (auth.currentUser) {
    localStorage.setItem('plenaula_last_activity', Date.now());
  }
}

// Atualiza a atividade sempre que o aluno interagir com o app
window.addEventListener('click', updateLastActivity, { passive: true });
window.addEventListener('keypress', updateLastActivity, { passive: true });
window.addEventListener('scroll', updateLastActivity, { passive: true });

auth.onAuthStateChanged(async (user) => {
  const path = window.location.pathname.toLowerCase();
  // Normaliza o caminho para lidar com barras invertidas no Windows e maiúsculas
  const normalizedPath = path.replace(/\\/g, '/');
  
  const isResumos = normalizedPath.includes('/resumos/');
  const isApp = normalizedPath.endsWith('/app.html') || normalizedPath.endsWith('app.html');
  const isLanding = (normalizedPath.endsWith('index.html') && !isResumos) || 
                    (normalizedPath.endsWith('/') && !isResumos) || 
                    normalizedPath.includes('/sass');

  if (user) {
    const lastActivity = localStorage.getItem('plenaula_last_activity');
    if (lastActivity) {
       const timeDiff = Date.now() - parseInt(lastActivity);
       if (timeDiff > SESSION_TIMEOUT_MS) {
          localStorage.removeItem('plenaula_last_activity');
          await auth.signOut();
          
          if (isApp || isResumos) {
              window.location.href = isResumos ? '../index.html' : 'index.html';
          }
          return;
       }
    }
    updateLastActivity();
  }

  // Se não há usuário, redireciona para o login APENAS se estiver em uma página restrita
  if (!user) {
    if (isApp || isResumos) {
        console.log("Aguardando verificação de autenticação para:", normalizedPath);
        // Atraso de 2 segundos para garantir que o Firebase Auth tenha tempo de inicializar em conexões lentas
        setTimeout(() => {
          if (!auth.currentUser) {
            console.warn("Redirecionando para login: Usuário não autenticado em página restrita.");
            window.location.href = isResumos ? '../index.html' : 'index.html';
          } else {
            console.log("Autenticação confirmada após atraso.");
          }
        }, 2000);
    }
  } else {
    console.log("Usuário autenticado:", user.email);
    // Se há usuário, verifica subscrição ou redireciona da landing para o app
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
         userNameEl.textContent = rawName.toLowerCase().replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());
      }
      
    } else {
      // Falha de sincronia (o redirecionamento interrompeu o registro original)
      // A plataforma agora é 100% gratuita, então o App auto-repara o banco instantaneamente
      await docRef.set({
        email: user.email || "Sem email",
        displayName: user.displayName || "Aluno Cursista",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        plan: "premium",
        status: "active"
      });
      console.log("Perfil auto-reparado com acesso livre.");
      // Recarrega a própria função na sequência para o fluxo normal de boas vindas
      await checkSubscription(user);
    }
  } catch(e) {
    console.error("Erro ao checar subscrição:", e);
  }
}
