// ==========================================
// AULAS DE REDAÇÃO PREMIUM (JSON & MICRO-TASKS)
// ==========================================

let essayLessonState = {
    currentTopic: null,
    lessonData: null,
    currentStepIndex: 0,
    steps: [],
    evaluations: {}
};

let threeScene, threeCamera, threeRenderer, threeParticles;

// Sobrescreve o hook da página inicial para forçar a nova view
window.startEssayFlow = function() {
    showEssaySetup();
};

window.showEssaySetup = function() {
    showProfAiViews('profAiEssaySetup');
    initThreeJsBg();
};

function initThreeJsBg() {
   const container = document.getElementById('threeJsContainer');
   if(!container || container.innerHTML !== '') return;
   if (!window.THREE) return;

   threeScene = new THREE.Scene();
   threeCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
   threeRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
   threeRenderer.setSize(window.innerWidth, window.innerHeight);
   container.appendChild(threeRenderer.domElement);

   const geometry = new THREE.BufferGeometry();
   const particlesCount = 250;
   const posArray = new Float32Array(particlesCount * 3);
   for(let i = 0; i < particlesCount * 3; i++) {
       posArray[i] = (Math.random() - 0.5) * 6;
   }
   geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
   const material = new THREE.PointsMaterial({ size: 0.007, color: 0x3B82F6, transparent: true, opacity: 0.7 });
   threeParticles = new THREE.Points(geometry, material);
   threeScene.add(threeParticles);
   threeCamera.position.z = 2;

   function animate() {
       requestAnimationFrame(animate);
       if(threeParticles) {
          threeParticles.rotation.y += 0.001;
          threeParticles.rotation.x += 0.0005;
       }
       threeRenderer.render(threeScene, threeCamera);
   }
   animate();
   
   window.addEventListener('resize', () => {
       threeCamera.aspect = window.innerWidth / window.innerHeight;
       threeCamera.updateProjectionMatrix();
       threeRenderer.setSize(window.innerWidth, window.innerHeight);
   });
}

window.selectEssayTopic = function(topic) {
    document.getElementById('aiEssayTopicInput').value = topic;
};

window.submitEssayTopic = async function() {
    const input = document.getElementById('aiEssayTopicInput');
    const topic = input.value.trim();
    if(!topic) return;

    const btn = document.querySelector('#profAiEssaySetup .icon-btn-round');
    btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i>';
    btn.disabled = true;
    input.disabled = true;

    if (threeParticles) threeParticles.material.color.setHex(0x10B981); 

    try {
        const fetcher = firebase.app().functions('southamerica-east1').httpsCallable('generateEssayLesson');
        const res = await fetcher({ topic: topic });
        
        essayLessonState.currentTopic = topic;
        essayLessonState.lessonData = res.data.lesson;
        buildCourse(res.data.lesson);
    } catch (e) {
        if(e.message && e.message.includes('limite_lesson')) {
            showPremiumAlert("Você já gerou uma nova aula hoje. Foco no estudo! Tente novamente amanhã.", "Limite Atingido");
        } else {
            showPremiumAlert("Erro: " + (e.message || "Falha ao gerar a aula."), "Ocorreu um Erro");
        }
    } finally {
        btn.innerHTML = '<i class="ph-fill ph-magic-wand"></i>';
        btn.disabled = false;
        input.disabled = false;
        if(threeParticles) threeParticles.material.color.setHex(0x3B82F6);
    }
};

