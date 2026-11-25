'use strict';
const ReviewSummary=(()=>{
  const order=['brilliant','best','good','inaccuracy','mistake','missed','blunder'];
  const format=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1});
  const percent=new Intl.NumberFormat('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
  const left=6,right=314,top=7,bottom=119,mid=(top+bottom)/2;

  function totals(entries){
    const players=[1,2].map(()=>({counts:Object.fromEntries(order.map(k=>[k,0])),sum:0,moves:0}));
    for(const entry of entries){
      const player=players[entry.color-1];
      player.counts[entry.badge]++;
      player.sum+=100*Math.pow(0.5,Math.max(entry.loss/6,entry.drop/0.2));
      player.moves++;
    }
    return players;
  }
  function blackValue(line,color,metric){
    if(metric==='win')return (color===1?line.win:1-line.win)*100;
    return color===1?line.score:-line.score;
  }
  function scoreRange(values){
    const largest=values.reduce((m,v)=>Math.max(m,Math.abs(v)),1);
    const unit=10**Math.floor(Math.log10(largest));
    return [1,2,5,10].find(v=>v*unit>=largest)*unit;
  }
  const xAt=(ply,total)=>left+(right-left)*ply/total;
  const yAt=(value,metric,extent)=>metric==='win'?bottom-(bottom-top)*value/100:mid-(mid-top)*value/extent;
  function buildChart(entries,total,metric){
    const values=[];
    if(entries.length){
      values.push(blackValue(entries[0].best,entries[0].color,metric));
      for(const e of entries)values.push(blackValue(e.played,e.color,metric));
    }
    const extent=metric==='win'?100:scoreRange(values);
    const markers=Object.fromEntries(order.map(k=>[k,[]]));
    const points=[];
    for(const [ply,v] of values.entries()){
      const x=xAt(ply,total),y=yAt(v,metric,extent);
      points.push(x.toFixed(2)+','+y.toFixed(2));
      if(!ply)continue;
      const badge=entries[ply-1].badge;
      const r=total<55?4.1:['brilliant','blunder','missed','mistake'].includes(badge)?2.5:1.35;
      markers[badge].push(`M${(x-r).toFixed(2)} ${y.toFixed(2)}a${r} ${r} 0 1 0 ${r*2} 0a${r} ${r} 0 1 0 -${r*2} 0Z`);
    }
    const lastX=xAt(entries.length,total);
    const path=points.length?'M'+points.join(' L'):'';
    const graphic=`<rect x="0" y="0" width="320" height="126" fill="#dfddd2"/>
      ${path?`<path d="M0,${points[0].split(',')[1]} L${points.join(' L')} H${entries.length===total?320:lastX} V126 H0 Z" fill="#343632"/>`:''}
      <path d="M0 ${mid}H320" stroke="#88887e" stroke-dasharray="3 3"/>
      ${path?`<path d="${path}" fill="none" stroke="#bca985" stroke-width="1.8" vector-effect="non-scaling-stroke"/>`:''}
      ${['good','best','inaccuracy','mistake','missed','blunder','brilliant'].filter(k=>markers[k].length).map(k=>`<path class="chart-marks grade-${k}" d="${markers[k].join('')}"/>`).join('')}
      ${entries.length<total?`<rect x="${lastX}" y="0" width="${320-lastX}" height="126" fill="#262623" opacity=".68"/>`:''}`;
    return {values,extent,graphic};
  }
  function names(record){
    if(record.mode==='bot')return [account?.name||'Vous','Bot'];
    if(record.mode==='link')return record.seat===1?[account?.name||'Vous',record.opponent]:[record.opponent,account?.name||'Vous'];
    return [record.black||'Noir',record.white||'Blanc'];
  }
  function countsTable(entries,record,badges){
    const players=totals(entries),labels=names(record);
    const headers=labels.map((name,i)=>`<th scope="col"><i class="summary-stone ${i?'white':''}" aria-hidden="true"></i><span>${safe(name)}</span>${name===(i?'Blanc':'Noir')?'':`<small>${i?'Blanc':'Noir'}</small>`}</th>`).join('');
    const percentage=p=>p.moves?percent.format(p.sum/p.moves)+' %':'—';
    return `<table class="summary-counts" aria-label="Bilan par joueur"><thead><tr><th scope="col">Joueurs</th>${headers}</tr></thead><tbody>
      <tr class="summary-accuracy"><th scope="row">Précision</th>${players.map(p=>`<td><strong>${percentage(p)}</strong></td>`).join('')}</tr>
      ${order.map(k=>`<tr class="summary-grade grade-${k}"><th scope="row"><span class="summary-badge"><b aria-hidden="true">${badges[k][1]}</b>${badges[k][0]}</span></th>${players.map(p=>`<td>${p.counts[k]}</td>`).join('')}</tr>`).join('')}
      </tbody></table>`;
  }
  let metric='score',expanded=true,method=false,cached=null;
  function reset(){metric='score';expanded=true;method=false;cached=null}
  function mount({record,entries,badges,selected,jump,progress}){
    const panel=document.querySelector('#review-summary');
    if(!panel)return;
    panel.hidden=!record;
    if(!record)return;
    if(!cached||cached.count!==entries.length||cached.metric!==metric||cached.record!==record){
      cached={record,count:entries.length,metric,chart:buildChart(entries,record.moves.length,metric),table:countsTable(entries,record,badges)};
    }
    const {chart,table}=cached,total=record.moves.length;
    const isWin=metric==='win';
    const tick=isWin?['100 %','50 %','0 %']:['+'+format.format(chart.extent),'0','−'+format.format(chart.extent)];
    const waiting=entries.length===0;
    const focused=document.activeElement;
    const focusSelector=focused?.matches('.chart-hit')?'.chart-hit':focused?.matches('[data-metric]')?`[data-metric="${focused.dataset.metric}"]`:null;
    const restoreFocus=focusSelector && panel.contains(focused);
    panel.innerHTML=`<div class="summary-title"><h3>Évolution de la partie</h3><span title="Coups évalués">${entries.length<total?'Provisoire · ':''}${entries.length} / ${total}</span></div>
      <div class="summary-chart-header"><strong>${isWin?'Victoire de Noir':'Avance de Noir'}</strong><div class="chart-switch" role="group" aria-label="Mesure de la courbe">
      <button data-metric="score" aria-pressed="${!isWin}">Points</button><button data-metric="win" aria-pressed="${isWin}">Victoire</button></div></div>
      <div class="summary-chart-row"><div class="summary-y" aria-hidden="true">${tick.map(t=>'<span>'+t+'</span>').join('')}</div>
      <div class="chart-hit" role="slider" tabindex="0" aria-label="Choisir un coup sur la courbe" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${selected}">
        <svg viewBox="0 0 320 126" preserveAspectRatio="none" aria-hidden="true">${chart.graphic}
        <line class="chart-cursor" y1="0" y2="126"/><circle class="chart-dot" r="5"/></svg><span class="chart-ply" aria-hidden="true"></span>
        ${waiting?`<span class="chart-wait">${safe(progress)}</span>`:''}</div></div>
      <div class="summary-x" aria-hidden="true"><span>Départ</span><span>Coup ${total}</span></div>
      <div class="chart-readout"></div>
      <details class="summary-breakdown" ${expanded?'open':''}><summary>Précision et coups</summary>${table}
      <details class="accuracy-help" ${method?'open':''}><summary>Calcul de la précision</summary><p>La précision GobanUp est la moyenne des notes des coups évalués de chaque joueur. Un coup sans perte estimée vaut 100 %. Une perte de 6 points de go ou de 20 points de pourcentage de victoire divise la note par deux. Le calcul retient le plus grand de ces deux écarts relatifs.</p></details></details>`;
    const hit=panel.querySelector('.chart-hit'),readout=panel.querySelector('.chart-readout');
    const cursor=hit.querySelector('.chart-cursor'),dot=hit.querySelector('.chart-dot'),tag=hit.querySelector('.chart-ply');
    const describe=ply=>{
      const who=turnAt(record,Math.max(0,ply-1))===1?'Noir':'Blanc';
      const label=ply?`Coup ${ply} · ${who} ${coord(record.moves[ply-1],record.n)}`:'Position initiale';
      const value=chart.values[ply];
      let score='En attente';
      if(value!==undefined)score=isWin?format.format(value)+' % pour Noir':
        (Math.abs(value)<0.05?'Équilibre':(value>0?'Noir':'Blanc')+' +'+format.format(Math.abs(value))+' pt');
      return {label,score,value};
    };
    function inspect(ply){
      const {label,score,value}=describe(ply),entry=entries[ply-1],x=xAt(ply,total);
      cursor.setAttribute('x1',x);cursor.setAttribute('x2',x);
      tag.hidden=waiting;
      tag.textContent=ply?ply+' · '+coord(record.moves[ply-1],record.n):'Départ';
      tag.style.left=(x/320*100)+'%';
      tag.style.transform=x<70?'translateX(0)':x>250?'translateX(-100%)':'translateX(-50%)';
      tag.classList.toggle('below',value!==undefined&&yAt(value,metric,chart.extent)<mid);
      dot.setAttribute('class','chart-dot'+(entry?' grade-'+entry.badge:''));
      dot.style.display=value===undefined?'none':'';
      if(value!==undefined){dot.setAttribute('cx',x);dot.setAttribute('cy',yAt(value,metric,chart.extent))}
      readout.innerHTML=`<span><b>${label}</b><small>${entry?badges[entry.badge][0]:ply?'Coup à évaluer':'Avant le premier coup'}</small></span><strong>${score}</strong>`;
    }
    if(restoreFocus)panel.querySelector(focusSelector)?.focus({preventScroll:true});
    inspect(selected);
    const current=describe(selected);
    hit.setAttribute('aria-valuetext',current.label+', '+current.score);
    function pointerPly(event){
      const bounds=hit.getBoundingClientRect();
      const x=(event.clientX-bounds.left)*320/bounds.width;
      return Math.max(0,Math.min(total,Math.round((x-left)*total/(right-left))));
    }
    hit.onpointermove=e=>{if(e.pointerType!=='touch')inspect(pointerPly(e))};
    hit.onpointerleave=()=>inspect(selected);
    function choose(ply,focus){
      jump(ply);
      if(focus)document.querySelector('#review-summary .chart-hit')?.focus({preventScroll:true});
    }
    hit.onclick=e=>choose(pointerPly(e),true);
    hit.onkeydown=e=>{
      const dest={ArrowRight:selected+1,ArrowUp:selected+1,ArrowLeft:selected-1,ArrowDown:selected-1,Home:0,End:total}[e.key];
      if(dest===undefined)return;
      e.preventDefault();e.stopPropagation();choose(Math.max(0,Math.min(total,dest)),true);
    };
    panel.querySelector('.summary-breakdown').ontoggle=e=>{if(e.target.isConnected)expanded=e.target.open};
    panel.querySelector('.accuracy-help').ontoggle=e=>{if(e.target.isConnected)method=e.target.open};
    for(const button of panel.querySelectorAll('[data-metric]'))button.onclick=()=>{
      metric=button.dataset.metric;mount({record,entries,badges,selected,jump,progress});
      panel.querySelector(`[data-metric="${metric}"]`).focus({preventScroll:true});
    };
  }
  return {mount,reset};
})();
