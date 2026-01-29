// ====================================
// CONFIGURAÇÃO DO ADMIN
// ====================================
const ADMIN_CRED = {
  email: "lomateco@gmail.com",
  senha: "86173784"
};

const $ = (id)=>document.getElementById(id);

// ================= LOGIN =================
if($("btnLogin")){
  $("btnLogin").onclick = ()=>{
    const email = $("adminEmail").value;
    const senha = $("adminPass").value;

    if(email === ADMIN_CRED.email && senha === ADMIN_CRED.senha){
      localStorage.setItem("adminLogged", "1");
      localStorage.setItem("lastLogin", new Date().toLocaleString());
      window.location.href = "painel.html";
    } else {
      $("msg").innerText = "Email ou senha inválidos!";
    }
  };

  $("togglePass").onclick = ()=>{
    const i = $("adminPass");
    i.type = i.type==="password"?"text":"password";
  };
}

// ================= PAINEL =================
if($("btnLogout")){
  // Protege painel
  if(localStorage.getItem("adminLogged") !== "1"){
    window.location.href = "login.html";
  }

  // Exibe último login
  const last = localStorage.getItem("lastLogin");
  if($("lastLogin")) $("lastLogin").innerText = last || "-";

  // Exemplo de contador de usuários (simulado)
  if($("totalUsers")) $("totalUsers").innerText = 42;

  // Logout
  $("btnLogout").onclick = ()=>{
    localStorage.removeItem("adminLogged");
    window.location.href = "login.html";
  };
}
