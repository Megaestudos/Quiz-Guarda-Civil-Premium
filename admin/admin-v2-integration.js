import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB36ZszS8v_DeOn3at7zEo_tFq86WU0sI4",
  authDomain: "simulados-concursos-22c91.firebaseapp.com",
  projectId: "simulados-concursos-22c91"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "southamerica-east1");

// Helper para selecionar elementos
const $ = (id) => document.getElementById(id);
let growthChart = null;
let accessChart = null;
let inactivityChart = null;
let aiRequestChart = null;

function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(a, b) {
    return a && b &&
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

function percentage(part, total) {
    if (!total) return 0;
    return Math.round((part / total) * 100);
}

function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date) {
    return date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
}

function getLastMonths(count = 6) {
    const months = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
        months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    }
    return months;
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Verifica Autenticação
function revealAdmin() {
    document.body.classList.remove('admin-pending');
    document.body.classList.add('admin-authorized');
    if (window.lucide) window.lucide.createIcons();
}

async function denyAdminAccess() {
    document.body.className = '';
    document.body.innerHTML = '<main style="min-height:100vh;display:grid;place-items:center;background:#020617;color:#f8fafc;font:600 16px Inter,Arial,sans-serif">Acesso negado.</main>';
    try {
        await signOut(auth);
    } finally {
        window.location.replace('login.html');
    }
}

// No administrative data is fetched or rendered before the refreshed claim is verified.
onAuthStateChanged(auth, async (user) => {
    try {
        if (!user) {
            await denyAdminAccess();
            return;
        }
        const token = await user.getIdTokenResult(true);
        if (token.claims.admin !== true) {
            await denyAdminAccess();
            return;
        }
        revealAdmin();
        console.log("Autenticado como Admin:", user.email);
        await initDashboard();
    } catch (error) {
        console.error('Falha ao verificar a permissão administrativa:', error);
        await denyAdminAccess();
    }
});

async function initDashboard() {
    console.log("Iniciando carregamento de dados do Dashboard...");
    try {
        // 1. Carregar Alunos via Cloud Function
        const listUsersCall = httpsCallable(functions, "listUsersV2");
        console.log("Chamando Cloud Function 'listUsersV2'...");
        
        const result = await listUsersCall();
        console.log("Resultado recebido:", result);
        
        const users = Array.isArray(result.data) ? result.data : [];
        
        // Sort by creation date descending
        users.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        
        console.log("Total de usuários processados:", users.length);

        if (users.length === 0) {
            console.warn("A função retornou zero usuários. Verifique as permissões ou se há usuários no Firebase.");
        }

        updateUIStats(users);
        renderGrowthChart(users);
        renderActivityHeatmap(users);
        renderRetention(users);
        renderFinancialCharts(users);
        
        if ($('studentsTableBody')) renderStudentsTable(users);
        if ($('recentActivityList')) renderActivityLog(users);
        
        // Carrega Conteúdos e Simulados dependendo da página
        if ($('contentsGrid')) initContents();
        if ($('topStudentsList')) initSimulados(users);
        if ($('iaRequestChart')) initAiControl(users);
        
        console.log("UI atualizada com sucesso.");

    } catch (e) {
        console.error("Erro crítico ao carregar dados do Firebase:", e);
        alert("Erro ao conectar com Firebase: " + e.message);
    }
}

function updateUIStats(users) {
    const today = new Date();
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);

    const totalUsers = users.length;
    const createdToday = users.filter(u => isSameDay(parseDate(u.createdAt), today)).length;
    const accessToday = users.filter(u => isSameDay(parseDate(u.lastLogin), today)).length;
    const accessWeek = users.filter(u => {
        const lastLogin = parseDate(u.lastLogin);
        return lastLogin && lastLogin >= weekAgo;
    }).length;
    const inactive30 = users.filter(u => {
        const lastLogin = parseDate(u.lastLogin);
        return !lastLogin || lastLogin < monthAgo;
    }).length;

    if ($('statTotalUsers')) $('statTotalUsers').innerText = totalUsers;
    if ($('statCreatedToday')) $('statCreatedToday').innerText = createdToday;
    if ($('statAccessToday')) $('statAccessToday').innerText = accessToday;
    if ($('statAccessWeek')) $('statAccessWeek').innerText = accessWeek;
    if ($('statInactive30')) $('statInactive30').innerText = inactive30;
    if ($('statAccessWeekRate')) $('statAccessWeekRate').innerText = `${percentage(accessWeek, totalUsers)}% do total`;
    if ($('statInactiveRate')) $('statInactiveRate').innerText = `${percentage(inactive30, totalUsers)}% do total`;
    
    // Métricas de acesso para a plataforma gratuita.
    const activeUsers = users.filter(u => {
        const lastLogin = parseDate(u.lastLogin);
        return lastLogin && lastLogin >= monthAgo;
    }).length;

    if ($('finTotalRevenue')) $('finTotalRevenue').innerText = totalUsers;
    if ($('finTotalUsers')) $('finTotalUsers').innerText = totalUsers;
    if ($('finNetRevenue')) $('finNetRevenue').innerText = activeUsers;
}

