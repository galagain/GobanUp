'use strict';
const ReviewSummary=(()=>{
  const grades=['brilliant','best','good','inaccuracy','mistake','missed','blunder'];
  const format=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1});
  const percent=new Intl.NumberFormat('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
  let metric='score',observer=null,inspected=null;
  function leave(){
    observer?.disconnect();observer=null;inspected=null;
  }
  function reset(){leave();metric='score'}

  function countsTable(record,entries,badges){
    let names=[record.black||'Noir',record.white||'Blanc'];
    if(record.mode==='bot')names=[account?.name||'Vous','Bot'];
    if(record.mode==='link'){
      names[record.seat-1]=account?.name||'Vous';
      names[2-record.seat]=record.opponent||'Adversaire';
    }
    const players=names.map(()=>({counts:Object.fromEntries(grades.map(k=>[k,0])),sum:0,moves:0}));
    for(const e of entries){
      const player=players[e.color-1];
      player.counts[e.badge]++;
      player.sum+=100*Math.pow(.5,Math.max(e.loss/6,e.drop/.2));
      player.moves++;
    }
    const cards=players.map((p,i)=>{
      const accuracy=p.moves?p.sum/p.moves:null;
      return `<div class="player-stat"><div><i class="seat-stone ${i?'white':''}" aria-hidden="true"></i><strong>${safe(names[i])}</strong></div>
        <span class="player-accuracy">${accuracy===null?'—':percent.format(accuracy)+'<small> %</small>'}</span>
        <div class="accuracy-track" aria-hidden="true"><i style="width:${accuracy??0}%"></i></div></div>`;
    }).join('');
    return `<h2>Précision</h2><div class="player-stats">${cards}</div>
      <table class="summary-counts"><caption class="sr-only">Répartition des coups par joueur</caption><thead><tr><th scope="col">Qualité des coups</th><th scope="col">Noir</th><th scope="col">Blanc</th></tr></thead><tbody>
      ${grades.map(k=>`<tr class="summary-grade grade-${k}"><th scope="row"><span class="grade-key"></span>${badges[k][0]}</th>${players.map(p=>`<td class="${p.counts[k]?'':'zero'}">${p.counts[k]}</td>`).join('')}</tr>`).join('')}
      </tbody></table>`;
  }

  function momentsList(entries,badges,record){
    if(!entries.length)return '';
    const weight=e=>Math.max(e.loss,e.drop*30,e.badge==='brilliant'?6:0);
    const moments=entries.slice().sort((a,b)=>weight(b)-weight(a)||a.ply-b.ply).slice(0,3).sort((a,b)=>a.ply-b.ply);
    return `<section class="report-moments"><h2>Moments clés</h2><div class="review-moments">${moments.map(e=>
      `<button data-grade="jump" data-ply="${e.ply}" class="grade-${e.badge}"><span class="moment-ply">Coup ${e.ply}</span>
      <strong><i class="seat-stone ${e.color===2?'white':''}"></i>${coord(e.played.move,record.n)}</strong><span class="moment-grade"><i class="grade-key"></i>${badges[e.badge][0]}</span>${icon('right',true)}</button>`).join('')}</div></section>`;
  }

  function blackValue(line,color){
    if(metric==='win')return (color===1?line.win:1-line.win)*100;
    return color===1?line.score:-line.score;
  }
  function scoreRange(values){
    const largest=values.reduce((m,v)=>Math.max(m,Math.abs(v)),1);
    const unit=10**Math.floor(Math.log10(largest));
    return [1,2,2.5,5,10].find(v=>v*unit>=largest)*unit;
  }
  function mount(props){
    const {record,entries,badges,selected,explore,select,progress,retry}=props;
    const panel=$('#review-summary');
    observer?.disconnect();
    const focus=document.activeElement;
    const ref=panel.contains(focus)?focus?.dataset.focus:null;
    const total=record.moves.length,isWin=metric==='win',waiting=!entries.length;
    const values=waiting?[]:[blackValue(entries[0].best,entries[0].color),...entries.map(e=>blackValue(e.played,e.color))];
    const turns=entries.filter(e=>e.turning);
    const extent=isWin?100:scoreRange(values);
    const tick=isWin?['100 %','50 %','0 %']:['+'+format.format(extent),'0','−'+format.format(extent)];
    panel.innerHTML=`<div class="report-chart-card"><section class="report-chart">
      <header class="chart-heading"><div><h2>Évolution de la partie</h2><p>${isWin?'Chances de victoire de Noir':'Avance estimée pour Noir'}</p></div>
      <div class="chart-switch" role="group" aria-label="Mesure de la courbe">${[['score','Points'],['win','Victoire']].map(([id,label])=>`<button data-focus="${id}" data-metric="${id}" aria-pressed="${metric===id}">${label}</button>`).join('')}</div></header>
      <div class="plot-row"><div class="plot-scale" aria-hidden="true">${tick.map(t=>'<span>'+t+'</span>').join('')}</div>
      <div class="chart-hit" data-focus="chart" role="slider" tabindex="0" aria-label="Coup à explorer, appuyez sur Entrée pour l’analyser" aria-valuemin="0" aria-valuemax="${total}">
      <svg aria-hidden="true"></svg><span class="plot-label" hidden></span>${waiting?`<span class="chart-wait">${safe(progress)}</span>`:''}</div></div>
      <div class="plot-ticks" aria-hidden="true"><span>Départ</span>${total>=12?[.25,.5,.75].map(t=>'<span>'+Math.round(total*t)+'</span>').join(''):''}<span>Coup ${total}</span></div>
      <div class="chart-readout"></div>
      <div class="report-progress"><span role="status">${safe(progress)}</span><span>${entries.length} / ${total} coups</span>
      ${retry?'<button data-grade="retry" class="text-btn">Réessayer</button>':''}</div>
      </section>${momentsList(turns,badges,record)}</div>
      <section class="report-stats">${countsTable(record,entries,badges)}</section>`;
    const hit=panel.querySelector('.chart-hit'),svg=hit.querySelector('svg'),readout=panel.querySelector('.chart-readout');
    let w=0,h=0,active=inspected??selected;
    const x=ply=>8+(w-16)*ply/total;
    const y=v=>9+(h-18)*(isWin?(1-v/100):(1-v/extent)/2);
    function inspect(ply){
      active=ply;
      const entry=entries[ply-1],v=values[ply];
      const label=ply?`Coup ${ply} · ${turnAt(record,ply-1)===1?'Noir':'Blanc'} ${coord(record.moves[ply-1],record.n)}`:'Position initiale';
      const value=v===undefined?'En attente':isWin?format.format(v)+' % pour Noir':Math.abs(v)<.05?'Équilibre':(v>0?'Noir':'Blanc')+' +'+format.format(Math.abs(v))+' pt';
      const tag=hit.querySelector('.plot-label');
      tag.textContent=ply?ply+' · '+coord(record.moves[ply-1],record.n):'Départ';
      tag.style.left=x(ply)+'px';
      tag.style.transform=ply/total<.2?'none':ply/total>.8?'translateX(-100%)':'translateX(-50%)';
      const marker=svg.querySelector('.plot-current');
      if(marker){
        marker.setAttribute('transform',`translate(${x(ply)} 0)`);
        const dot=marker.querySelector('circle');dot.style.display=v===undefined?'none':'';
        if(v!==undefined)dot.setAttribute('cy',y(v));
      }
      readout.innerHTML=`<div><strong>${label}</strong>${entry?.turning?'<small>'+badges[entry.badge][0]+'</small>':''}</div><b>${value}</b>`;
      hit.setAttribute('aria-valuenow',ply);hit.setAttribute('aria-valuetext',label+', '+value);
    }
    function draw(){
      if(!hit.isConnected)return;
      w=hit.clientWidth;h=hit.clientHeight;
      if(!w||!h)return;
      const points=values.map((v,i)=>x(i).toFixed(2)+' '+y(v).toFixed(2));
      const line='M'+points.join(' L');
      const markers=turns.map(e=>`<circle class="plot-move grade-${e.badge}" cx="${x(e.ply)}" cy="${y(values[e.ply])}" r="3.8"/>`);
      svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
      svg.innerHTML=`<defs><linearGradient id="plot-wash" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#9ad4b2" stop-opacity=".29"/><stop offset="1" stop-color="#9ad4b2" stop-opacity=".015"/></linearGradient></defs>
        ${[0,.25,.5,.75,1].map(t=>`<path class="plot-grid ${t===.5?'equator':''}" d="M0 ${9+(h-18)*t}H${w}"/>`).join('')}
        ${points.length?`<path fill="url(#plot-wash)" d="${line}V${h}H8Z"/><path class="plot-line" d="${line}"/>${markers.join('')}`:''}
        <g class="plot-current"><path d="M0 2V${h-2}"/><circle r="4.6"/></g>`;
      inspect(active);
    }
    draw();observer=new ResizeObserver(draw);observer.observe(hit);
    const pointerPly=e=>Math.max(0,Math.min(total,Math.round((e.clientX-hit.getBoundingClientRect().left-8)*total/(w-16))));
    hit.onpointermove=e=>{if(e.pointerType!=='touch'){hit.querySelector('.plot-label').hidden=false;inspect(pointerPly(e))}};
    hit.onpointerleave=()=>{hit.querySelector('.plot-label').hidden=true;inspect(inspected??selected)};
    hit.onclick=e=>explore(pointerPly(e));
    hit.onkeydown=e=>{
      if(e.key==='Enter'||e.key===' '){e.preventDefault();explore(active);return}
      const dest={ArrowRight:active+1,ArrowUp:active+1,ArrowLeft:active-1,ArrowDown:active-1,Home:0,End:total}[e.key];
      if(dest!==undefined){e.preventDefault();inspected=Math.max(0,Math.min(total,dest));select(inspected);inspect(inspected)}
    };
    for(const button of panel.querySelectorAll('[data-metric]'))button.onclick=()=>{metric=button.dataset.metric;mount(props)};
    if(ref)panel.querySelector(`[data-focus="${ref}"]`)?.focus({preventScroll:true});
  }
  return {mount,reset,leave};
})();
