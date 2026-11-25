'use strict';
const Cadences = (() => {
  const groups = [
    ['Bullet', ['1+0','1+1','2+1']],
    ['Blitz', ['3+0','3+2','5+0']],
    ['Rapide', ['10+0','10+5','15+10']],
    ['En différé', ['1d','3d','7d']]
  ];
  const valid = id => id==='none' || groups.some(([,ids])=>ids.includes(id));
  const daily = id => id.endsWith('d');
  function label(id){
    if(!id || id==='none')return 'Sans pendule';
    if(daily(id))return parseInt(id)+' jour'+(id==='1d'?'':'s')+' / coup';
    const [minutes,increment]=id.split('+');
    return increment==='0'?minutes+' min':minutes+' + '+increment;
  }
  function initial(id,now){
    if(id==='none')return null;
    const ms=parseInt(id)*(daily(id)?86400000:60000);
    return {remaining:[ms,ms],turn:1,since:now};
  }
  function left(clock,seat,now){
    return Math.max(0,clock.remaining[seat-1]-(clock.turn===seat?Math.max(0,now-clock.since):0));
  }
  function expired(clock,now){
    return clock?.turn && left(clock,clock.turn,now)===0?clock.turn:null;
  }
  function advance(id,clock,now,stop=false){
    if(!clock || !clock.turn)return clock;
    const seat=clock.turn, remaining=clock.remaining.slice();
    remaining[seat-1]=left(clock,seat,now);
    if(!stop){
      if(daily(id))remaining[seat-1]=parseInt(id)*86400000;
      else remaining[seat-1]+=Number(id.split('+')[1])*1000;
    }
    return {remaining,turn:stop?0:3-seat,since:now};
  }
  return {groups,valid,label,initial,left,expired,advance};
})();