function renderGrowthChart(users) {
    const canvas = $('revenueChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const months = getLastMonths(6);
    const createdByMonth = Object.fromEntries(months.map(date => [monthKey(date), 0]));
    const activeByMonth = Object.fromEntries(months.map(date => [monthKey(date), 0]));

    users.forEach(user => {
        const createdAt = parseDate(user.createdAt);
        const lastLogin = parseDate(user.lastLogin);
        if (createdAt && createdByMonth[monthKey(createdAt)] !== undefined) createdByMonth[monthKey(createdAt)]++;
        if (lastLogin && activeByMonth[monthKey(lastLogin)] !== undefined) activeByMonth[monthKey(lastLogin)]++;
    });

    if (growthChart) growthChart.destroy();
    growthChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: months.map(monthLabel),
            datasets: [
                {
                    label: 'Novos alunos',
                    data: months.map(date => createdByMonth[monthKey(date)]),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.18)',
                    borderWidth: 3,
                    pointRadius: 4,
                    tension: 0.35,
                    fill: true
                },
                {
                    label: 'Acessos no mês',
                    data: months.map(date => activeByMonth[monthKey(date)]),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    borderWidth: 3,
                    pointRadius: 4,
                    tension: 0.35,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#94a3b8', font: { size: 11, weight: 'bold' } } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0, color: '#64748b', font: { size: 10, weight: '600' } },
                    grid: { color: 'rgba(255,255,255,0.04)' }
                },
                x: {
                    ticks: { color: '#64748b', font: { size: 10, weight: '600' } },
                    grid: { display: false }
                }
            }
        }
    });
}

function renderActivityHeatmap(users) {
    const container = $('activityHeatmap');
    if (!container) return;

    const days = [];
    const today = new Date();
    for (let i = 34; i >= 0; i--) {
        days.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i));
    }

    const counts = Object.fromEntries(days.map(day => [day.toISOString().split('T')[0], 0]));
    users.forEach(user => {
        const lastLogin = parseDate(user.lastLogin);
        if (!lastLogin) return;
        const key = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate()).toISOString().split('T')[0];
        if (counts[key] !== undefined) counts[key]++;
    });

    const max = Math.max(...Object.values(counts), 1);
    container.innerHTML = days.map(day => {
        const key = day.toISOString().split('T')[0];
        const count = counts[key];
        const pct = count / max;
        const color = count === 0 ? 'bg-white/5' : pct < 0.34 ? 'bg-blue-900/30' : pct < 0.67 ? 'bg-blue-700/50' : 'bg-blue-500';
        const title = `${day.toLocaleDateString('pt-BR')}: ${count} acesso(s)`;
        return `<div class="${color} h-4 rounded-sm transition-all hover:ring-2 hover:ring-white/20" title="${title}"></div>`;
    }).join('');
}

function renderRetention(users) {
    const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
    const total = users.length;
    const active = users.filter(user => {
        const lastLogin = parseDate(user.lastLogin);
        return lastLogin && lastLogin >= monthAgo;
    }).length;
    const rate = percentage(active, total);

    if ($('retentionRate')) $('retentionRate').innerText = `${rate}%`;
    if ($('retentionCenter')) $('retentionCenter').innerText = `${rate}%`;
    if ($('retentionCircle')) $('retentionCircle').setAttribute('stroke-dasharray', `${rate}, 100`);
    if ($('retentionLabel')) $('retentionLabel').innerText = `${active} de ${total} ativos em 30 dias`;
}

