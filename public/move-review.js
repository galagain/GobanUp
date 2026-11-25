'use strict';
const MoveReview=(()=>{
  const badges={
    best:['Meilleur coup','★'],good:['Bon coup','✓'],inaccuracy:['Imprécision','?!'],
    mistake:['Erreur','?'],blunder:['Gaffe','??'],missed:['Occasion manquée','◇'],brilliant:['Brillant','!!']
  };
  const fmt=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1});
  let controller,record,entries=[],message='',replay=null;
  function stop(){
    ReviewSummary.reset();controller?.abort();record=null;entries=[];message='';replay=null;
    const caption=document.querySelector('#move-verdict');if(caption)caption.hidden=true;
  }
  async function begin(source){
    stop();
    if(!source.moves.length)return;
    record=source;
    controller=new AbortController();
    const {signal}=controller;
    try{
      const {reviewGame}=await import('./browser-review.js');
      signal.throwIfAborted();
      await reviewGame(source,account?.id||'guest',signal,results=>{entries=results;render()});
    }catch(err){
      if(!signal.aborted){message=err.message||'Calcul local interrompu.';render()}
    }
  }
  function badge(e){
    const [label,symbol]=badges[e.badge];
    return `<span class="move-badge grade-${e.badge}"><b aria-hidden="true">${symbol}</b> ${label}</span>`;
  }
  const moveName=e=>coord(e.played.move,record.n);
  function showVerdict(e){
    const caption=$('#move-verdict');
    if(!caption)return;
    caption.hidden=!e;
    if(!e)return;
    caption.innerHTML=`<div class="verdict-title">${badge(e)}<small>Coup ${e.ply} · ${e.color===1?'Noir':'Blanc'} ${moveName(e)}</small></div><p>${safe(e.explanation)}</p>`;
  }
  function jump(ply){
    game=reviewSource;forkPosition=null;replay=null;position=ply;drawGame();
  }
  function render(){
    const progress=message||((record&&entries.length===record.moves.length)?'Revue terminée':'Analyse sur cet appareil');
    const retry=Boolean(message);
    if(record&&reviewOverview&&$('#review-summary')){
      ReviewSummary.mount({record,entries,badges,selected:position,select:ply=>{position=ply;drawGame()},explore:ply=>switchReview(false,ply),progress:message||progress,retry});
      return;
    }
    const panel=$('#game-review');if(!panel)return;
    const e=!replay && forkPosition===null?entries[position-1]:null;
    showVerdict(e);
    const view=replay?entries[replay.ply-1]:e;
    panel.hidden=!record||(!view&&!retry);
    if(panel.hidden)return;
    const chosen=view?`<div class="review-comparison">
      <table class="review-values"><caption>Estimations pour ${view.color===1?'Noir':'Blanc'}</caption><thead><tr><th>Coup</th><th>Avance</th><th>Victoire</th></tr></thead>
      <tbody>${(view.best.move===view.played.move?[['Joué · premier choix',view.played]]:[['Joué',view.played],['Conseillé',view.best]]).map(([label,line])=>
        `<tr><th>${label} · ${coord(line.move,record.n)}</th><td>${line.score>0?'+':''}${fmt.format(line.score)} pt</td><td>${fmt.format(line.win*100)} %</td></tr>`).join('')}</tbody></table>
      <div class="actions"><button class="btn" data-grade="line" data-kind="best" data-ply="${view.ply}">Voir ${coord(view.best.move,record.n)}${view.best.move===view.played.move?' · meilleur coup':' · suite conseillée'}</button>
      ${view.best.move!==view.played.move?`<button class="btn" data-grade="line" data-kind="played" data-ply="${view.ply}">Suite du coup joué</button>`:''}
      ${replay?`<button class="btn" data-grade="jump" data-ply="${view.ply}">Revenir au coup joué</button>`:''}</div></div>`:'';
    panel.innerHTML=`${retry?`<p class="review-state" role="status">${safe(message||progress)}</p><button class="btn" data-grade="retry">Réessayer</button>`:''}${chosen}`;
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-grade]');
    if(!button||!record)return;
    const {grade,kind,ply}=button.dataset;
    if(grade==='retry'){begin(record);render();return}
    const entry=entries[Number(ply)-1];if(!entry)return;
    if(grade==='jump'){if(reviewOverview)switchReview(false,entry.ply);else jump(entry.ply);return}
    game=reviewSource;forkPosition=null;replay=null;
    if(grade==='line'){
      position=entry.ply-1;replay={ply:entry.ply};
      exploreLine(entry[kind].line,1);
    }
  });
  function manual(){replay=null}
  return {begin,stop,render,manual};
})();