function buildCourse(lesson) {
    showProfAiViews('profAiEssayCourse');
    document.getElementById('essayCourseTitle').innerHTML = `<i class="ph ph-book-open"></i> ${essayLessonState.currentTopic}`;

    essayLessonState.steps = [];
    essayLessonState.evaluations = {};

    if(lesson.introducao) essayLessonState.steps.push({ id:'intro', title: 'Introdução', data: lesson.introducao, type: 'content' });
    if(lesson.contextualizacao) essayLessonState.steps.push({ id:'contexto', title: 'Contextualização', data: lesson.contextualizacao, type: 'content' });
    if(lesson.repertorio) essayLessonState.steps.push({ id:'repertorio', title: 'Repertório', data: lesson.repertorio, type: 'repertorio_list' });
    
    // Prática 1: Intro
    essayLessonState.steps.push({ id:'micro_intro', title: 'Treino: Introdução', data: 'Escreva a introdução para o tema.', type: 'microtask', evalPart: 'introducao' });

    if(lesson.argumentos) essayLessonState.steps.push({ id:'argumentos', title: 'Argumentos', data: lesson.argumentos, type: 'args_list' });
    if(lesson.conectivos) essayLessonState.steps.push({ id:'conectivos', title: 'Conectivos', data: lesson.conectivos, type: 'conn_list' });
    
    // Prática 2: Dev
    essayLessonState.steps.push({ id:'micro_dev', title: 'Treino: Desenvolvimento', data: 'Escreva um parágrafo de desenvolvimento estruturado.', type: 'microtask', evalPart: 'desenvolvimento' });

    if(lesson.estrutura) essayLessonState.steps.push({ id:'estrutura', title: 'Estrutura Completa', data: lesson.estrutura, type: 'content' });
    if(lesson.exemplos_alta_nota) essayLessonState.steps.push({ id:'exemplos', title: 'Exemplos Nota 1000', data: lesson.exemplos_alta_nota, type: 'ex_list' });
    
    // Prática 3: Final
    essayLessonState.steps.push({ id:'final', title: 'Redação Final', data: 'Escreva sua redação final completa.', type: 'microtask', evalPart: 'final' });

    essayLessonState.currentStepIndex = 0;
    renderTimeline();
    renderCurrentStep();
}

function renderTimeline() {
    const tl = document.getElementById('courseTimeline');
    tl.innerHTML = '';
    essayLessonState.steps.forEach((step, idx) => {
        const div = document.createElement('div');
        div.className = `timeline-step ${idx === essayLessonState.currentStepIndex ? 'active' : ''} ${idx < essayLessonState.currentStepIndex ? 'completed' : ''}`;
        
        // Clicar para rever passos já completados
        if(idx <= essayLessonState.currentStepIndex) {
            div.style.cursor = 'pointer';
            div.onclick = () => {
                essayLessonState.currentStepIndex = idx;
                renderTimeline();
                renderCurrentStep();
            };
        }

        let icon = 'ph-book-open';
        if(step.type === 'microtask') icon = 'ph-pencil-line';
        if(idx < essayLessonState.currentStepIndex || essayLessonState.evaluations[step.id]) icon = 'ph-check-circle';

        div.innerHTML = `
            <div class="step-icon"><i class="ph-fill ${icon}"></i></div>
            <div class="step-title">${step.title}</div>
        `;
        tl.appendChild(div);
    });
}

function renderCurrentStep() {
    const area = document.getElementById('courseContentArea');
    const step = essayLessonState.steps[essayLessonState.currentStepIndex];
    let html = '';

    if (step.type === 'content') {
        html = `
            <div class="lesson-module">
                <h3><i class="ph ph-info"></i> ${step.data.titulo || step.title}</h3>
                <p>${step.data.texto || step.data.orientacao}</p>
                <button class="btn btn-primary" onclick="advanceStep()" style="margin-top:20px;">Continuar <i class="ph-fill ph-arrow-right"></i></button>
            </div>
        `;
    } 
    else if (step.type === 'repertorio_list') {
        html = `<div class="lesson-module"><h3><i class="ph ph-books"></i> Exemplos de Repertório</h3><div class="repertory-list">`;
        step.data.forEach(item => {
           html += `<div class="repertory-card"><h4>[${item.tipo}]</h4><p>${item.descricao}</p></div>`;
        });
        html += `</div><button class="btn btn-primary" onclick="advanceStep()" style="margin-top:20px;">Continuar <i class="ph-fill ph-arrow-right"></i></button></div>`;
    }
    else if (step.type === 'args_list' || step.type === 'conn_list' || step.type === 'ex_list') {
        html = `<div class="lesson-module"><h3><i class="ph ph-list-bullets"></i> Aprofundamento</h3><div class="repertory-list">`;
        step.data.forEach(item => {
           let h4 = item.ideia || item.uso || 'Análise';
           let p = item.desenvolvimento || item.exemplo || item.comentario || item.paragrafo;
           html += `<div class="repertory-card"><h4>${h4}</h4><p>${p}</p></div>`;
        });
        html += `</div><button class="btn btn-primary" onclick="advanceStep()" style="margin-top:20px;">Continuar <i class="ph-fill ph-arrow-right"></i></button></div>`;
    }
    else if (step.type === 'microtask') {
        const isEval = essayLessonState.evaluations[step.id];
        
        html = `
            <div class="lesson-module">
                <h3><i class="ph ph-pencil-simple"></i> ${step.title}</h3>
                <p><strong>Orientação:</strong> ${step.data}</p>
                <div class="micro-task-box">
                    <h4>Praticar</h4>
                    <textarea id="taskTextarea_${step.id}" class="micro-task-textarea" placeholder="Digite seu texto aqui..."></textarea>
                    <button id="taskBtn_${step.id}" class="btn btn-primary" onclick="submitMicroTask('${step.id}', '${step.evalPart}')">Enviar para Avaliação <i class="ph-fill ph-paper-plane-right"></i></button>
                </div>
                <div id="evalResult_${step.id}"></div>
            </div>
        `;
    }

    area.innerHTML = html;

    // Se já tinha avaliação
    if(step.type === 'microtask' && essayLessonState.evaluations[step.id]) {
       renderEvaluationUI(step.id, essayLessonState.evaluations[step.id]);
    }
}