function renderFinancialCharts(users) {
    const accessCanvas = $('planChart');
    const inactivityCanvas = $('inactivityChart');
    const total = users.length;
    const today = new Date();
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);

    const active30 = users.filter(user => {
        const lastLogin = parseDate(user.lastLogin);
        return lastLogin && lastLogin >= monthAgo;
    }).length;
    const activeWeek = users.filter(user => {
        const lastLogin = parseDate(user.lastLogin);
        return lastLogin && lastLogin >= weekAgo;
    }).length;
    const newToday = users.filter(user => isSameDay(parseDate(user.createdAt), today)).length;
    const inactive30 = total - active30;

    if (accessCanvas && typeof Chart !== 'undefined') {
        const existing = Chart.getChart ? Chart.getChart(accessCanvas) : null;
        if (existing) existing.destroy();
        if (accessChart) accessChart.destroy();
        accessChart = new Chart(accessCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Ativos em 30 dias', 'Ativos na semana', 'Novos hoje'],
                datasets: [{
                    data: [active30, activeWeek, newToday],
                    backgroundColor: ['#10b981', '#3b82f6', '#6366f1'],
                    borderWidth: 0,
                    hoverOffset: 12
                }]
            },
            options: {
                cutout: '72%',
                plugins: {
                    legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10, weight: 'bold' }, padding: 16 } }
                }
            }
        });
    }

    if (inactivityCanvas && typeof Chart !== 'undefined') {
        const existing = Chart.getChart ? Chart.getChart(inactivityCanvas) : null;
        if (existing) existing.destroy();
        if (inactivityChart) inactivityChart.destroy();
        inactivityChart = new Chart(inactivityCanvas, {
            type: 'bar',
            data: {
                labels: ['Ativos 30d', 'Inativos 30d'],
                datasets: [{
                    label: 'Alunos',
                    data: [active30, inactive30],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderRadius: 8,
                    maxBarThickness: 56
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0, color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } },
                    x: { ticks: { color: '#64748b' }, grid: { display: false } }
                }
            }
        });
    }
}

async function initAiControl(users) {
    const todayStr = new Date().toISOString().split('T')[0];
    const planUses = users.filter(user => user.lastStudyPlanDate === todayStr).length;
    const lessonUses = users.filter(user => user.lastLessonGenDate === todayStr).length;
    const essayEvalUses = users.filter(user => user.lastEssayEvalDate === todayStr).length;
    const usersUsingAi = users.filter(user =>
        user.lastStudyPlanDate === todayStr ||
        user.lastLessonGenDate === todayStr ||
        user.lastEssayEvalDate === todayStr
    ).length;
    const totalUses = planUses + lessonUses + essayEvalUses;

    if ($('aiUsesToday')) $('aiUsesToday').innerText = totalUses;
    if ($('aiUsersToday')) $('aiUsersToday').innerText = usersUsingAi;

    const canvas = $('iaRequestChart');
    if (canvas && typeof Chart !== 'undefined') {
        const existing = Chart.getChart ? Chart.getChart(canvas) : null;
        if (existing) existing.destroy();
        if (aiRequestChart) aiRequestChart.destroy();
        aiRequestChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Plano de estudos', 'Aulas de redação', 'Correções finais'],
                datasets: [{
                    label: 'Usos hoje',
                    data: [planUses, lessonUses, essayEvalUses],
                    backgroundColor: ['#6366f1', '#3b82f6', '#10b981'],
                    borderRadius: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0, color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } },
                    x: { grid: { display: false }, ticks: { color: '#64748b' } }
                }
            }
        });
    }

    try {
        const snap = await getDocs(collection(db, 'global_essay_lessons'));
        if ($('aiCachedLessons')) $('aiCachedLessons').innerText = snap.size;
        const list = $('aiCachedLessonsList');
        if (list) {
            if (snap.empty) {
                list.innerHTML = '<div class="p-6 text-sm text-gray-500 italic">Nenhuma aula em cache ainda.</div>';
            } else {
                const items = [];
                snap.forEach(docSnap => {
                    const data = docSnap.data() || {};
                    items.push({
                        topic: data.generatedTopic || docSnap.id,
                        createdAt: parseDate(data.createdAt)
                    });
                });
                list.innerHTML = items
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                    .slice(0, 8)
                    .map(item => `
                        <div class="flex items-center justify-between p-6 hover:bg-white/5 transition-all">
                            <span class="text-sm font-semibold">${escapeHtml(item.topic)}</span>
                            <span class="text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full font-bold">${item.createdAt ? item.createdAt.toLocaleDateString('pt-BR') : 'cache'}</span>
                        </div>
                    `).join('');
            }
        }
    } catch (e) {
        if ($('aiCachedLessonsList')) {
            $('aiCachedLessonsList').innerHTML = `<div class="p-6 text-sm text-red-400">Erro ao carregar cache: ${e.message}</div>`;
        }
    }
}

