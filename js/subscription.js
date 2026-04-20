let currentUserDoc = null;
let countdownInterval = null;

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    if (window.location.pathname.includes('app.html')) {
        window.location.href = 'index.html';
    }
  } else {
    if (window.location.pathname.includes('app.html')) {
       await checkSubscription(user);
    } else if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/APP%20PlenAula%20-%20SASS/')) {
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
      
      if (data.plan === 'free') {
        const endDate = new Date(data.trialEnd);
        if (now > endDate || data.status === 'expired') {
          if(data.status !== 'expired') await docRef.update({status: 'expired'});
          showPaywall();
        } else {
          startCountdown(endDate);
        }
      } else if (data.plan === 'premium') {
        const premiumEnd = new Date(data.premiumEnd);
        if (now > premiumEnd || data.status === 'expired') {
          if(data.status !== 'expired') await docRef.update({status: 'expired'});
          showPaywall(true); 
        } else {
           const container = document.getElementById('timerContainer');
           if(container) container.style.display = 'none';
        }
      }
    } else {
      // Falha de sincronia - não existe no firestore, refaz setup ou deloga
      logoutUser();
    }
  } catch(e) {
    console.error("Erro ao checar subscrição:", e);
  }
}

function startCountdown(endDate) {
  const container = document.getElementById('timerContainer');
  const timerText = document.getElementById('timerText');
  if(!container || !timerText) return;
  
  container.style.display = 'flex';
  
  countdownInterval = setInterval(() => {
    const now = new Date().getTime();
    const distance = endDate.getTime() - now;
    
    if (distance < 0) {
      clearInterval(countdownInterval);
      showPaywall();
      return;
    }
    
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    
    timerText.innerText = `${days}d ${hours}h ${minutes}m`;
    
    // Smooth insertion on mobile into existing text instead of giant badge
    const welcomeSubtitle = document.getElementById('welcomeSubtitle');
    if (welcomeSubtitle && window.innerWidth <= 600) {
        welcomeSubtitle.innerHTML = `O teste Vip expira em <strong style="color:var(--danger)">${days}d e ${hours}h</strong>. Bons estudos:`;
    }
  }, 1000);
}

function showPaywall(isRenewal = false) {
  const paywallEl = document.getElementById('paywallOverlay');
  if(paywallEl) paywallEl.classList.add('show');
  
  if (isRenewal) {
    const msg = document.getElementById('paywallMessage');
    if(msg) msg.innerHTML = "<strong>Sua assinatura anual expirou.</strong><br> Renove agora para continuar sua preparação e acessar todo conteúdo!";
  }
}

window.handlePaymentSimulation = async function() {
   if (!auth.currentUser) return;
   const btn = document.getElementById('payBtn');
   const originalText = btn.innerHTML;
   btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Processando Pagamento...';
   btn.disabled = true;
   
   setTimeout(async () => {
      try {
        const now = new Date();
        const premiumEnd = new Date(now.getTime() + (PREMIUM_DAYS * 24 * 60 * 60 * 1000));
        
        await db.collection('users').doc(auth.currentUser.uid).update({
            plan: 'premium',
            status: 'active',
            premiumStart: now.toISOString(),
            premiumEnd: premiumEnd.toISOString()
        });
        
        btn.innerHTML = '<i class="ph-fill ph-check-circle"></i> Sucesso!';
        btn.className = "btn-pay btn-success";
        
        setTimeout(() => {
             window.location.reload();
        }, 1500);
      } catch(e) {
         console.error(e);
         alert("Erro no pagamento simulado. Tente novamente.");
         btn.innerHTML = originalText;
         btn.disabled = false;
      }
   }, 2000); 
}
