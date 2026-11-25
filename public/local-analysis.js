
'use strict';
const LocalAnalysis = (() => {
  const assets = new URL('katago/', document.baseURI);
  const modelUrl = new URL('g170-b6c96.bin.gz', assets).href;
  const cache = new Map();
  const signed = new Intl.NumberFormat('fr-FR',{signDisplay:'exceptZero'});
  const colors = [null, 'black', 'white'];
  const number = new Intl.NumberFormat('fr-FR', {maximumFractionDigits:1});
  const pointNumber = new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2});
  let worker, current, running = false, enabled = false, ready = false, serial = 0;
  let result, timer, error = '';
  function cancel() {
    clearTimeout(timer);
    if (running) worker?.postMessage({type:'katago:cancel', analysisGroup:'interactive', id:serial});
    ++serial;
    running = false;
  }
  function detach() {
    cancel();
    document.querySelectorAll('.candidate-pin').forEach(node=>node.remove());
    current = null;
    enabled = false;
    result = null;
  }
  function rows(board, n) {
    if (!board) return undefined;
    return Array.from({length:n}, (_,y)=>board.slice(y*n,(y+1)*n).map(value=>colors[value]));
  }
  function repetitionKey(board, turn, n) {
    let key = (turn%2?'w|':'b|') + n + ':';
    for (let i=0; i<board.length; i+=3) {
      key += String.fromCharCode(65 + board[i]*9 + (board[i+1]??0)*3 + (board[i+2]??0));
    }
    return key;
  }
  function badWorker() {
    worker?.terminate();
    worker = null;
    ready = false;
    running = false;
    enabled = false;
    result = null;
    error = 'Le moteur local a rencontré un problème. Vous pouvez réessayer.';
    render();
  }
  function start() {
    if (!current || !enabled || current.finished || running) return;
    if (cache.get(current.key)?.complete) {
      result = cache.get(current.key);
      render();
      return;
    }
    try {
      if (!worker) {
        worker = new Worker(new URL('analysis-worker.js', assets), {name:'KataGo local'});
        worker.onerror = badWorker;
        worker.onmessageerror = badWorker;
        worker.onmessage = receive;
      }
      const {states, moves, n, first, komi, rules} = current;
      const colorAt = i => (i+first-1)%2+1;
      const payload = {
        type:'katago:analyze', id:++serial, analysisGroup:'interactive',
        modelUrl, board:rows(states.at(-1), n), previousBoard:rows(states.at(-2), n),
        previousPreviousBoard:rows(states.at(-3), n), currentPlayer:colors[colorAt(moves.length)],
        moveHistory:moves.map((p,i)=>({x:p<0?-1:p%n,y:p<0?-1:Math.floor(p/n),player:colors[colorAt(i)]})),
        repetitionHistory:states.map((board,i)=>repetitionKey(board,i+first-1,n)),
        komi, rules, backend:'webgpu', visits:180, maxTimeMs:6500,
        topK:3, analysisPvLen:10, ownershipMode:'none', wideRootNoise:0,
        reportDuringSearchEveryMs:600
      };
      running = true;
      worker.postMessage(payload);
      render();
    } catch { badWorker(); }
  }
  function receive({data}) {
    if (data.id!==serial || !current || data.canceled) return;
    if (!data.ok) { badWorker(); return; }
    const a = data.analysis;
    if (!a) return;
    ready = true;
    const {states,n,moves} = current;
    const candidates = a.moves.filter(m=>m.visits>0 && (m.x===-1 || Go.play(states.at(-1),m.y*n+m.x,(moves.length+current.first-1)%2+1,n,states))).slice(0,3);
    result = {win:a.rootWinRate, score:a.rootScoreLead, visits:a.rootVisits,
      candidates, backend:({webgpu:'WebGPU',wasm:'WebAssembly',cpu:'CPU'})[data.backend]||'local'};

    result.complete=data.type==='katago:analyze_result';
    if(result.complete)running=false;
    cache.set(current.key,result);
    if(cache.size>100)cache.delete(cache.keys().next().value);
    render();
  }
  function mount(g, index, allStates) {
    const moves = g.moves.slice(0,index);
    const first=g.first||1, komi=g.komi??6.5, rules=g.rules||'chinese';
    const keyFor = line => JSON.stringify([g.n,g.start||null,first,komi,rules,line]);
    const key=keyFor(moves);
    if (current?.key===key) {render();return;}
    cancel();
    current = {key, parentKey:index?keyFor(moves.slice(0,-1)):null, first, komi, rules, n:g.n, states:allStates.slice(0,index+1), moves,
      finished:moves.length>=2 && moves.slice(-2).every(p=>p===-1)};
    error='';result=cache.get(key)||null;
    render();
    if (enabled && !result?.complete) timer=setTimeout(start,130);
  }

  function pointFromText(text,n){
    if(/^pass$/i.test(text))return -1;
    const match=/^([A-HJ-T])([1-9]|1[0-9])$/.exec(text);
    if(!match)return null;
    const x='ABCDEFGHJKLMNOPQRST'.indexOf(match[1]),y=n-Number(match[2]);
    return x<n&&y>=0&&y<n?y*n+x:null;
  }
  function readLine(candidate){
    const {n,states,moves,first}=current;
    const firstPoint=candidate.x<0?-1:candidate.y*n+candidate.x;
    const points=candidate.pv.map(text=>pointFromText(text,n));
    if(points[0]!==firstPoint)points.unshift(firstPoint);
    const history=states.slice(),steps=[];
    for(const p of points){
      const color=(moves.length+steps.length+first-1)%2+1;
      if(p===null)break;
      const before=history.at(-1);
      const next=p===-1?{board:before,captured:0}:Go.play(before,p,color,n,history);
      if(!next)break;
      const step={p,color,...next};
      steps.push(step);history.push(next.board);
      if(p===-1&&steps.at(-2)?.p===-1)break;
    }
    return steps;
  }
  function lead(score){
    const cp=Math.round(score*100);
    return cp===0?'Égalité':`${cp>0?'Noir':'Blanc'} +${pointNumber.format(Math.abs(cp)/100)} pt`;
  }
  const letters='ABC';
  function enable(){
    if(!current)return;
    enabled=true;error='';start();render();
  }
  function control(action){
    if(action==='run')enable();
    if(action==='stop'){cancel();enabled=false;render()}
    if(action.startsWith('show:')){
      const [,i,ply]=action.split(':');
      const move=result?.candidates[Number(i)];
      if(!move)return;
      const points=readLine(move).map(step=>step.p);
      if(points.length)exploreLine(points,Math.min(Number(ply),points.length));
    }
  }
  function picture(){
    const el=$('#live-goban');if(!el)return;
    el.querySelectorAll('.candidate-pin').forEach(node=>node.remove());
    result?.candidates.forEach((move,i)=>{
      if(move.x<0)return;
      const p=move.y*current.n+move.x;
      const pin=document.createElement('span');
      pin.className='candidate-pin';pin.style.cssText=hitStyle(p,current.n);
      pin.textContent=letters[i];pin.setAttribute('aria-hidden','true');el.append(pin);
    });
  }
  function candidateRow(m,i){
    const label=m.x<0?'Passe':coord(m.y*current.n+m.x,current.n);
    const line=readLine(m);
    const cells=line.map((step,k)=>`<button data-kata="show:${i}:${k+1}" class="pv-step" aria-label="Variante ${letters[i]}, coup ${k+1}, ${coord(step.p,current.n)}">${coord(step.p,current.n)}</button>`).join('');
    let detail='';
    if(line[0]?.captured)detail=`Capture de ${line[0].captured} pierre${line[0].captured>1?'s':''}.`;
    else if(line[0]?.p>=0){
      const first=line[0], neighbors=Go.adjacent(first.p,current.n);
      const atari=neighbors.some(q=>first.board[q]===3-first.color&&Go.group(first.board,q,current.n).liberties.size===1);
      if(atari)detail=`Un groupe ${first.color===1?'blanc':'noir'} est en atari.`;
    }
    return `<article class="variation"><button class="variation-top" data-kata="show:${i}:1" aria-label="Explorer la variante ${letters[i]} en ${label}">
    <span class="letter">${letters[i]}</span><strong>${label}</strong><span class="variation-score">${lead(m.scoreLead)}</span></button>
    <div class="variation-meta"><span>Victoire de Noir · ${number.format(100*m.winRate)} %</span><span>${m.visits} visites</span></div>
    ${detail?'<p class="tactic">'+detail+'</p>':''}<div class="pv-strip">${cells}</div></article>`;
  }
  function evaluation(){
    const cp=Math.round(result.score*100);
    const previous=cache.get(current.parentKey)?.score;
    const color=turnAt(current,current.moves.length-1);
    const swing=Number.isFinite(previous)?Math.round((result.score-previous)*100*(color===1?1:-1)):null;
    const percent=Math.max(0,Math.min(100,result.win*100));
    const balance=50+Math.max(-1000,Math.min(1000,cp))/20;
    return `<div class="eval-root"><div><small>Avance estimée</small><strong>${lead(result.score)}</strong></div>
      <div><small>Évaluation pour Noir</small><strong>${signed.format(cp)} cp</strong></div></div>
      <div class="score-track" aria-hidden="true"><i style="width:${balance}%"></i></div>
      <div class="scale-labels" aria-hidden="true"><span>Blanc +10</span><span>0</span><span>Noir +10</span></div>
      <p class="eval-units">100 centipoints (cp) = 1 point de go. Un signe positif favorise Noir.</p>
      ${swing===null?'':`<p class="move-swing">Dernier coup · ${signed.format(swing)} cp pour ${color===1?'Noir':'Blanc'}</p>`}
      <div class="win-caption">Victoire de Noir <b>${number.format(percent)} %</b></div>
`;
  }
  function render(){
    const panel=$('#local-analysis');
    if(!panel||!current)return;
    picture();
    let content='';
    if(result){
      content=`${evaluation()}<h3>Lignes du moteur</h3>${result.candidates.map(candidateRow).join('')}
      <small class="engine-detail">${result.visits} visites · ${result.backend}</small>`;
    }
    const status=current.finished?'Deux passes. Jouez une pierre pour explorer une autre suite.':
      error||(running||enabled&&!result?(ready?'Calcul en cours…':'Chargement du moteur…'):result?'':'Modèle local · 3,8 Mo au premier lancement.');
    panel.innerHTML=`<div class="engine-title"><strong>KataGo</strong>${!current.finished&&enabled?'<button class="text-btn" data-kata="stop" aria-label="Désactiver le suivi de l’analyse">Désactiver</button>':''}</div>${content}
    <p class="kata-status" role="status">${status}</p>${!current.finished&&!enabled?`<button class="btn" data-kata="run">${error?'Réessayer':result?'Suivre les coups':'Analyser sur cet appareil'}</button>`:''}`;
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-kata]');
    if(button)control(button.dataset.kata);
  });
  return {mount,detach,enable};
})();
