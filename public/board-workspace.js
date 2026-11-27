
'use strict';
const boardMargin=6.3;
const boardSpan=100-2*boardMargin;
function hitStyle(p,n) {
  const step=boardSpan/(n-1);
  return `left:${boardMargin+p%n*step}%;top:${boardMargin+Math.floor(p/n)*step}%;width:${step}%;height:${step}%`;
}
let displayedGame = null;
let displayedSetup = false;
function boardShell(){
  if(!$('#board-desk')){
    main.innerHTML=`<section id="board-desk"><div class="desk-grid">
      <div class="board-column"><div class="seat" id="white-seat"></div><div class="board-wrap"><div class="board" id="live-goban" role="group"></div></div><div class="seat" id="black-seat"></div></div>
      <aside class="desk-side" id="desk-tools"></aside></div></section>`;
  }
  return $('#desk-tools');
}
function seats(black='Noir',white='Blanc',caps=null) {
  for(const [id,label,color,count] of [['black-seat',black,1,caps?.[0]],['white-seat',white,2,caps?.[1]]]){
    const row=document.getElementById(id);
    row.innerHTML=`<i class="seat-stone ${color===2?'white':''}" aria-hidden="true"></i><strong>${safe(label)}</strong>
      ${Number.isInteger(count)?`<small>${count} capture${count>1?'s':''}</small>`:`<small>Pierres ${color===2?'blanches':'noires'}</small>`}`;
  }
}
function paintBoard(board,n,last=-1,mode='',color=1){
  const el=$('#live-goban');
  el.setAttribute('aria-label',`Goban ${n} × ${n}`);
  el.dataset.turn=color;
  el.style.setProperty('--intersections',n);
  // Keep the grid and stones mounted when only the available controls change.
  const signature = n + ':' + last + ':' + board.join('');
  if (el.dataset.position !== signature) {
    el.innerHTML = boardSvg(board,n,last,true);
    el.dataset.position = signature;
  } else {
    el.querySelectorAll('button,.sequence-number').forEach(node => node.remove());
  }
  delete el.dataset.preview;
  el.insertAdjacentHTML('beforeend', board.map((v,p)=>{
    if(mode==='point'&&v===0)return `<button data-point="${p}" style="${hitStyle(p,n)}" aria-label="Jouer en ${coord(p,n)}"></button>`;
    if(mode==='place')return `<button data-place="${p}" style="${hitStyle(p,n)}" aria-label="${coord(p,n)} · ${['Vide','Noir','Blanc'][v]}"></button>`;
    return '';
  }).join(''));
}
function emptyStage(n){
  displayedGame=null;displayedSetup=false;
  const side=boardShell();
  paintBoard(Array(n*n).fill(0),n);seats('Vous','Adversaire');
  return side;
}
function panelForCurrentBoard(){
  if (!$('#live-goban')) return emptyStage(boardSize);
  const board = $('#live-goban');
  board.querySelectorAll('button,.sequence-number').forEach(node => node.remove());
  document.querySelectorAll('[data-seat-clock]').forEach(el=>el.remove());
  return boardShell();
}
function gameNavigation(g,index){
  const steps=[['first','Premier coup',0],['left','Coup précédent',Math.max(0,index-1)],['right','Coup suivant',Math.min(g.moves.length,index+1)],['last','Dernier coup',g.moves.length]];
  return `<div class="review-nav" role="group" aria-label="Navigation entre les coups">${steps.map(([i,label,d])=>`<button aria-label="${label}" data-action="step:${d}" ${d===index?'disabled':''}>${icon(i,true)}</button>`).join('')}</div>`;
}
function reviewHeading(overview){
  const recorded=Boolean(reviewSource?.moves.length);
  return `<header class="review-mast ${overview?'report-heading':'analysis-head'}">
    <div><a class="review-back" href="${recorded?'#bibliotheque':'#analyse'}">${icon('left',true)} ${recorded?'Bibliothèque':'Analyse'}</a>
    <h1 tabindex="-1">${overview?'Bilan de partie':recorded?'Analyse des lignes':'Analyse libre'}</h1></div>
    ${recorded?btn(overview?'Voir les lignes':'Bilan',overview?'explore-review':'review-overview',overview?'analysis':'book'):`<span class="board-size">${game.n} × ${game.n}</span>`}</header>`;
}
function drawGame(){
  const analysis=reviewing||game.mode==='study', side=boardShell();
  displayedGame={id:game.id,position:forkPosition??position};displayedSetup=false;
  const {states,caps}=makeStates(game),b=states[position],color=turnAt(game,position);
  if(!analysis && game.mode==='bot' && !game.timedOut && Cadences.expired(game.clock,Date.now())){game.timedOut=game.clock.turn;saveGame()}
  const abandoned=(game.resigned || game.timedOut) && position===game.moves.length;
  const finished=twoPasses(game.moves,position)||abandoned;
  const canMove=!reviewing&&!finished&&(game.mode!=='bot'||color===1)&&(!['online','link'].includes(game.mode)||game.seat===color);
  paintBoard(b,game.n,game.moves[position-1],!reviewOverview&&(analysis||canMove)?'point':'',color);
  if(analysis && forkPosition!==null){
    const numbered=new Map();
    for(let i=forkPosition;i<position;i++){
      for(const p of numbered.keys())if(!states[i+1][p])numbered.delete(p);
      if(game.moves[i]>=0)numbered.set(game.moves[i],i-forkPosition+1);
    }
    for(const [p,label] of numbered){
      const mark=document.createElement('span');
      mark.className='sequence-number '+(b[p]===1?'on-black':'on-white');
      mark.style.cssText=hitStyle(p,game.n);mark.textContent=label;
      mark.setAttribute('aria-hidden','true');$('#live-goban').append(mark);
    }
  }
  const black=game.mode==='bot'?(account?.name||'Vous'):game.black||'Noir',white=game.mode==='bot'?BotPlayers.name(game.level):game.white||'Blanc';
  seats(black,white,caps[position]);
  if(!analysis && game.clock){
    for(const [seat,id] of [[1,'black-seat'],[2,'white-seat']]){
      document.getElementById(id).insertAdjacentHTML('beforeend',`<b class="seat-clock" role="timer" aria-label="Temps de ${seat===1?'Noir':'Blanc'}" data-seat-clock="${seat}"></b>`);
    }
    displayClocks();
  }
  if(reviewing && reviewOverview){
    if(main.querySelector('.review-report')?.dataset.record!==game.id){
      side.innerHTML=`<section class="review-report"><div class="report-scroll">${reviewHeading(true)}
        <section id="review-summary" aria-label="Courbe de la partie"></section>
        <section class="report-stats"><h2>${safe(gameTitle(game))}</h2><div id="review-stats"></div></section></div></section>`;
      main.querySelector('.review-report').dataset.record=game.id;
    }
    MoveReview.render();
    return;
  }
  const who=color===1?'Noir':'Blanc';
  const status=finished&&!analysis?'Partie terminée':`${who} au trait`;
  const score=!analysis&&finished&&!abandoned?Go.score(b,game.n,game.komi):null;
  const info=`<div class="turnline"><i class="seat-stone ${color===2?'white':''}"></i>${status}<small>${game.n} × ${game.n}</small></div>`;
  if(analysis){
    const scroll=side.querySelector('.analysis-body')?.scrollTop||0;
    side.innerHTML=`<div class="analysis-panel">
      <div class="analysis-body">${reviewHeading(false)}
      ${reviewSource?.moves.length?'<section id="review-summary" aria-label="Courbe de la partie"></section>':''}
      <div class="analysis-toolbar"><div id="position-estimate"></div>${gameNavigation(game,position)}</div>
      <div id="move-verdict" hidden></div><section id="local-analysis"></section>
      <section id="game-review"></section></div><footer class="analysis-foot">
      <div class="actions">${btn('Passer','pass')}${forkPosition===null?'':btn('Revenir au coup '+forkPosition,'original','left')}
      ${btn('Enregistrer la variante','branch','plus')}</div></footer></div>`;
    MoveReview.render();
    LocalAnalysis.mount(game,position,states);
    side.querySelector('.analysis-body').scrollTop=scroll;
  }else{
    const engineTurn=game.mode==='bot' && BotPlayers.external(game.level) && !finished && color===2;
    const played=game.moves.slice(-6).map((m,i)=>`<span><small>${game.moves.length-Math.min(6,game.moves.length)+i+1}.</small> ${coord(m,game.n)}</span>`).join('');
    side.innerHTML=`<div class="panel-head">${game.mode==='bot'?BotPlayers.portrait(game.level):icon('stones')}<h2>${safe(gameTitle(game))}</h2></div><div class="side-content">
    ${info}${game.cadence?'<p class="room-settings">'+Cadences.label(game.cadence)+'</p>':''}<p class="move-number" role="status">${engineTurn?(BotPlayers.failed?'Le moteur local est indisponible.':BotPlayers.name(game.level)+' réfléchit…'):abandoned?finishResult(game):finished?`Score · Noir ${numberFR(score[1])} / Blanc ${numberFR(score[2])}`:game.mode==='online'?(color===game.seat?'À vous de jouer.':'Votre adversaire réfléchit…'):position?'Coup '+position:'Posez votre première pierre.'}</p>
    ${played?`<div class="played-moves" aria-label="Derniers coups">${played}</div>`:''}
    <div class="actions">${engineTurn && BotPlayers.failed?btn('Réessayer','retry-bot'): ''}${canMove?btn('Passer','pass'):''}${game.mode==='link'&&(game.seat!==color||finished)?btn('Transmettre le lien','share','share',true):''}${btn(game.moves.length?'Revoir ma partie':'Analyser','review:'+game.id,'analysis')}</div>
    <div class="side-foot">${!finished?btn('Abandonner','resign'):''}${btn('Nouvelle partie','home','plus')}</div></div>`;
    MoveReview.prepare(game,states,engineTurn);
    if(engineTurn)BotPlayers.run(game);
    else if(finished)BotPlayers.stop();
  }
}
const numberFR=v=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(v);