window.advanceStep = function() {
    if (essayLessonState.currentStepIndex < essayLessonState.steps.length - 1) {
        essayLessonState.currentStepIndex++;
        renderTimeline();
        renderCurrentStep();
    }
};

window.submitMicroTask = async function(stepId, evalPart) {
    const txtArea = document.getElementById(`taskTextarea_${stepId}`);
    const btn = document.getElementById(`taskBtn_${stepId}`);
    const resDiv = document.getElementById(`evalResult_${stepId}`);
    const text = txtArea.value.trim();

    if(!text) return;

    btn.disabled = true;
    txtArea.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Avaliando...';

    resDiv.innerHTML = `
        <div class="feedback-card loading">
             <i class="ph ph-spinner-gap ph-spin" style="font-size:24px; color:var(--primary);"></i>
             <span style="margin-left:10px; color:var(--primary); font-weight:600;">O Professor AI está processando rigorosamente o seu texto...</span>
        </div>
    `;

    try {
        const fetcher = firebase.app().functions('southamerica-east1').httpsCallable('evaluateEssayPart');
        const r = await fetcher({ part: evalPart, text: text, topic: essayLessonState.currentTopic });
        const evalData = r.data.evaluation;
        
        essayLessonState.evaluations[stepId] = evalData;
        renderTimeline();
        renderEvaluationUI(stepId, evalData);
        
    } catch(e) {
        if(e.message && e.message.includes('limite_final_eval')) {
            resDiv.innerHTML = `<div class="feedback-card" style="border-color:var(--danger);"><h4 style="color:var(--danger);">Limite Atingido!</h4><p>Seu ciclo de prática de redações finais de hoje foi concluído com sucesso. Agora é hora de revisar seus aprendizados. Amanhã uma nova avaliação estará disponível.</p></div>`;
        } else {
             resDiv.innerHTML = `<div class="feedback-card" style="border-color:var(--danger);"><p style="color:var(--danger);">Erro na avaliação: ${e.message}</p></div>`;
        }
        btn.disabled = false;
        txtArea.disabled = false;
        btn.innerHTML = 'Enviar para Avaliação <i class="ph-fill ph-paper-plane-right"></i>';
    }
};

