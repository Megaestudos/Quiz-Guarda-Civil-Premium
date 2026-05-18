import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB36ZszS8v_DeOn3at7zEo_tFq86WU0sI4",
  authDomain: "simulados-concursos-22c91.firebaseapp.com",
  projectId: "simulados-concursos-22c91"
};

const ADMIN_EMAIL = "lomateco@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "southamerica-east1");

// Helper para selecionar elementos
const $ = (id) => document.getElementById(id);

// Verifica Autenticação
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    if (user.email !== ADMIN_EMAIL) {
        alert("Acesso Negado: Você não é um administrador.");
        signOut(auth).then(() => window.location.href = "login.html");
        return;
    }
    console.log("Autenticado como Admin:", user.email);
    initDashboard();
});

async function initDashboard() {
    try {
        // 1. Carregar Alunos via Cloud Function
        const listUsersCall = httpsCallable(functions, "listUsersV2");
        const result = await listUsersCall();
        const users = Array.isArray(result.data) ? result.data : [];

        updateUIStats(users);
        if ($('studentsTableBody')) renderStudentsTable(users);
        if (window.revenueChart) updateRevenueChart(users);

    } catch (e) {
        console.error("Erro ao carregar dados do Firebase:", e);
    }
}

function updateUIStats(users) {
    const totalCount = users.length;
    const activeCount = users.filter(u => !u.disabled).length;
    
    // Supondo que cada usuário pague R$ 49,90/mês para o cálculo de MRR
    const estimatedMRR = activeCount * 49.90;

    if ($('statTotalUsers')) $('statTotalUsers').innerText = totalCount.toLocaleString();
    if ($('statMRR')) $('statMRR').innerText = `R$ ${estimatedMRR.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    
    // Retenção fictícia baseada em quem logou nos últimos 7 dias
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const activeThisWeek = users.filter(u => u.lastLogin && new Date(u.lastLogin) > weekAgo).length;
    const retention = totalCount > 0 ? (activeThisWeek / totalCount) * 100 : 0;
    
    if ($('statRetention')) $('statRetention').innerText = `${retention.toFixed(1)}%`;
}

function renderStudentsTable(users) {
    const tbody = $('studentsTableBody');
    tbody.innerHTML = '';

    // Ordenar por data de criação desc
    const sortedUsers = users.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    sortedUsers.slice(0, 50).forEach(user => {
        const tr = document.createElement('tr');
        tr.className = "table-row group";
        
        const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('pt-BR') : 'Nunca';
        const statusClass = user.disabled ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
        const statusText = user.disabled ? 'Inativo' : 'Ativo';

        tr.innerHTML = `
            <td class="px-6 py-5">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-blue-500 border border-white/10">
                        ${user.email ? user.email.substring(0, 2).toUpperCase() : '??'}
                    </div>
                    <div class="flex flex-col">
                        <span class="text-sm font-semibold truncate max-w-[150px]">${user.email || 'Sem Email'}</span>
                        <span class="text-[10px] text-gray-500 lowercase">${user.uid.substring(0, 15)}...</span>
                    </div>
                </div>
            </td>
            <td class="px-6 py-5">
                <div class="flex flex-col gap-1">
                    <span class="text-[10px] font-bold uppercase tracking-widest text-blue-400">Plano Ativo</span>
                    <span class="inline-flex items-center gap-1.5 text-[10px] font-bold ${statusClass} px-2 py-0.5 rounded-full border w-fit">
                        ${statusText}
                    </span>
                </div>
            </td>
            <td class="px-6 py-5">
                <div class="flex items-center gap-4">
                    <div class="text-sm font-bold">100%</div>
                    <div class="flex-1 max-w-[80px] h-1 bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full bg-emerald-500 w-full"></div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-5 text-sm font-medium">N/A</td>
            <td class="px-6 py-5">
                <span class="text-xs text-gray-300">${lastLogin}</span>
            </td>
            <td class="px-6 py-5 text-right">
                <button class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all">
                    <i data-lucide="eye" class="w-4 h-4"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Reinicializa os ícones do Lucide para as novas linhas
    if (window.lucide) window.lucide.createIcons();
}

function updateRevenueChart(users) {
    // Se quiser atualizar o gráfico de receita com dados reais de cadastros por mês
    // Podemos fazer isso se o Chart.js estiver disponível globalmente
}

// Botão Logout
const btnLogout = $('btnLogout');
if (btnLogout) {
    btnLogout.onclick = () => signOut(auth).then(() => window.location.href = "login.html");
}
