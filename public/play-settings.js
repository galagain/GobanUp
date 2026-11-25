'use strict';
let playTab='queue', selectedFriend='';
const playModes=[
  ['queue','En ligne','<circle cx="13" cy="13" r="8.2"/><path d="M5 11.5c3.6 2 8 2.1 12.1.1M11.8 5c-3.1 3.4-4.1 7.5-2.8 11.5"/><path class="logo-accent" d="M14.3 17.8c4.2-.8 8.3-3.8 8.6-5.8.2-1-.2-1.8-1.1-2.4"/><circle class="logo-node" cx="14" cy="17.9" r="1.7"/>'],
  ['bot','Bot','<path d="M12 6V3.5m-8 9H2.5m19 0H20"/><rect x="4.5" y="6.5" width="15" height="13" rx="4.8"/><path class="logo-accent" d="M9.3 15.4c1.8 1.4 3.7 1.4 5.4 0"/><circle class="logo-node" cx="9.2" cy="11.5" r="1.2"/><circle class="logo-node" cx="14.8" cy="11.5" r="1.2"/>'],
  ['invite','Ami','<circle cx="9" cy="9" r="3.2"/><path d="M2.7 20v-1.4a6.3 6.3 0 0 1 12.6 0V20"/><path class="logo-accent" d="M15.4 5.2a3.3 3.3 0 1 1 .5 6.5m1.3 2.1a5.5 5.5 0 0 1 4.2 5.3v.9"/>']
];
function playTabs(){
  return '<div class="play-tabs" role="group" aria-label="Mode de jeu">'+playModes.map(([mode,title,picture])=>
    `<button data-play-tab="${mode}" aria-pressed="${mode===playTab}"><svg aria-hidden="true" viewBox="0 0 26 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${picture}</svg>${title}</button>`).join('')+'</div>';
}
function cadenceFor(mode){
  const fallback=mode==='bot'?'none':'10+0', value=get('cadence-'+mode,fallback);
  return Cadences.valid(value)?value:fallback;
}
const paceSymbols={
  Bullet:'<path d="m13 2-8 11h6l-1 7 8-12h-6z"/>',
  Blitz:'<path d="m7 4 6 7-6 8m7-15 6 7-6 8"/>',
  Rapide:'<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l3 2M9 2h6m-3 0v3"/>',
  Longue:'<path d="M5 3h14M5 21h14M7 3c0 5 1 6 5 9-4 3-5 4-5 9m10-18c0 5-1 6-5 9 4 3 5 4 5 9"/>',
  'En différé':'<rect x="3.5" y="5.5" width="17" height="15" rx="3"/><path d="M8 3v5m8-5v5M4 11h16m-12 4h3"/>',
  Libre:'<path d="M12 12c-2-3-3.5-4-5.5-4a4 4 0 0 0 0 8c4 0 7-8 11-8a4 4 0 0 1 0 8c-2 0-3.5-1-5.5-4Z"/>'
};
const paceViews=new Map();
function cadencePicker(mode,group=mode){
  const choice=cadenceFor(mode), scope=group==='friend-dialog'?group:'lobby';
  const selectedView=paceViews.get(scope)??(Cadences.more.some(([,ids])=>ids.includes(choice))?'more':'usual');
  paceViews.set(scope,selectedView);
  const option=id=>`<label class="pace-option"><input type="radio" name="pace-${group}" value="${id}" data-cadence-mode="${mode}" ${choice===id?'checked':''}><span>${Cadences.label(id)}</span></label>`;
  const views=[['usual','Usuelles',Cadences.groups],['more','Plus de cadences',Cadences.more]];
  const tabs=views.map(([id,title])=>`<button type="button" role="tab" id="tab-${group}-${id}" aria-controls="panel-${group}-${id}" aria-selected="${id===selectedView}" tabindex="${id===selectedView?0:-1}" data-pace-view="${id}">${title}</button>`).join('');
  const panels=views.map(([id,,groups])=>`<div role="tabpanel" id="panel-${group}-${id}" aria-labelledby="tab-${group}-${id}" ${id===selectedView?'':'hidden'}>${groups.map(([title,ids])=>
    `<div class="pace-group"><h3><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paceSymbols[title]}</svg>${title}</h3><div>${ids.map(option).join('')}</div></div>`).join('')}</div>`).join('');
  return `<fieldset class="pace-picker" data-pace-scope="${scope}"><legend>Cadence <small>${Cadences.label(choice)}</small></legend><div class="pace-tabs" role="tablist" aria-label="Choix de cadences">${tabs}</div>${panels}</fieldset>`;
}
function activatePaceView(tab){
  const picker=tab.closest('.pace-picker');
  paceViews.set(picker.dataset.paceScope,tab.dataset.paceView);
  for(const button of picker.querySelectorAll('[role=tab]')){
    const active=button===tab;
    button.setAttribute('aria-selected',active);button.tabIndex=active?0:-1;
    document.getElementById(button.getAttribute('aria-controls')).hidden=!active;
  }
  tab.focus({preventScroll:true});
}
document.addEventListener('click',event=>{
  const tab=event.target.closest('[data-pace-view]');
  if(tab)activatePaceView(tab);
});
document.addEventListener('keydown',event=>{
  const tab=event.target.closest('[data-pace-view]');
  if(!tab || !['Home','End','ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();
  const tabs=[...tab.parentNode.children];
  activatePaceView(event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):tabs.find(t=>t!==tab));
});
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
