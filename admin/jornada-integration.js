import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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

let currentCmsData = [];
let currentMissaoId = null;

onAuthStateChanged(auth, async (user) => {
    if (!user || user.email !== ADMIN_EMAIL) {
        window.location.href = "login.html";
        return;
    }
    initDropdowns();
});

function initDropdowns() {
    const selCarreira = $('selCarreira');
    const selModulo = $('selModulo');
    const selMissao = $('selMissao');
    
    // Store array locally to use in indices
    window._carreirasArray = Object.values(window.CARREIRAS || {});

    selCarreira.innerHTML = '<option value="">Selecione a Carreira...</option>';
    window._carreirasArray.forEach((c, index) => {
        selCarreira.innerHTML += `<option value="${index}">${c.nome}</option>`;
    });

    selCarreira.onchange = () => {
        const cIdx = selCarreira.value;
        if (cIdx === "") {
            selModulo.disabled = true;
            selMissao.disabled = true;
            $('cmsArea').classList.add('hidden');
            return;
        }
        const carreira = window._carreirasArray[cIdx];
        selModulo.innerHTML = '<option value="">Selecione o Módulo...</option>';
        carreira.modulos.forEach((m, idx) => {
            selModulo.innerHTML += `<option value="${idx}">${m.nome}</option>`;
        });
        selModulo.disabled = false;
        selMissao.disabled = true;
        $('selEtapa').disabled = true;
        $('cmsArea').classList.add('hidden');
    };

    selModulo.onchange = () => {
        const cIdx = selCarreira.value;
        const mIdx = selModulo.value;
        if (mIdx === "") {
            selMissao.disabled = true;
            $('selEtapa').disabled = true;
            $('cmsArea').classList.add('hidden');
            return;
        }
        const modulo = window._carreirasArray[cIdx].modulos[mIdx];
        selMissao.innerHTML = '<option value="">Selecione a Missão...</option>';
        modulo.missoes.forEach((m) => {
            selMissao.innerHTML += `<option value="${m.id}">${m.nome} (${m.subassunto})</option>`;
        });
        selMissao.disabled = false;
        $('selEtapa').disabled = true;
        $('cmsArea').classList.add('hidden');
    };

    selMissao.onchange = () => {
        const mId = selMissao.value;
        if (!mId) {
            $('selEtapa').disabled = true;
            $('cmsArea').classList.add('hidden');
            return;
        }
        $('selEtapa').disabled = false;
        $('selEtapa').value = "";
        $('cmsArea').classList.add('hidden');
    };

    $('selEtapa').onchange = () => {
        const mId = selMissao.value;
        const eId = $('selEtapa').value;
        if (!mId || !eId) {
            $('cmsArea').classList.add('hidden');
            return;
        }
        currentMissaoId = mId;
        window.currentEtapaId = eId;
        const mName = selMissao.options[selMissao.selectedIndex].text;
        const eName = $('selEtapa').options[$('selEtapa').selectedIndex].text;
        $('cmsTitle').innerText = `${mName} - ${eName}`;
        loadMissaoContent(mId, eId);
    };
}

async function loadMissaoContent(missaoId, etapaId) {
    $('cmsArea').classList.remove('hidden');
    const list = $('cmsList');
    list.innerHTML = '<div class="text-center py-6"><i data-lucide="loader-2" class="w-6 h-6 animate-spin text-blue-500 mx-auto"></i><p class="text-xs text-gray-500 mt-2">Carregando do Firebase...</p></div>';
    lucide.createIcons();

    try {
        const docRef = doc(db, "jornada_missoes", missaoId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().cms) {
            let cmsData = docSnap.data().cms;
            if (Array.isArray(cmsData)) cmsData = { aprender: cmsData, resumo: [] };
            currentCmsData = cmsData[etapaId] || [];
        } else {
            currentCmsData = [];
        }
        renderCmsList();
    } catch (e) {
        alert("Erro ao carregar dados do Firebase: " + e.message);
    }
}