function renderStudentsTable(users) {
    const tbody = $('studentsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-gray-500 italic">Nenhum aluno encontrado no banco de dados.</td></tr>`;
        return;
    }

    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.className = "table-row group border-b border-white/5 hover:bg-white/[0.02] transition-colors";
        
        const firstAccess = user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : 'N/A';
        const lastAccess = user.lastLogin ? new Date(user.lastLogin).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Nunca';
        
        const statusClass = user.disabled ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
        const statusText = user.disabled ? 'Bloqueado' : 'Ativo';
        const actionBtnClass = user.disabled ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500';
        const actionBtnText = user.disabled ? 'Desbloquear' : 'Bloquear';

        tr.innerHTML = `
            <td class="px-6 py-5">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-blue-500 border border-white/10">
                        ${user.email ? user.email.substring(0, 2).toUpperCase() : '??'}
                    </div>
                    <div class="flex flex-col">
                        <span class="text-sm font-semibold truncate max-w-[200px]">${user.email || 'Sem Email'}</span>
                        <span class="text-[10px] text-gray-500 font-mono">${user.uid}</span>
                    </div>
                </div>
            </td>
            <td class="px-6 py-5 text-xs text-gray-400">${firstAccess}</td>
            <td class="px-6 py-5 text-xs text-blue-400 font-bold">${lastAccess}</td>
            <td class="px-6 py-5">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusClass}">
                    ${statusText.toUpperCase()}
                </span>
            </td>
            <td class="px-6 py-5 text-right flex items-center justify-end gap-2">
                <button onclick="toggleUser('${user.uid}', ${!!user.disabled})" class="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all ${actionBtnClass}">
                    ${actionBtnText}
                </button>
                <button class="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-all"><i data-lucide="eye" class="w-4 h-4"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    if (window.lucide) window.lucide.createIcons();
}

// Modal Handlers
window.openAddModal = () => $('modalAddStudent').style.display = 'flex';
window.closeAddModal = () => $('modalAddStudent').style.display = 'none';

window.createStudent = async function() {
    const email = $('newStudentEmail').value;
    const pass = $('newStudentPass').value;
    
    if(!email || pass.length < 6) return alert("Preencha email e senha (mín 6 chars)");
    
    const btn = $('btnCreateConfirm');
    btn.disabled = true; btn.innerText = "Criando...";
    
    try {
        const createCall = httpsCallable(functions, "createUserV2");
        await createCall({ email, password: pass });
        alert("Aluno criado com sucesso!");
        closeAddModal();
        initDashboard();
    } catch (e) {
        alert("Erro: " + e.message);
    } finally {
        btn.disabled = false; btn.innerText = "Criar Aluno";
    }
}

function renderActivityLog(users) {
    const lists = [$('recentActivityList'), $('recentAccessList')].filter(Boolean);
    if (!lists.length) return;
    lists.forEach(list => list.innerHTML = '');

    // Filtrar quem logou recentemente e ordenar
    const recentOnes = users
        .filter(u => u.lastLogin)
        .sort((a, b) => new Date(b.lastLogin) - new Date(a.lastLogin))
        .slice(0, 5);

    if (recentOnes.length === 0) {
        lists.forEach(list => {
            list.innerHTML = '<div class="text-center py-10 text-gray-500 text-xs italic">Sem atividade recente.</div>';
        });
        return;
    }

    recentOnes.forEach(u => {
        const timeAgo = getTimeAgo(new Date(u.lastLogin));
        lists.forEach(list => {
            const isCompactList = list.id === 'recentAccessList';
            const div = document.createElement('div');
            div.className = isCompactList
                ? "flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5"
                : "flex gap-4 items-start relative pb-6 border-l border-white/5 ml-3";
            div.innerHTML = isCompactList ? `
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center"><i data-lucide="log-in" class="w-5 h-5"></i></div>
                    <div>
                        <div class="text-sm font-bold">${u.email || 'Sem email'}</div>
                        <div class="text-[10px] text-gray-500 uppercase font-bold tracking-tight">Acesso gratuito</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-sm font-black text-emerald-500">Ativo</div>
                    <div class="text-[10px] text-gray-500 font-bold uppercase tracking-tight">${timeAgo}</div>
                </div>
            ` : `
                <div class="absolute -left-[5px] top-1 w-2.5 h-2.5 bg-blue-500 border border-blue-600 rounded-full"></div>
                <div class="flex flex-col gap-1 ml-4">
                    <span class="text-sm font-semibold">${u.email || 'Sem email'}</span>
                    <span class="text-xs text-gray-500">Acessou a plataforma</span>
                    <span class="text-[10px] text-blue-500 font-bold uppercase">${timeAgo}</span>
                </div>
            `;
            list.appendChild(div);
        });
    });
    if (window.lucide) window.lucide.createIcons();
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " anos atrás";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " meses atrás";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " dias atrás";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " horas atrás";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " min atrás";
    return "agora mesmo";
}

// Expõe a função para o HTML
window.toggleUser = async function(uid, isCurrentlyDisabled) {
    const action = isCurrentlyDisabled ? "desbloquear" : "bloquear";
    if (!confirm(`Tem certeza que deseja ${action} este usuário?`)) return;

    try {
        const toggleCall = httpsCallable(functions, "toggleUserStatus");
        await toggleCall({ uid, disabled: !isCurrentlyDisabled });
        alert("Usuário atualizado com sucesso!");
        initDashboard(); // Recarrega os dados
    } catch (e) {
        alert("Erro ao atualizar usuário: " + e.message);
    }
}

function updateRevenueChart(users) {
    // Se quiser atualizar o gráfico de crescimento com dados reais de cadastros por mês
    // Podemos fazer isso se o Chart.js estiver disponível globalmente
}

window.subjectsData = [];

async function initContents() {
    const grid = $('contentsGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="col-span-full flex justify-center py-10"><i data-lucide="loader-2" class="w-8 h-8 animate-spin text-blue-500"></i></div>';

    try {
        const snap = await getDocs(collection(db, "materias_aulas"));
        window.subjectsData = [];
        grid.innerHTML = '';
        
        if (snap.empty) {
            grid.innerHTML = '<div class="col-span-full text-center text-gray-500 italic py-10">Nenhuma matéria cadastrada. Clique em + Nova Matéria para começar.</div>';
            return;
        }

        snap.forEach(doc => {
            const data = { id: doc.id, ...doc.data() };
            window.subjectsData.push(data);
            const vCount = data.videos ? data.videos.length : 0;
            const aCount = data.audios ? data.audios.length : 0;
            const sCount = data.slides ? data.slides.length : 0;
            
            let mediaListHTML = '';
            const allMedia = [];
            if(data.videos) data.videos.forEach((v,i)=> allMedia.push({...v, type:'videos', index:i, typeLabel:'Vídeo', color:'text-red-500 bg-red-500/10'}));
            if(data.audios) data.audios.forEach((a,i)=> allMedia.push({...a, type:'audios', index:i, typeLabel:'Áudio', color:'text-emerald-500 bg-emerald-500/10'}));
            if(data.slides) data.slides.forEach((s,i)=> allMedia.push({...s, type:'slides', index:i, typeLabel:'Slide', color:'text-blue-500 bg-blue-500/10'}));
            
            allMedia.forEach(m => {
                mediaListHTML += `
                    <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0 group/media">
                        <div class="flex items-center gap-2">
                            <span class="text-[8px] font-bold uppercase px-2 py-0.5 rounded-sm ${m.color}">${m.typeLabel}</span>
                            <span class="text-xs truncate max-w-[150px] text-gray-300" title="${m.title}">${m.title}</span>
                        </div>
                        <button onclick="window.deleteMedia('${data.id}', '${m.type}', ${m.index})" class="text-gray-600 hover:text-red-500 opacity-0 group-hover/media:opacity-100 transition-all"><i data-lucide="x" class="w-3 h-3"></i></button>
                    </div>
                `;
            });

            const card = document.createElement('div');
            card.className = "glass-panel p-6 rounded-3xl flex flex-col gap-4 group hover:border-blue-500/30 transition-all relative overflow-hidden";
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-blue-500">
                        <i data-lucide="${data.icon || 'book'}" class="w-6 h-6"></i>
                    </div>
                    <span class="text-[10px] font-bold bg-blue-500/10 text-blue-500 px-2 py-1 rounded-md uppercase">Ativo</span>
                </div>
                <div>
                    <h3 class="font-bold text-lg mb-1">${data.name}</h3>
                    <p class="text-xs text-gray-500">${vCount} Vídeos • ${aCount} Áudios • ${sCount} Slides</p>
                </div>
                
                ${mediaListHTML ? `<div class="bg-black/20 rounded-xl p-3 max-h-32 overflow-y-auto">${mediaListHTML}</div>` : ''}
                
                <button onclick="window.openMediaModal('${data.id}')" class="w-full py-2 border border-white/5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 text-indigo-400 mt-2">
                    <i data-lucide="plus" class="w-3 h-3"></i> Adicionar Mídia
                </button>

                <div class="mt-auto pt-4 border-t border-white/5 flex gap-2">
                    <button onclick="window.openSubjectModal('${data.id}')" class="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-all">Editar</button>
                    <button onclick="window.deleteSubject('${data.id}')" class="p-2 bg-white/5 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-all">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });
        if (window.lucide) window.lucide.createIcons();
    } catch (e) {
        grid.innerHTML = `<div class="col-span-full p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm">Erro ao carregar matérias: ${e.message}</div>`;
    }
}

// Global Methods for CMS Modals
window.openSubjectModal = function(id = null) {
    const sub = window.subjectsData ? window.subjectsData.find(s => s.id === id) : null;
    const modal = $('modalSubject');
    if(!modal) return;
    
    $('subjectId').value = id || '';
    $('subjectFriendlyId').value = id || '';
    $('subjectFriendlyId').disabled = !!id; 
    $('subjectName').value = sub ? sub.name : '';
    $('subjectIcon').value = sub ? sub.icon : 'book';
    $('subjectResumo').value = sub ? (sub.resumoFile || '') : '';
    
    $('subjectModalTitle').innerText = id ? 'Editar Matéria' : 'Nova Matéria';
    modal.style.display = 'flex';
}

window.closeSubjectModal = function() {
    if($('modalSubject')) $('modalSubject').style.display = 'none';
}

window.saveSubject = async function() {
    const idToUpdate = $('subjectId').value;
    let docId = $('subjectFriendlyId').value.trim() || idToUpdate;
    if(!docId) docId = $('subjectName').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    if(!docId) return alert("Preencha um nome/ID para a matéria.");
    
    const data = {
        name: $('subjectName').value,
        icon: $('subjectIcon').value || 'book',
        resumoFile: $('subjectResumo').value
    };
    
    const btn = $('btnSaveSubject');
    btn.disabled = true; btn.innerText = "Salvando...";
    try {
        await setDoc(doc(db, "materias_aulas", docId), data, {merge: true});
        window.closeSubjectModal();
        await initContents();
    } catch(e) {
        alert("Erro ao salvar matéria: " + e.message);
    } finally {
        btn.disabled = false; btn.innerText = "Salvar Matéria";
    }
}

window.deleteSubject = async function(id) {
    if(!confirm(`Tem certeza que deseja excluir a matéria e todas as suas aulas?`)) return;
    try {
        await deleteDoc(doc(db, "materias_aulas", id));
        await initContents();
    } catch(e) { alert("Erro ao excluir: " + e.message); }
}

window.openMediaModal = function(subjectId) {
    const modal = $('modalMedia');
    if(!modal) return;
    $('mediaSubjectId').value = subjectId;
    $('mediaTitle').value = '';
    $('mediaUrl').value = '';
    $('mediaDur').value = '';
    $('mediaTypeSelect').value = 'videos';
    modal.style.display = 'flex';
}

window.closeMediaModal = function() {
    if($('modalMedia')) $('modalMedia').style.display = 'none';
}

window.saveMedia = async function() {
    const sid = $('mediaSubjectId').value;
    const type = $('mediaTypeSelect').value;
    const title = $('mediaTitle').value;
    const urlOrId = $('mediaUrl').value;
    const dur = $('mediaDur').value;
    
    if(!title || !urlOrId) return alert("Preencha título e URL/ID.");
    
    const sub = window.subjectsData ? window.subjectsData.find(s => s.id === sid) : null;
    if(!sub) return;
    
    const newItem = { title: title, duration: dur || (type === 'videos' ? 'Vídeo' : 'Mídia') };
    if(type === 'videos') newItem.youtubeId = urlOrId;
    else newItem.url = urlOrId;
    
    const currentArray = sub[type] || [];
    currentArray.push(newItem);
    
    const btn = $('btnSaveMedia');
    btn.disabled = true; btn.innerText = "Salvando...";
    try {
        await updateDoc(doc(db, "materias_aulas", sid), { [type]: currentArray });
        window.closeMediaModal();
        await initContents();
    } catch(e) {
        alert("Erro ao adicionar mídia: " + e.message);
    } finally {
        btn.disabled = false; btn.innerText = "Salvar Mídia";
    }
}

window.deleteMedia = async function(subjectId, type, index) {
    if(!confirm("Tem certeza que deseja remover esta mídia?")) return;
    const sub = window.subjectsData ? window.subjectsData.find(s => s.id === subjectId) : null;
    if(!sub) return;
    
    const currentArray = sub[type] || [];
    currentArray.splice(index, 1);
    
    try {
        await updateDoc(doc(db, "materias_aulas", subjectId), { [type]: currentArray });
        await initContents();
    } catch(e) { alert("Erro ao remover mídia: " + e.message); }
}

async function initSimulados(users) {
    const topList = $('topStudentsList');
    if (!topList) return;
    topList.innerHTML = '';

    // Filtrar usuários que tenham recordes de quiz
    const studentsWithRecords = users.filter(u => u.quiz_best_record && u.quiz_best_record.score !== undefined);
    const topStudents = studentsWithRecords.sort((a, b) => b.quiz_best_record.score - a.quiz_best_record.score).slice(0, 10);

    if (topStudents.length === 0) {
        topList.innerHTML = '<p class="text-gray-500 text-sm">Nenhum recorde registrado ainda.</p>';
        return;
    }

    topStudents.forEach((student, index) => {
        const item = document.createElement('div');
        item.className = "flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5";
        item.innerHTML = `
            <div class="flex items-center gap-4">
                <span class="text-xs font-black text-gray-600 w-4">${index + 1}</span>
                <div class="flex flex-col">
                    <span class="text-sm font-bold text-gray-200">${student.email}</span>
                    <span class="text-[10px] text-gray-500 font-bold uppercase">${student.quiz_xp || 0} XP</span>
                </div>
            </div>
            <div class="text-right">
                <div class="text-xs font-black text-emerald-500">${student.quiz_best_record.score}/${student.quiz_best_record.total}</div>
                <div class="text-[10px] text-gray-500 font-bold uppercase">Acertos</div>
            </div>
        `;
        topList.appendChild(item);
    });

    // Gráfico de tópicos (Média Global)
    renderTopicsChart(users);
}

function renderTopicsChart(users) {
    const ctx = $('topicsChart');
    if (!ctx) return;

    // Calcular médias por tópico agregando quiz_topic_stats de todos os users
    const topicAgg = {};
    users.forEach(u => {
        if (u.quiz_topic_stats) {
            Object.entries(u.quiz_topic_stats).forEach(([topic, stats]) => {
                if (!topicAgg[topic]) topicAgg[topic] = { total: 0, correct: 0 };
                topicAgg[topic].total += stats.t || 0;
                topicAgg[topic].correct += stats.c || 0;
            });
        }
    });

    const labels = Object.keys(topicAgg);
    const data = labels.map(t => (topicAgg[t].correct / topicAgg[t].total) * 100);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '% de Acerto Médio',
                data: data,
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: '#3b82f6',
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// Botão Logout
const btnLogout = $('btnLogout');
if (btnLogout) {
    btnLogout.onclick = () => signOut(auth).then(() => window.location.href = "login.html");
}
