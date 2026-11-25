'use strict';
let playTab='queue', selectedFriend='';
const playModes=[
  ['queue','En ligne','<circle cx="16" cy="16" r="12" fill="#ad916b"/><circle cx="16" cy="16" r="11" fill="none" stroke="#f0d6aa" stroke-width="1.8"/><path d="M5 16h22M7 10h18M7 22h18M16 5c-8 6-8 16 0 22 8-6 8-16 0-22Z" stroke="#534534" stroke-width="1.5" fill="none"/>'],
  ['bot','Bot','<path d="M16 5v5" stroke="#ceb38c" stroke-width="2"/><circle cx="16" cy="4" r="2.2" fill="#ead1aa"/><rect x="2" y="16" width="28" height="6" rx="2" fill="#a48e70"/><rect x="5" y="10" width="22" height="16" rx="5" fill="#e5d4b6"/><rect x="8" y="14" width="16" height="7" rx="3" fill="#49443c"/><path d="M12 17h1m6 0h1" stroke="#f1d4a0" stroke-width="2.5" stroke-linecap="round"/>'],
  ['invite','Ami','<circle cx="22" cy="10" r="5" fill="#b99d77"/><path d="M14 25v-3a8 8 0 0 1 16 0v3Z" fill="#b99d77"/><circle cx="11" cy="12" r="5.7" fill="#eee4d2"/><path d="M1 28v-3a10 10 0 0 1 20 0v3Z" fill="#eee4d2" stroke="#393630" stroke-width="1.3"/>']
];
function playTabs(){
  return '<div class="play-tabs" role="group" aria-label="Mode de jeu">'+playModes.map(([mode,title,picture])=>
    `<button data-play-tab="${mode}" aria-pressed="${mode===playTab}"><svg aria-hidden="true" viewBox="0 0 32 32">${picture}</svg>${title}</button>`).join('')+'</div>';
}
function cadenceFor(mode){
  const fallback=mode==='bot'?'none':'10+0', value=get('cadence-'+mode,fallback);
  return Cadences.valid(value)?value:fallback;
}
function cadencePicker(mode,group=mode){
  const choice=cadenceFor(mode);
  const option=id=>`<label class="pace-option"><input type="radio" name="pace-${group}" value="${id}" data-cadence-mode="${mode}" ${choice===id?'checked':''}><span>${Cadences.label(id)}</span></label>`;
  return `<fieldset class="pace-picker"><legend>Cadence <small>${Cadences.label(choice)}</small></legend>${Cadences.groups.map(([title,ids])=>
    `<div class="pace-group"><h3>${title}</h3><div>${ids.map(option).join('')}</div></div>`).join('')}${option('none')}</fieldset>`;
}
document.addEventListener('change',event=>{
  const input=event.target;
  if(input.dataset.cadenceMode && Cadences.valid(input.value)){
    save('cadence-'+input.dataset.cadenceMode,input.value);
    input.closest('fieldset').querySelector('legend small').textContent=Cadences.label(input.value);
  }
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