function renderCmsList() {
    const list = $('cmsList');
    list.innerHTML = '';
    if (currentCmsData.length === 0) {
        list.innerHTML = '<div class="glass-panel p-6 rounded-2xl text-center text-gray-500 italic">Nenhum conteúdo cadastrado nesta missão ainda.</div>';
        return;
    }

    currentCmsData.forEach((block, index) => {
        const card = document.createElement('div');
        card.className = "glass-panel p-4 rounded-2xl flex items-start justify-between border border-white/5 relative group";
        
        let icon = 'file-text';
        let color = 'text-gray-400 bg-gray-500/10';
        let preview = '';

        if (block.type === 'video') {
            icon = 'video';
            color = 'text-red-500 bg-red-500/10';
            preview = `<div class="text-xs text-gray-400 mt-1">ID: ${block.youtubeId || block.url}</div>`;
        } else if (block.type === 'audio') {
            icon = 'headphones';
            color = 'text-emerald-500 bg-emerald-500/10';
            preview = `<div class="text-xs text-gray-400 mt-1">Duração: ${block.duration || '-'}</div>`;
        } else if (block.type === 'resumo' || block.type === 'texto') {
            icon = 'align-left';
            color = 'text-blue-500 bg-blue-500/10';
            preview = `<div class="text-xs text-gray-400 mt-1 truncate max-w-md">${block.conteudo}</div>`;
        }

        card.innerHTML = `
            <div class="flex gap-4">
                <div class="w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0">
                    <i data-lucide="${icon}" class="w-5 h-5"></i>
                </div>
                <div>
                    <h4 class="font-bold text-sm text-white">${block.title || 'Resumo (Texto)'}</h4>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">${block.type}</span>
                    ${preview}
                </div>
            </div>
            <button onclick="window.deleteCmsBlock(${index})" class="text-gray-600 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        `;
        list.appendChild(card);
    });
    lucide.createIcons();
}

window.openCmsModal = function() {
    $('modalCms').style.display = 'flex';
    $('cmsTitleInput').value = '';
    $('cmsUrl').value = '';
    $('cmsDuration').value = '';
    $('cmsContent').value = '';
    
    const cmsType = $('cmsType');
    cmsType.innerHTML = '';
    if (window.currentEtapaId === 'aprender') {
        cmsType.innerHTML = '<option value="video">Vídeo (YouTube/MP4)</option><option value="audio">Áudio (Podcast)</option>';
    } else if (window.currentEtapaId === 'resumo') {
        cmsType.innerHTML = '<option value="resumo">Resumo (Texto Longo)</option>';
    } else {
        cmsType.innerHTML = '<option value="video">Vídeo</option><option value="audio">Áudio</option><option value="resumo">Resumo</option>';
    }
    window.toggleCmsFields();
}

window.closeCmsModal = function() {
    $('modalCms').style.display = 'none';
}

window.saveCmsBlock = async function() {
    if (!currentMissaoId) return alert("Nenhuma missão selecionada.");

    const type = $('cmsType').value;
    const btn = $('btnSaveCms');

    let newBlock = { type };

    if (type === 'resumo') {
        const cont = $('cmsContent').value.trim();
        if (!cont) return alert("Digite o resumo.");
        newBlock.conteudo = cont;
    } else {
        const tit = $('cmsTitleInput').value.trim();
        const url = $('cmsUrl').value.trim();
        if (!tit || !url) return alert("Título e URL são obrigatórios para mídia.");
        newBlock.title = tit;
        if (type === 'video') {
            if (url.length === 11 && !url.includes('/')) newBlock.youtubeId = url;
            else newBlock.url = url;
        } else if (type === 'audio') {
            newBlock.url = url;
            newBlock.duration = $('cmsDuration').value.trim();
        }
    }

    currentCmsData.push(newBlock);
    
    btn.disabled = true; btn.innerText = "Salvando...";
    try {
        const docRef = doc(db, "jornada_missoes", currentMissaoId);
        const docSnap = await getDoc(docRef);
        let cmsObj = {};
        if (docSnap.exists() && docSnap.data().cms) {
            let existing = docSnap.data().cms;
            if (Array.isArray(existing)) cmsObj = { aprender: existing, resumo: [] };
            else cmsObj = existing;
        }
        cmsObj[window.currentEtapaId] = currentCmsData;

        await setDoc(docRef, { cms: cmsObj }, { merge: true });
        window.closeCmsModal();
        renderCmsList();
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    } finally {
        btn.disabled = false; btn.innerText = "Salvar no Firebase";
    }
}

window.deleteCmsBlock = async function(index) {
    if (!confirm("Tem certeza que deseja remover este bloco?")) return;
    currentCmsData.splice(index, 1);
    
    try {
        const docRef = doc(db, "jornada_missoes", currentMissaoId);
        const docSnap = await getDoc(docRef);
        let cmsObj = {};
        if (docSnap.exists() && docSnap.data().cms) {
            let existing = docSnap.data().cms;
            if (Array.isArray(existing)) cmsObj = { aprender: existing, resumo: [] };
            else cmsObj = existing;
        }
        cmsObj[window.currentEtapaId] = currentCmsData;

        await setDoc(docRef, { cms: cmsObj }, { merge: true });
        renderCmsList();
    } catch (e) {
        alert("Erro ao remover: " + e.message);
    }
}

const btnLogout = $('btnLogout');
if (btnLogout) {
    btnLogout.onclick = () => signOut(auth).then(() => window.location.href = "login.html");
}