function renderEvaluationUI(stepId, eval) {
    const resDiv = document.getElementById(`evalResult_${stepId}`);
    
    // Esconder o form de input
    const btn = document.getElementById(`taskBtn_${stepId}`);
    if(btn) btn.style.display = 'none';

    let html = '';

    if (eval.nota_geral !== undefined) {
        // BOLETIM COMPLETO (Final)
        html += `
          <div class="boletim-card" style="margin-top:20px; animation: fadeSlideUp 0.6s ease;">
             <div class="boletim-score-label">Nota Final AI</div>
             <div class="boletim-score">${eval.nota_geral}</div>
             
             <div class="competencias-grid" style="margin-top:30px;">
                <div class="comp-box"><div class="comp-name">Gramática</div><div class="comp-val">${eval.competencias?.gramatica||0}</div></div>
                <div class="comp-box"><div class="comp-name">Argumentação</div><div class="comp-val">${eval.competencias?.argumentacao||0}</div></div>
                <div class="comp-box"><div class="comp-name">Estrutura</div><div class="comp-val">${eval.competencias?.estrutura||0}</div></div>
                <div class="comp-box"><div class="comp-name">Coesão</div><div class="comp-val">${eval.competencias?.coesao||0}</div></div>
                <div class="comp-box" style="grid-column: span 2;"><div class="comp-name">Repertório</div><div class="comp-val">${eval.competencias?.repertorio||0}</div></div>
             </div>
             
             <div style="text-align:left; background:rgba(255,255,255,0.05); padding:16px; border-radius:16px; margin-bottom:12px;">
                <strong style="color:var(--success); display:block; margin-bottom:8px;"><i class="ph-fill ph-check-circle"></i> Pontos Fortes</strong>
                <ul style="font-size:13px; color:var(--text-muted); padding-left:20px; margin:0;">
                   ${(eval.pontos_fortes||[]).map(p => `<li>${p}</li>`).join('')}
                </ul>
             </div>
             
             <div style="text-align:left; background:rgba(255,255,255,0.05); padding:16px; border-radius:16px;">
                <strong style="color:var(--danger); display:block; margin-bottom:8px;"><i class="ph-fill ph-warning-circle"></i> O que melhorar</strong>
                <ul style="font-size:13px; color:var(--text-muted); padding-left:20px; margin:0;">
                   ${(eval.melhorias||[]).concat(eval.erros_especificos||[]).map(p => `<li>${p}</li>`).join('')}
                </ul>
             </div>
          </div>
        `;
    } else {
        // FEEDBACK CIRÚRGICO CURTO (Microtarefas)
        html += `
            <div class="feedback-card" style="border-color:var(--success);">
               <h4 style="color:var(--success); margin-bottom:12px;"><i class="ph-fill ph-check-circle"></i> Avaliação Pontual AI</h4>
               <p style="font-size:14px; margin-bottom:8px;"><strong>Status:</strong> Otimização Identificada.</p>
               <ul style="font-size:13px; color:var(--text-muted); padding-left:20px; margin:0;">
                   ${(eval.melhorias||[]).concat(eval.erros_especificos||[]).map(p => `<li>${p}</li>`).join('')}
                   ${(eval.pontos_fortes||[]).map(p => `<li style="color:var(--success);">${p}</li>`).join('')}
               </ul>
            </div>
        `;
    }

    // Botão de avanço
    if(essayLessonState.currentStepIndex < essayLessonState.steps.length - 1) {
        html += `<button class="btn btn-primary" onclick="advanceStep()" style="width:100%; margin-top:20px;">Próximo Passo <i class="ph-fill ph-arrow-right"></i></button>`;
    } else {
        html += `<button class="btn btn-primary" onclick="showEssaySetup()" style="width:100%; margin-top:20px; background:linear-gradient(135deg, #10B981, #059669);">Finalizar Aula</button>`;
    }

    resDiv.innerHTML = html;
}

window.showPremiumAlert = function(message, title = "Aviso") {
    let overlay = document.getElementById('premiumAlertOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'premiumAlertOverlay';
        overlay.className = 'premium-alert-overlay';
        
        const box = document.createElement('div');
        box.className = 'premium-alert-box';
        
        const header = document.createElement('div');
        header.className = 'premium-alert-header';
        
        const iconContainer = document.createElement('div');
        iconContainer.className = 'premium-alert-icon';
        iconContainer.innerHTML = '<i class="ph-fill ph-warning-circle"></i>';
        
        const titleEl = document.createElement('h3');
        titleEl.id = 'premiumAlertTitle';
        
        header.appendChild(iconContainer);
        header.appendChild(titleEl);
        
        const msgEl = document.createElement('p');
        msgEl.id = 'premiumAlertMessage';
        
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.innerHTML = 'Entendi';
        btn.style.width = '100%';
        btn.style.marginTop = '20px';
        btn.onclick = () => {
            overlay.classList.remove('active');
            setTimeout(() => { overlay.style.display = 'none'; }, 300);
        };
        
        box.appendChild(header);
        box.appendChild(msgEl);
        box.appendChild(btn);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }
    
    document.getElementById('premiumAlertTitle').innerText = title;
    document.getElementById('premiumAlertMessage').innerText = message;
    
    overlay.style.display = 'flex';
    // Trigger reflow para a animação
    void overlay.offsetWidth;
    overlay.classList.add('active');
};
