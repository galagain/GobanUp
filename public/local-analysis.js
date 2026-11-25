
'use strict';
const LocalAnalysis = (() => {
  const assets = new URL('katago/', document.baseURI);
  const modelUrl = new URL('g170-b6c96.bin.gz', assets).href;
  const cache = new Map();
  const colors = [null, 'black', 'white'];
  const number = new Intl.NumberFormat('fr-FR', {maximumFractionDigits:1});
  let worker, current, running = false, enabled = false, ready = false, serial = 0;
  let result, selected = 0, timer, error = '';
  function cancel() {
    clearTimeout(timer);
    if (running) worker?.postMessage({type:'katago:cancel', analysisGroup:'interactive', id:serial});
    ++serial;
    running = false;
  }
  function detach() {
    cancel();
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
    if (!current || !enabled || current.finished) return;
    if (cache.has(current.key)) {
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
        komi, rules, backend:'webgpu', visits:64, maxTimeMs:4500,
        topK:3, analysisPvLen:7, ownershipMode:'none', wideRootNoise:0,
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
    if (selected>=candidates.length) selected=0;
    if (data.type==='katago:analyze_result') {
      running = false;
      cache.set(current.key,result);
      if(cache.size>100) cache.delete(cache.keys().next().value);
    }
    render();
  }
  function mount(g, index, allStates) {
    const moves = g.moves.slice(0,index);
    const first=g.first||1, komi=g.komi??6.5, rules=g.rules||'chinese';
    const key = JSON.stringify([g.n,g.start||null,first,komi,rules,moves]);
    if (current?.key===key) {render();return;}
    cancel();
    current = {key, first, komi, rules, n:g.n, states:allStates.slice(0,index+1), moves,
      finished:moves.length>=2 && moves.slice(-2).every(p=>p===-1)};
    selected=0;error='';result=cache.get(key)||null;
    render();
    if (enabled && !result) timer=setTimeout(start,130);
  }
  function control(action) {
    if (action==='run') {
      enabled=true;error='';start();
    } else if (action==='stop') {
      cancel();enabled=false;render();
    } else if (action.startsWith('pick-')) {
      selected=Number(action.slice(5));render();
    }
  }
  function render() {
    const panel = document.querySelector('#local-analysis');
    document.querySelector('.kata-pin')?.remove();
    if (!panel || !current) return;
    let content='';
    if(result) {
      const {score,win,visits,candidates,backend}=result;
      const advance=Math.abs(score)<0.05?'Équilibre':(score>0?'Noir':'Blanc')+' +'+number.format(Math.abs(score));
      const move=candidates[selected];
      content=`<div class="kata-metrics"><div><small>Avance estimée</small><strong>${advance}</strong></div><div><small>Victoire de Noir</small><strong>${number.format(win*100)} %</strong></div></div>`;
      if (move) {
        const label=m=>m.x<0?'Passe':coord(m.y*current.n+m.x,current.n);
        content+=`<small>Coups proposés</small><div class="kata-moves">${candidates.map((m,i)=>`<button class="btn" data-kata="pick-${i}" aria-pressed="${i===selected}">${label(m)}</button>`).join('')}</div>`;
        if (move.pv.length) content+=`<div class="kata-pv">Suite · ${move.pv.map(p=>p==='pass'?'Passe':safe(p)).join(' · ')}</div>`;
        if (move.x>=0) {
          const pin=document.createElement('span');
          pin.className='kata-pin';pin.ariaHidden='true';
          pin.style.left=(12+76*move.x/(current.n-1))+'%';
          pin.style.top=(12+76*move.y/(current.n-1))+'%';
          pin.style.width=pin.style.height=67/(current.n-1)+'%';
          document.querySelector('.board')?.append(pin);
        }
      }
      content+=`<small>${visits} visites · ${backend}</small>`;
    }
    const finished=current.finished;
    const pending=enabled&&!result&&!error;
    const status=finished?'Partie terminée. Revenez à un coup précédent pour l’analyser.':
      error || (running||pending?(ready?'Recherche sur cet appareil…':'Chargement du moteur local…'):
      result?'':'Le modèle est téléchargé au premier lancement (3,8 Mo).');
    panel.innerHTML=`<div class="line"></div><h2>Analyse KataGo</h2>${content}<p class="kata-status" role="status">${status}</p>`+
      (finished?'':enabled?'<button class="text-btn" data-kata="stop">Désactiver l’analyse</button>':
      `<button class="btn" data-kata="run">${error?'Réessayer':result?'Activer le suivi des coups':'Analyser sur cet appareil'}</button>`);
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-kata]');
    if (button) control(button.dataset.kata);
  });
  return {mount,detach};
})();

