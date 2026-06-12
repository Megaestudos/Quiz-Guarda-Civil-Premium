const firebaseConfig = {
  apiKey: "AIzaSyB36ZszS8v_DeOn3at7zEo_tFq86WU0sI4",
  authDomain: "simulados-concursos-22c91.firebaseapp.com",
  projectId: "simulados-concursos-22c91"
};

const ADMIN_EMAIL = "lomateco@gmail.com";

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

const $ = (id) => document.getElementById(id);

let todosConteudos = [];
let hierarchy = {};

auth.onAuthStateChanged(async (user) => {
    if (!user || user.email !== ADMIN_EMAIL) {
        window.location.href = "login.html";
        return;
    }
    await loadHierarchy();
    window.loadMissoes();
});

async function loadHierarchy() {
    try {
        const qSnap = await db.collection('questoes').get();
        hierarchy = {};
        qSnap.forEach(doc => {
            const data = doc.data();
            if (data.ativo === false) return;
            const mat = (data.materia || '').trim();
            let ass = (data.assunto || data.topico || data.tópico || data.topic || '').trim();
            const sub = (data.subassunto || '').trim();
            
            if (!mat) return;
            if (!ass) ass = mat;
            
            if (!hierarchy[mat]) hierarchy[mat] = {};
            if (ass) {
                if (!hierarchy[mat][ass]) hierarchy[mat][ass] = new Set();
                if (sub && sub.toLowerCase() !== ass.toLowerCase()) {
                    hierarchy[mat][ass].add(sub);
                }
            }
        });
        
        // Popula materia
        const selMat = $('mMateria');
        selMat.innerHTML = '<option value="">Selecione a Matéria</option>';
        Object.keys(hierarchy).sort().forEach(m => {
            selMat.innerHTML += `<option value="${m}">${m}</option>`;
        });
    } catch(e) {
        console.error("Erro ao carregar hierarquia", e);
    }
}

window.onMateriaChange = function() {
    const mat = $('mMateria').value;
    const selAss = $('mAssunto');
    const selSub = $('mSubassunto');
    selAss.innerHTML = '<option value="">Selecione o Assunto</option>';
    selSub.innerHTML = '<option value="">Nenhum (Usar Assunto principal)</option>';
    
    if (mat && hierarchy[mat]) {
        Object.keys(hierarchy[mat]).sort().forEach(a => {
            selAss.innerHTML += `<option value="${a}">${a}</option>`;
        });
    }
}

window.onAssuntoChange = function() {
    const mat = $('mMateria').value;
    const ass = $('mAssunto').value;
    const selSub = $('mSubassunto');
    selSub.innerHTML = '<option value="">Nenhum (Usar Assunto principal)</option>';
    
    if (mat && ass && hierarchy[mat] && hierarchy[mat][ass]) {
        Array.from(hierarchy[mat][ass]).sort().forEach(s => {
            selSub.innerHTML += `<option value="${s}">${s}</option>`;
        });
    }
}

window.loadMissoes = async function() {
    const list = $('missoesList');
    list.innerHTML = '<tr><td colspan="6" class="text-center py-8"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto text-blue-500"></i></td></tr>';
    if (window.lucide) lucide.createIcons();

    try {
        const snap = await db.collection("conteudos_jornada").orderBy("ordem").get();
        todosConteudos = [];

        snap.forEach(doc => {
            todosConteudos.push({ id: doc.id, ...doc.data() });
        });

        renderMissoes();
    } catch (e) {
        alert("Erro ao carregar conteudos_jornada: " + e.message);
        list.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red-500">Erro: ${e.message}</td></tr>`;
    }
};

function renderMissoes() {
    const list = $('missoesList');
    list.innerHTML = '';
    
    if (todosConteudos.length === 0) {
        list.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500 italic">Nenhum conteúdo configurado ainda.</td></tr>';
        return;
    }

    todosConteudos.forEach(m => {
        const statusBadge = m.ativo 
            ? '<span class="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-md text-xs font-bold">Ativa</span>'
            : '<span class="bg-red-500/10 text-red-500 px-2 py-1 rounded-md text-xs font-bold">Inativa</span>';

        const tr = document.createElement('tr');
        tr.className = "hover:bg-white/5 transition-colors group";
        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="text-sm text-gray-300">${m.materia || '-'}</div>
            </td>
            <td class="px-6 py-4">
                <div class="font-bold text-white">${m.subassunto || m.assunto || '-'}</div>
                <div class="text-xs text-gray-500">${m.subassunto ? 'Assunto Pai: '+m.assunto : 'Missão Principal do Assunto'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap"><div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center font-bold text-xs">${m.ordem || 0}</div></td>
            <td class="px-6 py-4 text-sm text-gray-400 capitalize">${m.aprender_tipo || '-'}</td>
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
    $('mMateria').value = '';
    $('mAssunto').innerHTML = '<option value="">Selecione o Assunto</option>';
    $('mSubassunto').innerHTML = '<option value="">Nenhum (Usar Assunto principal)</option>';
    $('mAprenderTipo').value = 'video';
    $('mAprenderUrl').value = '';
    $('mPdfUrl').value = '';
    
    const maxOrdem = todosConteudos.reduce((max, m) => Math.max(max, m.ordem || 0), 0);
    $('mOrdem').value = maxOrdem + 1;
    
    $('mAtivo').checked = true;
    
    $('modalTitle').innerText = 'Novo Conteúdo';
    $('modalMissao').style.display = 'flex';
}

window.editMissao = function(id) {
    const m = todosConteudos.find(x => x.id === id);
    if (!m) return;
    
    $('mId').value = m.id;
    $('mMateria').value = m.materia || '';
    window.onMateriaChange();
    $('mAssunto').value = m.assunto || '';
    window.onAssuntoChange();
    $('mSubassunto').value = m.subassunto || '';
    
    $('mAprenderTipo').value = m.aprender_tipo || 'video';
    $('mAprenderUrl').value = m.aprender_url || '';
    $('mPdfUrl').value = m.resumo_pdf_url || '';
    $('mOrdem').value = m.ordem || 1;
    $('mAtivo').checked = m.ativo !== false;
    
    $('modalTitle').innerText = 'Editar Conteúdo';
    $('modalMissao').style.display = 'flex';
}

window.closeMissaoModal = function() {
    $('modalMissao').style.display = 'none';
}

window.deleteMissao = async function(id) {
    if (confirm("Deletar esse conteúdo?")) {
        await db.collection("conteudos_jornada").doc(id).delete();
        window.loadMissoes();
    }
}

window.saveMissao = async function() {
    const id = $('mId').value;
    const btn = $('btnSaveMissao');
    
    const materia = $('mMateria').value;
    const assunto = $('mAssunto').value;
    const subassunto = $('mSubassunto').value;
    
    if (!materia || !assunto) {
        return alert("Matéria e Assunto são obrigatórios.");
    }
    
    const data = {
        materia: materia,
        assunto: assunto,
        subassunto: subassunto,
        aprender_tipo: $('mAprenderTipo').value,
        aprender_url: $('mAprenderUrl').value.trim(),
        resumo_pdf_url: $('mPdfUrl').value.trim(),
        ordem: parseInt($('mOrdem').value) || 1,
        ativo: $('mAtivo').checked
    };
    
    // Gerar um ID previsível
    const docId = id || `${materia}_${assunto}_${subassunto}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    btn.disabled = true;
    btn.innerText = "Salvando...";
    
    try {
        await db.collection("conteudos_jornada").doc(docId).set(data);
        window.closeMissaoModal();
        window.loadMissoes();
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Salvar Missão";
    }
}
