
'use strict';
const boardMargin=6.3;
const boardSpan=100-2*boardMargin;
function hitStyle(p,n) {
  const step=boardSpan/(n-1);
  return `left:${boardMargin+p%n*step}%;top:${boardMargin+Math.floor(p/n)*step}%;width:${step}%;height:${step}%`;
}
function boardShell(section){
  let shell=document.querySelector('#board-desk');
  if(!shell){
    main.innerHTML=`<section id="board-desk"><div class="desk-title"><h1></h1></div><div class="desk-grid">
      <div class="board-column"><div class="seat" id="white-seat"></div><div class="board-wrap"><div class="board" id="live-goban" role="group"></div></div><div class="seat" id="black-seat"></div></div>
      <aside class="desk-side" id="desk-tools"></aside></div><div id="desk-extra"></div></section>`;
    shell=$('#board-desk');
  }
  shell.querySelector('h1').textContent=section;
  $('#desk-extra').replaceChildren();
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
  el.innerHTML=boardSvg(board,n,last,true)+board.map((v,p)=>{
    if(mode==='point'&&v===0)return `<button data-point="${p}" style="${hitStyle(p,n)}" aria-label="Jouer en ${coord(p,n)}"></button>`;
    if(mode==='place')return `<button data-place="${p}" style="${hitStyle(p,n)}" aria-label="${coord(p,n)} · ${['Vide','Noir','Blanc'][v]}"></button>`;
    return '';
  }).join('');
}
function emptyStage(n,section='Jouer'){
  const side=boardShell(section);
  paintBoard(Array(n*n).fill(0),n);seats('Vous','Adversaire');
  return side;
}
function gameNavigation(g,index){
  const steps=[['first','Premier coup',0],['left','Coup précédent',Math.max(0,index-1)],['right','Coup suivant',Math.min(g.moves.length,index+1)],['last','Dernier coup',g.moves.length]];
  return `<div class="review-nav"><span>Partie · ${index} / ${g.moves.length}</span><div>${steps.map(([i,label,d])=>`<button aria-label="${label}" data-action="step:${d}" ${d===index?'disabled':''}>${icon(i,true)}</button>`).join('')}</div></div>
  <input id="slider" aria-label="Position dans la partie" type="range" min="0" max="${g.moves.length}" value="${index}">`;
}
function drawGame(){
  const analysis=reviewing||game.mode==='study', side=boardShell(analysis?'Analyse':'Jouer');
  const {states,caps}=makeStates(game),b=states[position],color=turnAt(game,position);
  const finished=position>=2&&game.moves.slice(position-2,position).every(p=>p===-1);
  const canMove=!reviewing&&!finished&&(game.mode!=='bot'||color===1)&&(!['online','link'].includes(game.mode)||game.seat===color);
  paintBoard(b,game.n,game.moves[position-1],canMove?'point':'',color);
  const black=game.mode==='bot'?name:game.black||'Noir',white=game.mode==='bot'?'Bot · '+(game.level==='easy'?'Découverte':'Tactique'):game.white||'Blanc';
  seats(black,white,caps[position]);
  const who=color===1?'Noir':'Blanc';
  const status=finished?'Partie terminée':`${who} au trait`;
  const score=finished?Go.score(b,game.n,game.komi):null;
  const info=`<div class="turnline"><i class="seat-stone ${color===2?'white':''}"></i>${status}<small>${game.n} × ${game.n}</small></div>`;
  if(analysis){
    side.innerHTML=`<div class="panel-head">${icon('analysis')}<h2>Analyse de la partie</h2></div>
      <div class="side-content">${game.title?'<p class="study-label">'+safe(game.title)+'</p>':''}${info}${reviewing?gameNavigation(game,position):`<p class="move-number">Coup ${position}</p>`}
      <section id="local-analysis"></section><div class="actions secondary-actions">${reviewing?btn('Créer une variante','branch','plus'):canMove?btn('Passer','pass'):''}${btn('Bibliothèque','library','book')}</div></div>`;
    LocalAnalysis.mount(game,position,states);
    if($('#slider'))$('#slider').oninput=e=>{position=+e.target.value;drawGame();$('#slider').focus()};
  }else{
    const played=game.moves.slice(-6).map((m,i)=>`<span><small>${game.moves.length-Math.min(6,game.moves.length)+i+1}.</small> ${coord(m,game.n)}</span>`).join('');
    side.innerHTML=`<div class="panel-head">${icon(game.mode==='bot'?'bot':'stones')}<h2>${safe(gameTitle(game))}</h2></div><div class="side-content">
    ${info}<p class="move-number">${finished?`Score · Noir ${numberFR(score[1])} / Blanc ${numberFR(score[2])}`:game.mode==='online'?(color===game.seat?'À vous de jouer.':'Votre adversaire réfléchit…'):position?'Coup '+position:'Posez votre première pierre.'}</p>
    ${played?`<div class="played-moves" aria-label="Derniers coups">${played}</div>`:''}
    <div class="actions">${canMove?btn('Passer','pass'):''}${game.mode==='link'&&(game.seat!==color||finished)?btn('Transmettre le lien','share','share',true):''}${btn('Analyser','review:'+game.id,'analysis')}</div>
    <div class="side-foot">${btn('Nouvelle partie','home','plus')}</div></div>`;
  }
}
const numberFR=v=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(v);

