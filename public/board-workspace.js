
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
  return boardShell();
}
function gameNavigation(g,index){
  const steps=[['first','Premier coup',0],['left','Coup précédent',Math.max(0,index-1)],['right','Coup suivant',Math.min(g.moves.length,index+1)],['last','Dernier coup',g.moves.length]];
  return `<div class="review-nav"><span>${forkPosition===null?'Partie':'Variante'} · ${index} / ${g.moves.length}</span><div>${steps.map(([i,label,d])=>`<button aria-label="${label}" data-action="step:${d}" ${d===index?'disabled':''}>${icon(i,true)}</button>`).join('')}</div></div>
  <input id="slider" aria-label="Position dans la partie" type="range" min="0" max="${g.moves.length}" value="${index}">`;
}
function drawGame(){
  const analysis=reviewing||game.mode==='study', side=boardShell();
  displayedGame={id:game.id,position:forkPosition??position};displayedSetup=false;
  const {states,caps}=makeStates(game),b=states[position],color=turnAt(game,position);
  const abandoned=game.resigned && position===game.moves.length;
  const finished=twoPasses(game.moves,position)||abandoned;
  const canMove=!reviewing&&!finished&&(game.mode!=='bot'||color===1)&&(!['online','link'].includes(game.mode)||game.seat===color);
  paintBoard(b,game.n,game.moves[position-1],analysis||canMove?'point':'',color);
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
  const black=game.mode==='bot'?(account?.name||'Vous'):game.black||'Noir',white=game.mode==='bot'?'Bot · '+(game.level==='easy'?'Découverte':'Tactique'):game.white||'Blanc';
  seats(black,white,caps[position]);
  const who=color===1?'Noir':'Blanc';
  const status=finished&&!analysis?'Partie terminée':`${who} au trait`;
  const score=!analysis&&finished&&!abandoned?Go.score(b,game.n,game.komi):null;
  const info=`<div class="turnline"><i class="seat-stone ${color===2?'white':''}"></i>${status}<small>${game.n} × ${game.n}</small></div>`;
  if(analysis){
    side.innerHTML=`<div class="panel-head">${icon('analysis')}<h2>Analyse de la partie</h2></div>
      <div class="side-content">${game.title?'<p class="study-label">'+safe(game.title)+'</p>':''}${info}
      ${gameNavigation(game,position)}
      <p class="study-label">${forkPosition===null?'Jouez sur le goban pour explorer une suite.':'Variante depuis le coup '+forkPosition+'.'}</p>
      <div class="actions review-tools">${btn('Passer','pass')}${forkPosition===null?'':btn('Retour à la position initiale','original')}</div>
      <section id="local-analysis"></section><div class="actions secondary-actions">
      ${btn('Enregistrer la variante','branch','plus')}${btn('Bibliothèque','library','book')}</div></div>`;
    LocalAnalysis.mount(game,position,states);
    if($('#slider'))$('#slider').oninput=e=>{position=+e.target.value;drawGame();$('#slider').focus()};
  }else{
    const played=game.moves.slice(-6).map((m,i)=>`<span><small>${game.moves.length-Math.min(6,game.moves.length)+i+1}.</small> ${coord(m,game.n)}</span>`).join('');
    side.innerHTML=`<div class="panel-head">${icon(game.mode==='bot'?'bot':'stones')}<h2>${safe(gameTitle(game))}</h2></div><div class="side-content">
    ${info}<p class="move-number">${abandoned?resignationResult(game):finished?`Score · Noir ${numberFR(score[1])} / Blanc ${numberFR(score[2])}`:game.mode==='online'?(color===game.seat?'À vous de jouer.':'Votre adversaire réfléchit…'):position?'Coup '+position:'Posez votre première pierre.'}</p>
    ${played?`<div class="played-moves" aria-label="Derniers coups">${played}</div>`:''}
    <div class="actions">${canMove?btn('Passer','pass'):''}${game.mode==='link'&&(game.seat!==color||finished)?btn('Transmettre le lien','share','share',true):''}${btn('Analyser','review:'+game.id,'analysis')}</div>
    <div class="side-foot">${!finished?btn('Abandonner','resign'):''}${btn('Nouvelle partie','home','plus')}</div></div>`;
  }
}
const numberFR=v=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(v);

