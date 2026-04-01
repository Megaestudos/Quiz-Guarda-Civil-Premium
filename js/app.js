function doGet(e) {
  var js = `
var SCRIPT_URL="https://script.google.com/macros/s/AKfycbx64clSmoa7ymBZls8osmpp6PuwCyqHJ0bcOBz9NI0PqBM_tHr8Px_lGdQESCRIPT_URL="https://script.google.com/macros/s/AKfycbx64clSmoa7ymBZls8osmpp6PuwCyqHJ0bcOBz9NI0PqBM_tHr8Px_lGdQEr_9INdMB3g/exec";
var POOL=[],currentIndex=0,score=0,quizStarted=false;
var SOUND_KEY="quiz_sound_on",SCALE_KEY="quiz_card_scale",BEST_KEY="quiz_best_record";
var STREAK_KEY="quiz_streak",QUESTIONS_KEY="quiz_total_questions";
var LAST_VISIT_KEY="quiz_last_visit",DAILY_DATA_KEY="quiz_daily_data";
var audioCtx=null,chartInstance=null;

function go(target){
  console.log("Indo para:",target);
  var pages=document.querySelectorAll(".page");
  for(var i=0;i<pages.length;i++)pages[i].classList.remove("active");
  var t=document.getElementById(target);
  if(t)t.classList.add("active");
  var tabs=document.querySelectorAll(".tabbtn");
  for(var i=0;i<tabs.length;i++)tabs[i].classList.toggle("active",tabs[i].dataset.target===target);
  if(target==="home"){showBestRecord();loadStats();setTimeout(renderChart,400);}
  if(target==="study")renderStudies();
  if(target==="cards")renderCards();
  if(target==="quiz"&&!quizStarted)showTopicSelection();
}
window.go=go;

function setScale(v){
  v=Math.max(0.8,Math.min(1.4,Number(v)));
  var r=document.getElementById("appRoot");
  var l=document.getElementById("scaleLabel");
  if(r)r.style.transform="scale("+v.toFixed(2)+")";
  if(l)l.innerText="x"+v.toFixed(2);
  localStorage.setItem(SCALE_KEY,v.toFixed(2));
}

function showBestRecord(){
  var r=JSON.parse(localStorage.getItem(BEST_KEY));
  var el=document.getElementById("bestScoreStat");
  if(!el)return;
  if(r){el.innerText=r.pct+"%";}else{el.innerText="--";}
}

function loadStats(){
  var el=document.getElementById("questionsStat");
  if(el)el.innerText=localStorage.getItem(QUESTIONS_KEY)||"0";
  var st=document.getElementById("streakStat");
  if(st)st.innerText=localStorage.getItem(STREAK_KEY)||"0";
}

function showTopicSelection(){
  var s=document.getElementById("topicSelect");
  if(!s)return;
  s.innerHTML='<option value="Todos">Todos</option><option value="Demo">Modo Demo</option>';
}

function generateDemoQuestions(){
  return[
    {pergunta:"Qual lei regula o Estatuto da Guarda Civil?",materia:"Legislacao",A:"Lei 13.022/2014",B:"Lei
8.112/1990",C:"Lei 10.406/2002",D:"Lei 9.784/1999",resposta:"A",explicacao:"Lei 13.022/2014."},
    {pergunta:"Qual principio exige publicidade?",materia:"Dir.
Administrativo",A:"Legalidade",B:"Publicidade",C:"Impessoalidade",D:"Moralidade",resposta:"B",explicacao:"PrincipioAdministrativo",A:"Legalidade",B:"Publicidade",C:"Ipessoalidade",D:"Moralidade",resposta:"B",explicacao:"Principio da Publicidade."},
    {pergunta:"O que significa ECA?",materia:"Legislacao Especial",A:"Estatuto do Cidadao",B:"Estatuto da Crianca
e do Adolescente",C:"Estatuto de Capacitacao",D:"Estatuto de Conduta",resposta:"B",explicacao:"ECA = Lei
8.069/1990."}
  ];
}

function loadTopicQuestions(topic){
  var q=document.getElementById("question");
  if(q)q.innerText="Carregando...";
  POOL=generateDemoQuestions();
  currentIndex=0;
  score=0;
  quizStarted=true;
  renderQuestion();
}

function renderQuestion(){
  var q=document.getElementById("question");
  var o=document.getElementById("opts");
  var e=document.getElementById("explain");
  var n=document.getElementById("nextBtn");
  if(e)e.style.display="none";
  if(n)n.disabled=true;
  if(currentIndex>=POOL.length){finishQuiz();return;}
  var qq=POOL[currentIndex];
  if(q)q.innerText=qq.pergunta||"";
  if(o)o.innerHTML="";
  var letters=["A","B","C","D"];
  for(var i=0;i<letters.length;i++){
    var l=letters[i];
    var t=qq[l]||"";
    if(!t)continue;
    var btn=document.createElement("button");
    btn.className="opt";
    btn.id="opt_"+l;
    btn.innerHTML="<span style=\\"color:var(--accent);margin-right:10px;font-weight:900\\">"+l+")</span> "+t;
    btn.onclick=function(x){return function(){selectOption(x);};}(l);
    if(o)o.appendChild(btn);
  }
  updateProgressUI();
}

function selectOption(letter){
  var q=POOL[currentIndex];
  var c=q.resposta||"A";
  var opts=document.querySelectorAll(".opt");
  for(var i=0;i<opts.length;i++)opts[i].disabled=true;
  var elC=document.getElementById("opt_"+c);
  if(elC)elC.classList.add("correct");
  if(letter!==c){
    var elW=document.getElementById("opt_"+letter);
    if(elW)elW.classList.add("wrong");
  }else{score++;}
  var ex=document.getElementById("explain");
  if(ex){
    ex.style.display="block";
    ex.innerHTML="<strong
style=\\"color:var(--accent)\\">"+(letter===c?"Correto!":"Errado!")+"</strong><br>"+(q.explicacao||"");
  }
  var n=document.getElementById("nextBtn");
  if(n)n.disabled=false;
}

function updateProgressUI(){
  var b=document.getElementById("bar");
  var i=document.getElementById("progressInfo");
  var t=document.getElementById("progressText");
  var p=POOL.length?Math.round((currentIndex/POOL.length)*100):0;
  if(b)b.style.width=p+"%";
  if(i)i.innerText=POOL.length?(currentIndex+1)+" / "+POOL.length:"0 / 0";
  if(t)t.innerText="Pontos: "+score;
}

function finishQuiz(){
  quizStarted=false;
  var q=document.getElementById("question");
  var o=document.getElementById("opts");
  var r=document.getElementById("btnRestart");
  if(q)q.innerHTML="Fim! Acertou "+score+" de "+POOL.length;
  if(o)o.innerHTML="";
  if(r)r.style.display="block";
}

function restartQuiz(){
  var r=document.getElementById("btnRestart");
  var q=document.getElementById("question");
  var o=document.getElementById("opts");
  var e=document.getElementById("explain");
  var b=document.getElementById("bar");
  var i=document.getElementById("progressInfo");
  if(r)r.style.display="none";
  quizStarted=false;
  showTopicSelection();
  if(q)q.innerText="Selecione um topico.";
  if(o)o.innerHTML="";
  if(e)e.style.display="none";
  if(b)b.style.width="0%";
  if(i)i.innerText="0 / 0";
}

function renderChart(){
  var c=document.getElementById("performanceChart");
  if(!c)return;
  if(typeof ApexCharts==="undefined"){
    c.innerHTML='<div style="padding:20px;text-align:center">Carregando grafico...</div>';
    setTimeout(renderChart,1000);
    return;
  }
  var days=["Seg","Ter","Qua","Qui","Sex","Sab","Dom"];
  var dp=[];
  for(var i=0;i<7;i++)dp.push(Math.floor(Math.random()*35+60));
  var opt={
    series:[{name:"Acertos (%)",data:dp}],
    chart:{type:"area",height:240,toolbar:{show:false}},
    colors:["#00ff9d"],
    stroke:{curve:"smooth",width:3},
    fill:{type:"gradient",gradient:{opacityFrom:0.5,opacityTo:0.05}},
    xaxis:{categories:days,labels:{style:{colors:"rgba(255,255,255,0.6)"}}},
    yaxis:{show:false},
    tooltip:{theme:"dark"}
  };
  if(chartInstance)chartInstance.updateSeries([{data:dp}]);
  else{chartInstance=new ApexCharts(c,opt);chartInstance.render();}
}

function renderStudies(){
  var c=document.getElementById("studyList");
  if(!c)return;
  c.innerHTML='<div style="padding:30px;text-align:center">Conteudos em breve!</div>';
}

function renderCards(){
  var c=document.getElementById("cardsContainer");
  if(!c)return;
  c.innerHTML='<div style="padding:30px;text-align:center">Flashcards em breve!</div>';
}

function initButtons(){
  var up=document.getElementById("scaleUpBtn");
  var down=document.getElementById("scaleDownBtn");
  if(up)up.onclick=function(){setScale(parseFloat(localStorage.getItem(SCALE_KEY)||"1.0")+0.05);};
  if(down)down.onclick=function(){setScale(parseFloat(localStorage.getItem(SCALE_KEY)||"1.0")-0.05);};
  setScale(parseFloat(localStorage.getItem(SCALE_KEY)||"1.0"));

  var sound=document.getElementById("soundToggle");
  if(sound){
    sound.onclick=function(){
      var c=localStorage.getItem(SOUND_KEY)!=="0";
      localStorage.setItem(SOUND_KEY,c?"0":"1");
      this.innerText=c?"🔇":"";
    };
  }

  var fs=document.getElementById("fullscreenBtn");
  if(fs){
    fs.onclick=function(){
      if(!document.fullscreenElement){
        document.documentElement.requestFullscreen();
        this.innerText="🗗";
      }else{
        document.exitFullscreen();
        this.innerText="⛶";
      }
    };
  }

  var load=document.getElementById("loadTopicBtn");
  if(load){
    load.onclick=function(){
      var s=document.getElementById("topicSelect");
      loadTopicQuestions(s?s.value:"Todos");
    };
  }

  var next=document.getElementById("nextBtn");
  if(next){
    next.onclick=function(){currentIndex++;renderQuestion();};
  }

  var rest=document.getElementById("btnRestart");
  if(rest){
    rest.onclick=function(){restartQuiz();};
  }

  var tabs=document.querySelectorAll(".tabbtn");
  for(var i=0;i<tabs.length;i++){
    tabs[i].onclick=function(){
      var t=this.dataset.target;
      if(t)go(t);
    };
  }
}

function init(){
  console.log("App iniciando...");
  initButtons();
  showBestRecord();
  loadStats();
  updateMobileQuizHeight();
  var h=document.getElementById("home");
  if(h&&h.classList.contains("active"))setTimeout(renderChart,500);
  console.log("App pronto!");
}

function updateMobileQuizHeight(){
  if(!window.matchMedia||!window.matchMedia("(max-width: 600px)").matches)return;
  var h=document.getElementById("cardHeader");
  var t=document.getElementById("tabsBar");
  var hv=h&&getComputedStyle(h).display!=="none";
  var hh=hv?Math.ceil(h.getBoundingClientRect().height):0;
  var th=t?Math.ceil(t.getBoundingClientRect().height+20):86;
  document.documentElement.style.setProperty("--header-h",hh+"px");
  document.documentElement.style.setProperty("--tabs-h",th+"px");
  document.documentElement.style.setProperty("--quiz-h",Math.max(360,window.innerHeight-hh-th-26)+"px");
}

if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init);}else{init();}
  `;

  return ContentService.createTextOutput(js)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
