import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB36ZszS8v_DeOn3at7zEo_tFq86WU0sI4",
  authDomain: "simulados-concursos-22c91.firebaseapp.com",
  projectId: "simulados-concursos-22c91"
};

const ADMIN_EMAIL = "lomateco@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

let todasMissoes = [];
let currentFilter = '';

onAuthStateChanged(auth, async (user) => {
    if (!user || user.email !== ADMIN_EMAIL) {
        window.location.href = "login.html";
        return;
    }
    window.loadMissoes();
});

window.loadMissoes = async function() {
    const list = $('missoesList');
    list.innerHTML = '<tr><td colspan="6" class="text-center py-8"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto text-blue-500"></i></td></tr>';
    lucide.createIcons();

    currentFilter = $('filterCarreira').value;

    try {
        const q = query(collection(db, "missoes"), orderBy("ordem"));
        const snap = await getDocs(q);
        todasMissoes = [];
        
        const carreirasSet = new Set();

        snap.forEach(doc => {
            const data = doc.data();
            todasMissoes.push({ id: doc.id, ...data });
            if (data.carreira) carreirasSet.add(data.carreira);
        });

        // Atualizar filtro de carreiras (preservando seleção)
        const filterEl = $('filterCarreira');
        filterEl.innerHTML = '<option value="">Todas as Carreiras</option>';
        Array.from(carreirasSet).sort().forEach(c => {
            filterEl.innerHTML += `<option value="${c}" ${currentFilter === c ? 'selected' : ''}>${c}</option>`;
        });

        renderMissoes();
    } catch (e) {
        alert("Erro ao carregar missões: " + e.message);
        list.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red-500">Erro: ${e.message}</td></tr>`;
    }
};

function renderMissoes() {
    const list = $('missoesList');
    list.innerHTML = '';
    
    let filtradas = todasMissoes;
    if (currentFilter) {
        filtradas = filtradas.filter(m => m.carreira === currentFilter);
    }

    if (filtradas.length === 0) {
        list.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500 italic">Nenhuma missão encontrada.</td></tr>';
        return;
    }

    filtradas.forEach(m => {
        const statusBadge = m.ativo 
            ? '<span class="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-md text-xs font-bold">Ativa</span>'
            : '<span class="bg-red-500/10 text-red-500 px-2 py-1 rounded-md text-xs font-bold">Inativa</span>';

        const tr = document.createElement('tr');
        tr.className = "hover:bg-white/5 transition-colors group";
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap"><div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center font-bold text-xs">${m.ordem || 0}</div></td>
            <td class="px-6 py-4">
                <div class="font-bold text-white">${m.titulo || '-'}</div>
                <div class="text-xs text-gray-500">${m.carreira || '-'}</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-300">${m.modulo || '-'}</div>
                <div class="text-xs text-gray-500">${m.materia || '-'}</div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-400">${m.assunto || '-'}</td>
            <td class="px-6 py-4">${statusBadge}</td>
            <td class="px-6 py-4 text-right">
                <button onclick="window.editMissao('${m.id}')" class="text-gray-500 hover:text-blue-500 p-2 transition-all">
                    <i data-lucide="edit" class="w-4 h-4"></i>
                </button>
                <button onclick="window.deleteMissao('${m.id}')" class="text-gray-500 hover:text-red-500 p-2 transition-all">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        `;
        list.appendChild(tr);
    });
    lucide.createIcons();
}

window.openMissaoModal = function() {
    $('mId').value = '';
    $('mCarreira').value = '';
    $('mModulo').value = '';
    $('mTitulo').value = '';
    $('mDescricao').value = '';
    $('mMateria').value = '';
    $('mAssunto').value = '';
    $('mAprenderTipo').value = 'video';
    $('mAprenderUrl').value = '';
    $('mPdfUrl').value = '';
    $('mXp').value = '100';
    
    // Sugerir próxima ordem
    const maxOrdem = todasMissoes.reduce((max, m) => Math.max(max, m.ordem || 0), 0);
    $('mOrdem').value = maxOrdem + 1;
    
    $('mAtivo').checked = true;
    
    $('modalTitle').innerText = 'Nova Missão';
    $('modalMissao').style.display = 'flex';
}

window.editMissao = function(id) {
    const m = todasMissoes.find(x => x.id === id);
    if (!m) return;
    
    $('mId').value = m.id;
    $('mCarreira').value = m.carreira || '';
    $('mModulo').value = m.modulo || '';
    $('mTitulo').value = m.titulo || '';
    $('mDescricao').value = m.descricao || '';
    $('mMateria').value = m.materia || '';
    $('mAssunto').value = m.assunto || '';
    $('mAprenderTipo').value = m.aprender_tipo || 'video';
    $('mAprenderUrl').value = m.aprender_url || '';
    $('mPdfUrl').value = m.pdf_url || '';
    $('mXp').value = m.xp || 100;
    $('mOrdem').value = m.ordem || 1;
    $('mAtivo').checked = m.ativo !== false;
    
    $('modalTitle').innerText = 'Editar Missão';
    $('modalMissao').style.display = 'flex';
}

window.closeMissaoModal = function() {
    $('modalMissao').style.display = 'none';
}

window.saveMissao = async function() {
    const id = $('mId').value;
    const btn = $('btnSaveMissao');
    
    const data = {
        carreira: $('mCarreira').value.trim(),
        modulo: $('mModulo').value.trim(),
        titulo: $('mTitulo').value.trim(),
        descricao: $('mDescricao').value.trim(),
        materia: $('mMateria').value.trim(),
        assunto: $('mAssunto').value.trim(),
        aprender_tipo: $('mAprenderTipo').value,
        aprender_url: $('mAprenderUrl').value.trim(),
        pdf_url: $('mPdfUrl').value.trim(),
        xp: parseInt($('mXp').value) || 100,
        ordem: parseInt($('mOrdem').value) || 1,
        ativo: $('mAtivo').checked
    };
    
    if (!data.carreira || !data.modulo || !data.titulo || !data.materia || !data.assunto) {
        return alert("Carreira, Módulo, Título, Matéria e Assunto são obrigatórios.");
    }

    btn.disabled = true;
    btn.innerText = "Salvando...";
    
    try {
        if (id) {
            await updateDoc(doc(db, "missoes", id), data);
        } else {
            await addDoc(collection(db, "missoes"), data);
        }
        window.closeMissaoModal();
        window.loadMissoes();
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Salvar Missão no Firebase";
    }
}

window.deleteMissao = async function(id) {
    if (!confirm("Tem certeza que deseja excluir esta missão? Essa ação é irreversível!")) return;
    try {
        await deleteDoc(doc(db, "missoes", id));
        window.loadMissoes();
    } catch (e) {
        alert("Erro ao excluir: " + e.message);
    }
}

const btnLogout = $('btnLogout');
if (btnLogout) {
    btnLogout.onclick = () => signOut(auth).then(() => window.location.href = "login.html");
}
