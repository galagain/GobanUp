'use strict';
let playTab='queue', selectedFriend='';
const playModes=[
  ['queue','En ligne','<circle class="logo-fill" cx="12" cy="12" r="8.1"/><path d="M6 8.1c3.7 2.1 8.3 2.1 12 0M5 14.4c4 1.7 9 1.7 13 0M12 4.1c-4.5 4.9-4.5 11.1 0 15.8 3.8-4 4.5-9.6 1.8-13.6"/><circle class="logo-node" cx="20.4" cy="5" r="2.2"/>'],
  ['bot','Bot','<path d="M12.5 6V3.5"/><circle class="logo-node" cx="12.5" cy="3" r="1.6"/><rect class="logo-fill" x="4" y="6.5" width="17" height="14" rx="4.4"/><path d="M2 11v4m21-4v4"/><rect x="7" y="10.2" width="11" height="5.2" rx="2.4" fill="currentColor" stroke="none"/><path d="M9.6 12.8h.6m4.6 0h.6" stroke="var(--rail)"/><path d="M10.5 17.8h4"/>'],
  ['invite','Ami','<path class="logo-fill" d="M2.5 20v-1.4a6.1 6.1 0 0 1 12.2 0V20z"/><circle class="logo-fill" cx="8.6" cy="8.4" r="3.3"/><path d="M15.6 5.2a3.2 3.2 0 1 1 .1 6.3m1.2 2.1a5.7 5.7 0 0 1 5 5.7v.7h-4"/>']
];
function playTabs(){
  return '<div class="play-tabs" role="group" aria-label="Mode de jeu">'+playModes.map(([mode,title,picture])=>
    `<button data-play-tab="${mode}" aria-pressed="${mode===playTab}"><svg aria-hidden="true" viewBox="0 0 26 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${picture}</svg>${title}</button>`).join('')+'</div>';
}
function cadenceFor(mode){
  const fallback=mode==='bot'?'none':'10+0', value=get('cadence-'+mode,fallback);
  return Cadences.valid(value)?value:fallback;
}
// The larger marks identify each family. The small clocks show each time control.
const paceArt={
  Bullet:['bullet','<path class="art-trail" d="m3 19 9-6m-7 12 9-6m-5 10 8-6"/><path fill="currentColor" d="M8 23C13 14 21 6 34 4c-1 12-9 21-19 25l2-7z"/><path class="art-cut" d="M17 23 28 12"/><circle class="art-shine" cx="26" cy="12" r="2"/>'],
  Blitz:['blitz','<path class="art-trail" d="M4 13h7M2 18h5m21 7h6"/><path fill="currentColor" d="M19 4h12L21 15h9L11 33l5-14H9z"/><path class="art-cut" d="m20 8-6 9h5"/>'],
  Rapide:['rapid','<path class="art-trail" d="M3 19h5M4 24h4"/><circle fill="currentColor" cx="21" cy="20" r="12"/><path fill="currentColor" d="M18 3h6v3h-6zM28 9l3-3 2 2-3 3z"/><circle class="art-face" cx="21" cy="20" r="8.5"/><path class="art-hand" d="M21 14v6l5 2"/><circle fill="currentColor" cx="21" cy="20" r="1.4"/>'],
  'En différé':['daily','<path class="art-trail" d="M6 11v18q0 3 3 3h17"/><rect fill="currentColor" x="9" y="6" width="23" height="23" rx="4"/><path class="art-cut" d="M10 13h21m-16-9v5m10-5v5"/><path class="art-face" d="M14 17h3v3h-3zm6 0h3v3h-3zm-6 6h3v3h-3z"/><path class="art-cut" d="m21 23 2 2 4-5"/>']
};
function paceGlyph(picture,viewBox='0 0 36 36'){
  return `<svg aria-hidden="true" focusable="false" viewBox="${viewBox}">${picture}</svg>`;
}
function timeGlyph(id){
  if(id==='none')return paceGlyph('<path d="M12 12c-2.3-3.3-3.8-4.7-6.1-4.7a4.7 4.7 0 1 0 0 9.4c4.7 0 7.5-9.4 12.2-9.4a4.7 4.7 0 0 1 0 9.4c-2.3 0-3.8-1.4-6.1-4.7Z"/>','0 0 24 24');
  if(id==='custom')return paceGlyph('<path d="M3 7h5m5 0h8M3 17h10m5 0h3"/><circle cx="10.5" cy="7" r="2.4"/><circle cx="15.5" cy="17" r="2.4"/>','0 0 24 24');
  if(id.endsWith('d')){
    return paceGlyph(`<rect x="3" y="5" width="14" height="12" rx="2"/><path d="M3 9h14M6 3v4m8-4v4"/><text x="10" y="15.3" text-anchor="middle" stroke="none" fill="currentColor" font-size="7" font-weight="750">${parseInt(id)}</text>`,'0 0 20 20');
  }
  const [minutes,increment]=id.split('+').map(Number);
  return paceGlyph(`<circle cx="9" cy="10" r="6.7"/><path d="M9 5.8V10" transform="rotate(${minutes*6} 9 10)"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/>${increment?'<path class="increment-mark" d="M15.4 12.1v5m-2.5-2.5h5"/>':''}`,'0 0 20 20');
}
function cadencePicker(mode,group=mode){
  const choice=cadenceFor(mode);
  const option=id=>{
    const label=Cadences.label(id), display=id.endsWith('d')?label.replace(' / coup',''):label;
    return `<label class="pace-option"><input type="radio" name="pace-${group}" value="${id}" aria-label="${label}" ${choice===id?'checked':''}><span>${timeGlyph(id)}<b>${display}</b></span></label>`;
  };
  const rows=Cadences.groups.map(([title,ids])=>{
    const [family,picture]=paceArt[title];
    return `<div class="pace-group pace-${family}" role="group" aria-label="${title}"><h3><span class="pace-emblem">${paceGlyph(picture)}</span><span>${title}${family==='daily'?'<small>par coup</small>':''}</span></h3><div>${ids.map(option).join('')}</div></div>`;
  }).join('');
  const custom=choice!=='none' && !Cadences.groups.some(([,ids])=>ids.includes(choice));
  return `<fieldset class="pace-picker" data-pace-mode="${mode}"><legend>Cadence <small>${Cadences.label(choice)}</small></legend>
    <div class="pace-grid">${rows}</div><div class="pace-shortcuts">${option('none')}<button type="button" class="custom-pace" aria-haspopup="dialog" aria-pressed="${custom}">${timeGlyph('custom')}Personnalisée</button></div></fieldset>`;
}
function boardSizeMark(n){
  const lines={9:2,13:3,19:4}[n];
  let grid='';
  for(let i=1;i<=lines;i++){
    const p=(3+14*i/(lines+1)).toFixed(1);
    grid+=`M${p} 3v14M3 ${p}h14`;
  }
  return paceGlyph(`<rect x="3" y="3" width="14" height="14" rx="1.3"/><path d="${grid}"/>`,'0 0 20 20');
}
function setPace(mode,id){
  save('cadence-'+mode,id);
  for(const picker of document.querySelectorAll(`.pace-picker[data-pace-mode="${mode}"]`)){
    let matched=false;
    for(const radio of picker.querySelectorAll('input[type=radio]')){
      radio.checked=radio.value===id;
      if(radio.checked)matched=true;
    }
    picker.querySelector('legend small').textContent=Cadences.label(id);
    picker.querySelector('.custom-pace').setAttribute('aria-pressed',!matched);
  }
}
function editPace(mode){
  const choice=cadenceFor(mode);
  const [minutes,increment]=(choice.includes('+')?choice:'10+0').split('+');
  const dialog=document.createElement('dialog');
  dialog.setAttribute('aria-labelledby','custom-pace-title');
  dialog.innerHTML=`<h2 id="custom-pace-title">Cadence personnalisée</h2><form>
    <label for="pace-minutes">Temps par joueur (minutes)</label><input id="pace-minutes" name="minutes" type="number" inputmode="numeric" min="1" max="${Cadences.maxMinutes}" step="1" value="${minutes}" required autofocus>
    <label for="pace-increment">Ajout par coup (secondes)</label><input id="pace-increment" name="increment" type="number" inputmode="numeric" min="0" max="${Cadences.maxIncrement}" step="1" value="${increment}" required>
    <div class="actions"><button type="button" class="btn">Annuler</button><button class="btn primary">Appliquer</button></div></form>`;
  const dismiss=()=>dialog.close();
  dialog.querySelector('[type=button]').onclick=dismiss;
  dialog.querySelector('form').onsubmit=event=>{
    event.preventDefault();
    const fields=event.currentTarget.elements;
    const id=fields.minutes.valueAsNumber+'+'+fields.increment.valueAsNumber;
    if(Cadences.valid(id)){setPace(mode,id);dismiss()}
  };
  dialog.onclose=()=>{window.removeEventListener('hashchange',dismiss);dialog.remove()};
  window.addEventListener('hashchange',dismiss);
  document.body.append(dialog);dialog.showModal();
}
document.addEventListener('click',event=>{
  const button=event.target.closest('.custom-pace');
  if(button)editPace(button.closest('.pace-picker').dataset.paceMode);
});
document.addEventListener('change',event=>{
  const input=event.target, picker=input.closest('.pace-picker');
  if(picker && input.type==='radio' && Cadences.valid(input.value))setPace(picker.dataset.paceMode,input.value);
});
function friendOptions(){
  const friends=clubState.friends.filter(f=>f.accepted);
  if(!friends.length){selectedFriend='';return ''}
  if(!friends.some(f=>f.id===selectedFriend))selectedFriend='';
  return `<label for="opponent">Adversaire</label><select id="opponent"><option value="">Inviter par lien</option>
    ${friends.map(f=>`<option value="${safe(f.id)}" ${f.id===selectedFriend?'selected':''}>${safe(f.name)}</option>`).join('')}</select>`;
}
let serverOffset=0;
function clockText(ms){
  const seconds=Math.ceil(ms/1000), mins=Math.floor(seconds/60), hours=Math.floor(mins/60);
  if(hours>=24)return Math.floor(hours/24)+' j '+(hours%24)+' h';
  if(hours)return hours+' h '+String(mins%60).padStart(2,'0');
  return mins+':'+String(seconds%60).padStart(2,'0');
}
function displayClocks(){
  const elements=document.querySelectorAll('[data-seat-clock]');
  if(!elements.length || !game?.clock || reviewing)return;
  const now=Date.now()+(game.mode==='online'?serverOffset:0);
  for(const el of elements){
    const seat=Number(el.dataset.seatClock), time=Cadences.left(game.clock,seat,now);
    el.textContent=clockText(time);
    el.classList.toggle('running',game.clock.turn===seat && !game.timedOut);
  }
  if(game.mode==='bot' && !game.timedOut && Cadences.expired(game.clock,now)){
    game.timedOut=game.clock.turn;saveGame();drawGame();
  }
}
setInterval(displayClocks,250);
