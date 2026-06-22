let currentUserDoc = null;
let countdownInterval = null;

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos
const AUTH_CHECK_DELAY_MS = 2000; // Tempo de espera para o Firebase validar o login (ms)

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
    if (lastActivity && lastActivity !== 'null') {
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
        console.warn("Redirecionando para login: Usuário não autenticado em página restrita.");
        window.location.href = isResumos ? '../index.html' : 'index.html';
    } else {
        document.body.style.opacity = '1';
    }
  } else {
    // Se há usuário, verifica acesso ou redireciona da landing para o app
    if (isApp || isResumos) {
       document.body.style.opacity = '1';
       await checkSubscription(user);
    } else if (isLanding) {
       window.location.href = 'app.html';
    } else {
       document.body.style.opacity = '1';
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
      
      // GAMIFICATION SYNC: Cloud to Local (Merge)
      try {
          const cXP = parseInt(data.quiz_xp || '0');
          const lXP = parseInt(localStorage.getItem('quiz_xp') || '0');
          if(cXP > lXP) localStorage.setItem('quiz_xp', cXP);

          const cStreak = parseInt(data.quiz_streak || '0');
          const lStreak = parseInt(localStorage.getItem('quiz_streak') || '0');
          if(cStreak > lStreak) localStorage.setItem('quiz_streak', cStreak);
          
          if(data.quiz_last_date && !localStorage.getItem('quiz_last_date')) localStorage.setItem('quiz_last_date', data.quiz_last_date);

          let lBest = JSON.parse(localStorage.getItem('quiz_best_record') || '{"pct":-1}');
          let cBest = data.quiz_best_record || {pct:-1};
          if((cBest.pct || -1) > (lBest.pct || -1)) localStorage.setItem('quiz_best_record', JSON.stringify(cBest));

          let lBadges = JSON.parse(localStorage.getItem('quiz_unlocked_badges') || '[]');
          let cBadges = data.quiz_unlocked_badges || [];
          let mergedB = [...new Set([...lBadges, ...cBadges])];
          localStorage.setItem('quiz_unlocked_badges', JSON.stringify(mergedB));

          let lStats = JSON.parse(localStorage.getItem('quiz_topic_stats') || '{}');
          let cStats = data.quiz_topic_stats || {};
          let mergedStats = {...cStats, ...lStats}; // Local overrides old cloud stats
          localStorage.setItem('quiz_topic_stats', JSON.stringify(mergedStats));
          
          // Force update cloud to the new merged truths if necessary
          if(window.syncGamificationToCloud) {
              window.syncGamificationToCloud();
          }
      } catch(e) { console.error("Erro no merge da gamificação:", e); }

      // Setup User Name globally if in app
      const userNameEl = document.getElementById('profileUserName');
      if(userNameEl) {
         let rawName = data.displayName || 'Recruta';
         userNameEl.textContent = rawName.toLowerCase().replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());
      }
      
    } else {
      // Falha de sincronia (o redirecionamento interrompeu o registro original)
      // A plataforma é gratuita, então o app auto-repara o perfil de acesso.
      await docRef.set({
        email: user.email || "Sem email",
        displayName: user.displayName || "Aluno Cursista",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        plan: "premium",
        status: "active"
      });
      // Recarrega a própria função na sequência para o fluxo normal de boas vindas
      await checkSubscription(user);
    }
  } catch(e) {
    console.error("Erro ao checar acesso:", e);
  }
}
