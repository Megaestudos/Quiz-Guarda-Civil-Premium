var SCRIPT_URL="https://script.google.com/macros/s/AKfycbx64clSmoa7ymBZls8osmpp6PuwCyqHJ0bcOBz9NI0PqBM_tHr8Px_lGdQESCRIPT_URL="https://script.google.com/macros/s/AKfycbx64clSmoa7ymBZls8osmpp6PuwCyqHJ0bcOBz9NI0PqBM_tHr8Px_lGdQEr_9INdMB3g/exec";
var POOL=[],currentIndex=0,score=0,quizStarted=false;
var SOUND_KEY="quiz_sound_on",SCALE_KEY="quiz_card_scale",BEST_KEY="quiz_best_record";
var STREAK_KEY="quiz_streak",QUESTIONS_KEY="quiz_total_questions";
var LAST_VISIT_KEY="quiz_last_visit",DAILY_DATA_KEY="quiz_daily_data";
var audioCtx=null,chartInstance=null;
function q_text(q){return q.pergunta||q.perguntas||q.question||"";}
function q_topic(q){return q.materia||q.topico||q.topic||"";}
function q_expl(q){return q.explicacao||q.explanation||"";}
function q_answer_letter(q){var a=(q.resposta||q.answer||"").toString().trim();return
a.substr(0,1).toUpperCase();}
function q_option(q,letter){return
q[letter.toUpperCase()]||q[letter.toLowerCase()]||"";}
function getFirestoreDb(){try{if(window.firebase&&firebase.firestore){return
firebase.firestore();}}catch(e){}return null;}
function isMobile(){return window.matchMedia&&window.matchMedia("(max-width: 600px)").matches;}
function updateMobileQuizHeight(){if(!isMobile())return;var
h=document.getElementById("cardHeader"),t=document.getElementById("tabsBar"),hv=h&&getComputedStyle(h).display!=="nh=document.getElementById("cardHeader"),t=document.getEementById("tabsBar"),hv=h&&getComputedStyle(h).display!=="none",hh=hv?Math.ceil(h.getBoundingClientRect().height):0,th=t?Math.ceil(t.getBoundingClientRect().height+20):86;docune",hh=hv?Math.ceil(h.getBoundingClientRect().height):0,th=t?Math.ceil(t.getBoundingClientRect().height+20):86;document.documentElement.style.setProperty("--header-h",hh+"px");document.documentElement.style.setProperty("--tabs-h",tent.documentElement.style.setProperty("--header-h",hh+"px");document.documentElement.style.setProperty("--tabs-h",th+"px");document.documentElement.style.setProperty("--quiz-h",Math.max(360,window.innerHeight-hh-th-26)+"px");}
function applyQuizViewportMode(on){var
q=document.getElementById("quiz");if(!q)return;document.body.classList.toggle("quiz-mode",!!on);if(isMobile()&&on){q=document.getElementById("quiz");if(!q)return;document.body.classList.toggl("quiz-mode",!!on);if(isMobile()&&on){document.body.classList.add("lock-scroll");q.classList.add("quiz-viewport");requestAnimationFrame(function(){updateMocument.body.classList.add("lock-scroll");q.classList.add("quiz-viewport");requestAnimationFrame(function(){updateMobileQuizHeight();});}else{document.body.classList.remove("lock-scroll");q.classList.remove("quiz-viewport");updateMbileQuizHeight();});}else{document.body.classList.remove("lock-scroll");q.classList.remove("quiz-viewport");updateMobileQuizHeight();}}
window.addEventListener("resize",function(){updateMobileQuizHeight();});
function ensureAudio(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();}
function
playTone(f,d,t,g){if(d===undefined)d=120;if(t===undefined)t="sine";if(g===undefined)g=0.06;if(localStorage.getItem(playTone(f,d,t,g){if(d===undefined)d=120;if(t===undefined)t="sine";if(g===undefined)g=0.06;if(localStoragegetItem(SOUND_KEY)==="0")return;try{ensureAudio();var
o=audioCtx.createOscillator(),a=audioCtx.createGain();o.type=t;o.frequency.value=f;a.gain.value=g;o.connect(a);a.coo=audioCtx.createOscillator(),a=audioCtx.createGain();o.type=t;o.frequncy.value=f;a.gain.value=g;o.connect(a);a.connect(audioCtx.destination);o.start();setTimeout(function(){o.stop();o.disconnect();a.disconnect();},d);}catch(e){}}nect(audioCtx.destination);o.start();setTimeout(function(){o.stop();o.disconnect();a.disconnect();},d);}catch(e){}}
function playCorrect(){playTone(880,120,"sine",0.06);}
function playWrong(){playTone(220,220,"sawtooth",0.08);}
function setScale(v){v=Math.max(0.8,Math.min(1.4,Number(v)));var
r=document.getElementById("appRoot"),l=document.getElementById("scaleLabel");if(r)r.style.transform="scale("+v.toFir=document.getElementById("appRoot"),l=document.geElementById("scaleLabel");if(r)r.style.transform="scale("+v.toFixed(2)+")";if(r)r.style.transformOrigin="top
center";if(l)l.innerText="x"+v.toFixed(2);localStorage.setItem(SCALE_KEY,v.toFixed(2));updateMobileQuizHeight();}
function go(target){console.log("Navegando:",target);var p=document.querySelectorAll(".page");for(var
i=0;i<p.length;i++)p[i].classList.remove("active");var
t=document.getElementById(target);if(t)t.classList.add("active");var
b=document.querySelectorAll(".tabbtn");for(var i=0;i<b.length;i++)b[i].classList.toggle("active",b[i].dataset.targeb=document.querySelectorAll(".tabbtn");for(vari=0;i<b.length;i++)b[i].classList.toggle("active",b[i].dataset.target===target);applyQuizViewportMode(target==="quiz");window.scrollTo({top:0,behavior:"smooth"});if(target==="home"){sh===target);applyQuizViewportMode(target==="quiz");window.scrollTo({top:0,behavior:"smooth"});if(target==="home"){showBestRecord();loadStats();setDailyTip();setTimeout(renderChart,400);}if(target==="study")renderStudies();if(target=wBestRecord();loadStats();setDailyTip();setTimeout(renderChart,400);}if(target==="study")renderStudies();if(target==="cards")renderCards();if(target==="quiz"&&!quizStarted)showTopicSelection();}
window.go=go;
function linkify(t){if(!t)return"";var
u=/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;return t.replace(u,'<a href="$1"
target="_blank">$1</a>');}
function renderStudies(){var c=document.getElementById("studyList");if(!c)return;c.innerHTML='<div
class="loading-state"><div
class="spinner"></div><p>Carregando...</p></div>';fetch(SCRIPT_URL+"?action=getStudies").then(function(r){return
r.json();}).then(function(j){if(j.ok&&j.studies&&j.studies.length>0){c.innerHTML="";for(var
i=0;i<j.studies.length;i++){var
s=j.studies[i],d=document.createElement("details");d.className="summary";d.innerHTML="<summary>"+(s.topico||"Topicos=j.studies[i],d=document.createElement("details");d.className="summary";d.innerHTM="<summary>"+(s.topico||"Topico")+"</summary><div
class=\"study-content\">"+linkify(s.conteudo||"")+"</div>";c.appendChild(d);}}}catch(e){c.innerHTML='<div
style="text-align:center;padding:30px;">Erro</div>';});}
function showTopicSelection(){var s=document.getElementById("topicSelect");if(!s)return;s.innerHTML='<option
value="Todos">Todos</option>';var db=getFirestoreDb();if(!db){s.innerHTML+='<option
value="Demo">Demo</option>';return;}db.collection("materias").where("ativo","==",true).orderBy("ordem","asc").get()value="Demo">Demo</option>';retrn;}db.collection("materias").where("ativo","==",true).orderBy("ordem","asc").get().then(function(snap){snap.forEach(function(doc){var
d=doc.data()||{},n=(d.nome||"").toString().trim();if(n)s.innerHTML+='<option
value="'+n+'">'+n+"</option>";});}).catch(function(e){s.innerHTML+='<option value="Demo">Demo</option>';});}
function generateDemoQuestions(){return[{pergunta:"Qual lei regula o Estatuto da Guarda
Civil?",materia:"Legislacao",A:"Lei 13.022/2014",B:"Lei 8.112/1990",C:"Lei 10.406/2002",D:"Lei
9.784/1999",resposta:"A",explicacao:"Lei 13.022/2014."},{pergunta:"Qual principio exige
publicidade?",materia:"Dir. Administrativo",A:"Legalidade",B:"Publicidade",C:"Impessoalidade",D:"Moralidade",respospublicidade?",materia:"Dir.Administrativo",A:"Legalidade",B:"Publicidade",C:"Impessoalidade",D:"Moralidade",resposta:"B",explicacao:"Principio da Publicidade."},{pergunta:"O que significa ECA?",materia:"Legislacao
Especial",A:"Estatuto do Cidadao",B:"Estatuto da Crianca e do Adolescente",C:"Estatuto de Capacitacao",D:"Estatuto
de Conduta",resposta:"B",explicacao:"ECA = Lei 8.069/1990."}];}
function loadTopicQuestions(topic){var q=document.getElementById("question");if(q)q.innerText="Carregando...";var
db=getFirestoreDb();if(!db){POOL=generateDemoQuestions();currentIndex=0;score=0;quizStarted=true;renderQuestion();rd=getFirestoreDb();if(!db){POOL=generateDemoQuestions();currentIndex=0;score=0;quizStarted=true;renderQuestion();return;}var 
ref=db.collection("questoes").where("ativo","==",true);if(topic&&topic!=="Todos")ref=ref.where("materia","==",topicref=db.collection("questoes").where("ativo","==",true);if(topic&&topic!=="Todos")ref=ref.where("materia",==",topic);ref.orderBy("ordem","asc").limit(20).get().then(function(snap){POOL=[];snap.forEach(function(doc){POOL.push({id:do;ref.orderBy("ordem","asc").limit(20).get().then(function(snap){POOL=[];snap.forEach(function(doc){POOL.push({id:doc.id,...doc.data()});});currentIndex=0;score=0;quizStarted=true;renderQuestion();}).catch(function(e){POOL=generateD.id,...doc.data()});});currentIndex=0;score=0;quizStarted=true;renderQuestion();}).catch(function(e){POOL=generateDemoQuestions();currentIndex=0;score=0;quizStarted=true;renderQuestion();});}
function renderQuestion(){var
q=document.getElementById("question"),o=document.getElementById("opts"),e=document.getElementById("explain"),n=docuq=document.getElementById("question"),o=document.getElementById("opts"),e=document.geElementById("explain"),n=document.getElementById("nextBtn");if(e)e.style.display="none";if(n)n.disabled=true;if(currentIndex>=POOL.length){finishent.getElementById("nextBtn");if(e)e.style.display="none";if(n)n.disabled=true;if(currentIndex>=POOL.length){finishQuiz();return;}var qq=POOL[currentIndex];if(q)q.innerText="📘 "+q_topic(qq)+"\n"+q_text(qq);if(o)o.innerHTML="";var
letters=["A","B","C","D"];for(var i=0;i<letters.length;i++){var l=letters[i],t=q_option(qq,l);if(!t)continue;var
btn=document.createElement("button");btn.className="opt";btn.id="opt_"+l;btn.innerHTML="<span
style=\"color:var(--accent);margin-right:10px;font-weight:900\">"+l+")</span> "+t;btn.onclick=function(x){return
function(){selectOption(x);};}(l);if(o)o.appendChild(btn);}updateProgressUI();updateMobileQuizHeight();}
function selectOption(letter){var
q=POOL[currentIndex],c=q_answer_letter(q),opts=document.querySelectorAll(".opt");for(var
i=0;i<opts.length;i++)opts[i].disabled=true;var
elC=document.getElementById("opt_"+c);if(elC)elC.classList.add("correct");if(letter!==c){var
elW=document.getElementById("opt_"+letter);if(elW)elW.classList.add("wrong");playWrong();}else{score++;playCorrect(elW=document.getElemenById("opt_"+letter);if(elW)elW.classList.add("wrong");playWrong();}else{score++;playCorrect();}var ex=document.getElementById("explain");if(ex){ex.style.display="block";ex.innerHTML="<strong
style=\"color:var(--accent)\">"+(letter===c?"✅ Correto!":"❌ Errado!")+"</strong><br>"+q_expl(q);}var
n=document.getElementById("nextBtn");if(n)n.disabled=false;incrementQuestionsCount();updateMobileQuizHeight();}
function updateProgressUI(){var
b=document.getElementById("bar"),i=document.getElementById("progressInfo"),t=document.getElementById("progressText"b=document.getElementById("bar"),i=document.getElementById("progressInfo"),t=documet.getElementById("progressText"),p=POOL.length?Math.round((currentIndex/POOL.length)*100):0;if(b)b.style.width=p+"%";if(i)i.innerText=POOL.length?(,p=POOL.length?Math.round((currentIndex/POOL.length)*100):0;if(b)b.style.width=p+"%";if(i)i.innerText=POOL.length?(currentIndex+1)+" / "+POOL.length:"0 / 0";if(t)t.innerText="Pontos: "+score;}
function finishQuiz(){quizStarted=false;var
q=document.getElementById("question"),o=document.getElementById("opts"),r=document.getElementById("btnRestart");if(q=document.getElementById("question"),o=document.getElementById("opts")r=document.getElementById("btnRestart");if(q)q.innerHTML="🎉 <span style=\"color:var(--accent)\">Fim!</span>\n\nAcertou <strong>"+score+"</strong> de
"+POOL.length;if(o)o.innerHTML="";if(r)r.style.display="block";saveRecord(score,POOL.length);saveDailyData(score,PO"+POOL.legth;if(o)o.innerHTML="";if(r)r.style.display="block";saveRecord(score,POOL.length);saveDailyData(score,POOL.length);updateMobileQuizHeight();}
function restartQuiz(){var
r=document.getElementById("btnRestart"),q=document.getElementById("question"),o=document.getElementById("opts"),e=dr=document.getElementById("btnRestart"),q=document.getElementById("question"),o=documentgetElementById("opts"),e=document.getElementById("explain"),b=document.getElementById("bar"),i=document.getElementById("progressInfo"),t=documcument.getElementById("explain"),b=document.getElementById("bar"),i=document.getElementById("progressInfo"),t=document.getElementById("progressText");if(r)r.style.display="none";quizStarted=false;showTopicSelection();if(q)q.innerTent.getElementById("progressText");if(r)r.style.display="none";quizStarted=false;showTopicSelection();if(q)q.innerText="Selecione um topico.";if(
topico.";if(o)o.innerHTML="";if(e)e.style.display="none";if(b)b.style.width="0%";if(i)i.innerText="0 /
0";if(t)t.innerText="";updateMobileQuizHeight();}
function saveRecord(s,t){if(!t)return;var
p=Math.round((s/t)*100),prev=JSON.parse(localStorage.getItem(BEST_KEY)||'{"pct":0}');if(p>prev.pct)localStorage.setp=Math.round((s/t)*100),prev=JSON.parse(localStorage.getItem(BEST_KEY)||'"pct":0}');if(p>prev.pct)localStorage.setItem(BEST_KEY,JSON.stringify({score:s,total:t,pct:p,date:new Date().toISOString()}));}
function saveDailyData(s,t){var p=Math.round((s/t)*100),today=new
Date().toLocaleDateString("pt-BR",{weekday:"short"}),dayMap={"seg":"Seg","ter":"Ter","qua":"Qua","qui":"Qui","sex":Date().toLocaleDateString("pt-BR",{weekday:"short}),dayMap={"seg":"Seg","ter":"Ter","qua":"Qua","qui":"Qui","sex":"Sex","sab":"Sab","dom":"Dom"},dayName=dayMap[today.toLowerCase().slice(0,3)]||today,d=JSON.parse(localStorage.getItSex","sab":"Sab","dom":"Dom"},dayName=dayMap[today.toLowerCase().slice(0,3)]||today,d=JSON.parse(localStorage.getItem(DAILY_DATA_KEY)||"{}");d[dayName]=p;localStorage.setItem(DAILY_DATA_KEY,JSON.stringify(d));}
function showBestRecord(){var
r=JSON.parse(localStorage.getItem(BEST_KEY)),el=document.getElementById("bestScoreStat");if(!el)return;if(r){el.innr=JSON.parse(localStorage.getItem(BEST_KEY)),el=document.getElementById("bestScoreSta");if(!el)return;if(r){el.innerText=r.pct+"%";el.style.animation="pulse 2s infinite";}else{el.innerText="--";}}
function updateStreak(){var today=new
Date().toDateString(),last=localStorage.getItem(LAST_VISIT_KEY),s=parseInt(localStorage.getItem(STREAK_KEY)||"0");iDate().toDateString(),last=localStorage.getItem(LAST_VISIT_KEY),s=parseInt(loalStorage.getItem(STREAK_KEY)||"0");if(last!==today){var y=new Date();y.setDate(y.getDate()-1);if(last===y.toDateString())s++;else
if(last!==today)s=1;localStorage.setItem(STREAK_KEY,s);localStorage.setItem(LAST_VISIT_KEY,today);}var
el=document.getElementById("streakStat");if(el)el.innerText=s;}
function incrementQuestionsCount(){var
c=parseInt(localStorage.getItem(QUESTIONS_KEY)||"0");c++;localStorage.setItem(QUESTIONS_KEY,c);var
el=document.getElementById("questionsStat");if(el)el.innerText=c;}
function loadStats(){var
el=document.getElementById("questionsStat");if(el)el.innerText=localStorage.getItem(QUESTIONS_KEY)||"0";updateStreael=document.getElementById("questionsStat");if(el)el.innerText=localStorage.getItem(QUESTINS_KEY)||"0";updateStreak();}
var dailyTips=["Estude 30 min por dia.","Faca pausas de 5 min.","Revise o conteudo anterior.","Durma
bem!","Pratique simulados.","Anote duvidas.","Ensine para alguem.","Use flashcards.","Hidrate-se.","Celebre
vitorias!","Foque nos pontos fracos.","Respire fundo."];
function setDailyTip(){var t=new
Date().getDay(),i=t%dailyTips.length,el=document.getElementById("dailyTipText");if(el)el.innerText=dailyTips[i];}
function renderChart(){var c=document.getElementById("performanceChart");if(!c)return;if(typeof
ApexCharts==="undefined"){console.log("ApexCharts nao carregou");return;}var
ac=getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),days=["Seg","Ter","Qua","Qui","Seac=getComputedStyle(document.documentEement).getPropertyValue("--accent").trim(),days=["Seg","Ter","Qua","Qui","Sex","Sab","Dom"],dd=JSON.parse(localStorage.getItem(DAILY_DATA_KEY)||"{}"),dp=[];for(var
i=0;i<days.length;i++)dp.push(dd[days[i]]||Math.floor(Math.random()*35+60));var opt={series:[{name:"Acertos
(%)",data:dp}],chart:{type:"area",height:240,fontFamily:"Inter,
sans-serif",toolbar:{show:false},animations:{enabled:true}},colors:[ac],stroke:{curve:"smooth",width:3},fill:{type:sans-serif",toolbar:{show:false},animations:{enable:true}},colors:[ac],stroke:{curve:"smooth",width:3},fill:{type:"gradient",gradient:{shadeIntensity:1,opacityFrom:0.5,opacityTo:0.05,stops:[0,90,100]}},dataLabels:{enabled:false},xgradient",gradient:{shadeIntensity:1,opacityFrom:0.5,opacityTo:0.05,stops:[0,90,100]}},dataLabels:{enabled:false},xaxis:{categories:days,axisBorder:{show:false},axisTicks:{show:false},labels:{style:{colors:"rgba(255,255,255,0.6)",fxis:{categories:days,axisBorder:{show:false},axisTicks:{show:false},labels:{style:{colors:"rgba(255,255,255,0.6)",fontSize:"12px"}}},yaxis:{show:false,min:0,max:100},grid:{show:true,borderColor:"rgba(255,255,255,0.05)",strokeDashArntSize:"12px"}}},yaxis:{show:false,min:0,max:100},grid:{show:true,borderColor:"rgba(255,255,255,0.05)",strokeDashArray:4},tooltip:{theme:"dark",y:{formatter:function(v){return
v+"%";}}},markers:{size:5,colors:[ac],strokeColors:"#fff",strokeWidth:2}};if(chartInstance)chartInstance.updateSeriv+"%";}}},markers:{size:5,colors:[ac],strokeColors:"#ff",strokeWidth:2}};if(chartInstance)chartInstance.updateSeries([{data:dp}]);else{chartInstance=new ApexCharts(c,opt);chartInstance.render();}}
function renderCards(){var c=document.getElementById("cardsContainer");if(!c)return;c.innerHTML='<div
class="loading-state"><div
class="spinner"></div><p>Carregando...</p></div>';fetch(SCRIPT_URL+"?action=getCards").then(function(r){return
r.json();}).then(function(j){var list=(j.ok&&j.cards)?j.cards:[];if(!list.length){c.innerHTML='<div
style="text-align:center;padding:40px;">Nenhum cartao.</div>';return;}c.innerHTML="";for(var
i=0;i<Math.min(list.length,12);i++){var
q=list[i],ft=(q.pergunta||"").toString().slice(0,100),tt=(q.topico||"Geral").toString(),bt=(q.resposta||"").toStrinq=list[i],ft=(q.pergunta||"").toString().slice(0,100),tt=(q.topico||"Geral".toString(),bt=(q.resposta||"").toString().slice(0,150),w=document.createElement("div");w.className="flashcard";var
inner=document.createElement("div");inner.className="flash-inner";var
f=document.createElement("div");f.className="flash-front";f.innerHTML="<div
style=\"font-size:11px;opacity:0.7\">"+tt+"</div><div
style=\"font-weight:800;margin-top:10px\">"+ft+"...</div><div style=\"margin-top:15px;color:var(--accent)\">👆
Toque</div>";var b=document.createElement("div");b.className="flash-back";b.innerHTML="<div
style=\"font-size:11px;opacity:0.7\">"+tt+"</div><div
style=\"font-weight:600;margin-top:10px\">"+bt+"</div>";inner.appendChild(f);inner.appendChild(b);w.appendChild(innstyle=\"font-weight:600;margin-top:10px\">"+bt+"</div>";innerappendChild(f);inner.appendChild(b);w.appendChild(inner);w.onclick=function(){inner.classList.toggle("flipped");};c.appendChild(w);}}).catch(function(e){c.innerHTML='<dir);w.onclick=function(){inner.classList.toggle("flipped");};c.appendChild(w);}}).catch(function(e){c.innerHTML='<div style="text-align:center;padding:40px;">Erro</div>';});}
function initButtons(){var
up=document.getElementById("scaleUpBtn"),down=document.getElementById("scaleDownBtn");if(up)up.onclick=function(){sup=document.getElementById("scaleUpBtn"),down=document.getElementById("scaleDownBtn");ifup)up.onclick=function(){setScale(parseFloat(localStorage.getItem(SCALE_KEY)||"1.0")+0.05);};if(down)down.onclick=function(){setScale(parseFlotScale(parseFloat(localStorage.getItem(SCALE_KEY)||"1.0")+0.05);};if(down)down.onclick=function(){setScale(parseFloat(localStorage.getItem(SCALE_KEY)||"1.0")-0.05);};setScale(parseFloat(localStorage.getItem(SCALE_KEY)||"1.0"));var
sound=document.getElementById("soundToggle");if(sound){if(localStorage.getItem(SOUND_KEY)===null)localStorage.setItound=document.getElementById("soundToggle");if(sound){if(localStorage.getItem(SOUND_KEY)===null)localStorage.setItem(SOUND_KEY,"1");sound.innerText=localStorage.getItem(SOUND_KEY)==="0"?"🔇":"🔊";sound.onclick=function(){var
c=localStorage.getItem(SOUND_KEY)!=="0";localStorage.setItem(SOUND_KEY,c?"0":"1");this.innerText=c?"🔇":"🔊
";};}var fs=document.getElementById("fullscreenBtn");if(fs){fs.onclick=function(){if(!document.fullscreenElement){d";};}varfs=document.getElementById("fullscreenBtn");if(fs){fs.onclick=function(){if(!document.fullscreenElement){document.documentElement.requestFullscreen().catch(function(err){});this.innerText="🗗";}else{document.exitFullscreen(cument.documentElement.requestFullscreen().catch(function(err){});this.innerText="🗗";}else{document.exitFullscreen();this.innerText="⛶";}};}var load=document.getElementById("loadTopicBtn");if(load){load.onclick=function(){var
s=document.getElementById("topicSelect");loadTopicQuestions(s?s.value:"Todos");};}var
next=document.getElementById("nextBtn");if(next){next.onclick=function(){currentIndex++;renderQuestion();};}var
rest=document.getElementById("btnRestart");if(rest){rest.onclick=function(){restartQuiz();};}var
tabs=document.querySelectorAll(".tabbtn");for(var i=0;i<tabs.length;i++){tabs[i].onclick=function(){var
t=this.dataset.target;if(t)go(t);};}}
function
init(){console.log("Iniciando...");initButtons();showBestRecord();loadStats();setDailyTip();updateMobileQuizHeight(init(){console.log("Iniciando...");initButtons();showBestRecord();loadStats();setDailyTip();updateMobileQuzHeight();var h=doc
h=document.getElementById("home");if(h&&h.classList.contains("active"))setTimeout(renderChart,500);console.log("Proh=document.getElementById("home");if(h&&h.classList.contains("active"))setTimeout(renderChart,500);console.log"Pronto!");}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init);}else{init();}
