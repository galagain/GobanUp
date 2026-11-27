'use strict';
let account = null;
let clubState = {friends:[],rooms:[]};
let clubRequest = 0;
let afterLogin = null;
const historyKey = () => account ? 'games.'+account.id : 'games';

async function clubApi(path, body) {
  const response = await fetch('/api/'+path, {
    method:body === undefined ? 'GET' : 'POST', cache:'no-store',
    headers:body === undefined ? {} : {'Content-Type':'application/json'},
    body:body === undefined ? undefined : JSON.stringify(body)
  });
  const stamp=Number(response.headers.get('X-Server-Time'));
  if(stamp)serverOffset=stamp-Date.now();
  const data = await response.json();
  if (!response.ok) {
    if (response.status===401 && account && path!=='login') {
      setAccount(null);
      await route();
    }
    const err=Error(data.error || 'Connexion interrompue.');
    err.status=response.status; throw err;
  }
  return data;
}
function setAccount(user) {
  account=user;selectedFriend='';
  name=user?.name || 'Connexion';
  clubRequest++;
  clubState={friends:[],rooms:[]};
  games=get(historyKey(),[]);
  incomingRoom=null; displayedGame=null; displayedSetup=false; activeRoom=null;
}
function updateBadge() {
  const tab=document.querySelector('a[href="#amis"]');
  if (!tab) return;
  tab.querySelector('.club-count')?.remove();
  const total=clubState.friends.filter(f=>!f.accepted && f.sender!==account?.id).length+clubState.rooms.filter(r=>r.invited).length;
  if (total) {
    tab.insertAdjacentHTML('beforeend','<b class="club-count">'+total+'</b>');
    tab.setAttribute('aria-label','Amis · '+total+' demande(s) en attente');
  } else tab.setAttribute('aria-label','Amis');
}
async function refreshClub() {
  if (!account) return;
  const version=++clubRequest;
  const value=await clubApi('club');
  if (version!==clubRequest) return;
  const changed=JSON.stringify(value)!==JSON.stringify(clubState);
  clubState=value;
  const online=value.rooms.filter(r=>!r.invited).map(r=>({...r,mode:'online',date:0}));
  games=[...online,...games.filter(g=>g.mode!=='online')];
  updateBadge();
  if (changed && location.hash==='#amis') friendsPage();
  if (changed && location.hash==='#bibliotheque') library();
  if (changed && document.querySelector('.size-pick')) lobby(true);
}
function requireAccount(action) {
  if (account) return true;
  afterLogin=action; accountDialog(); return false;
}
function accountDialog(register=false) {
  if (account) {
    popup('Mon compte','<p>Connecté en tant que <strong>'+safe(account.name)+'</strong>.</p>'+btn('Se déconnecter','logout'));
    return;
  }
  const title=register?'Créer un compte':'Se connecter';
  popup(title,`<form id="account-form"><label for="nickname">Pseudo</label>
    <input id="nickname" required minlength="3" maxlength="24" autocomplete="username" autocapitalize="none" spellcheck="false">
    <label for="password">Mot de passe</label><input id="password" type="password" required maxlength="128" minlength="${register?10:1}" autocomplete="${register?'new-password':'current-password'}">
    ${register?'<small>10 caractères minimum.</small>':''}<p class="error" role="alert"></p>
    <button class="btn primary">${title}</button></form>
    <div class="actions">${btn(register?'J’ai déjà un compte':'Créer un compte',register?'login':'register')}</div>`);
  $('#account-form').onsubmit=async e=>{
    e.preventDefault();
    const form=e.currentTarget, submit=form.querySelector('button');
    submit.disabled=true;
    try {
      const result=await clubApi(register?'register':'login',{name:$('#nickname').value,password:$('#password').value});
      const next=afterLogin; afterLogin=null;
      setAccount(result.user); modal.close(); await refreshClub(); await route();
      if (next) await next();
    } catch(err) { form.querySelector('.error').textContent=err.message; }
    finally { submit.disabled=false; }
  };
}
function addFriend() {
  popup('Ajouter un ami',`<form id="friend-form"><label for="friend-name">Pseudo du partenaire</label>
    <input id="friend-name" required maxlength="24" autocomplete="off" autocapitalize="none">
    <p class="error" role="alert"></p><button class="btn primary">Envoyer la demande</button></form>`);
  $('#friend-form').onsubmit=async e=>{
    e.preventDefault();
    const form=e.currentTarget;
    try { await clubApi('friends',{name:$('#friend-name').value}); modal.close(); await refreshClub(); toast('Demande envoyée.'); }
    catch(err) { form.querySelector('.error').textContent=err.message; }
  };
}
function friendsPage() {
  const side=panelForCurrentBoard();
  if (!account) {
    side.innerHTML=`<div class="empty-panel">${artTile('friends')}<h2>Jouer avec vos amis</h2>
    <p>Connectez-vous pour ajouter vos partenaires et les inviter sur le goban.</p>${btn('Se connecter','profile','',true)} ${btn('Créer un compte','register')}</div>`;
    return;
  }
  const section=(title,rows)=>rows.length?`<section class="club-section"><h2>${title}</h2><div class="panel">${rows.join('')}</div></section>`:'';
  const person=(label,actions,detail='')=>`<div class="friend-row"><span class="avatar">${safe(label.slice(0,1).toUpperCase())}</span>
    <span class="friend-name"><strong>${safe(label)}</strong>${detail?`<small>${safe(detail)}</small>`:''}</span><div class="club-actions">${actions}</div></div>`;
  const list=clubState.friends;
  const incoming=list.filter(f=>!f.accepted&&f.sender!==account.id);
  const outgoing=list.filter(f=>!f.accepted&&f.sender===account.id);
  const invites=clubState.rooms.filter(r=>r.invited);
  const accepted=list.filter(f=>f.accepted);
  side.innerHTML=`<div class="friends-actions"><h1>Amis</h1>${btn('Ajouter un ami','add','plus',true)}</div>`+
    section('Invitations à jouer',invites.map(r=>person(r.black,btn('Rejoindre','accept-room:'+r.id,'',true)+btn('Décliner','decline-room:'+r.id),r.n+' × '+r.n+' · '+Cadences.label(r.cadence))))+
    section('Demandes reçues',incoming.map(f=>person(f.name,btn('Accepter','accept:'+f.id,'',true)+btn('Refuser','remove:'+f.id))))+
    section('Mes amis',accepted.map(f=>person(f.name,btn('Inviter à jouer','friend-game:'+f.id,'friends',true)+btn('Retirer','unfriend:'+f.id))))+
    section('Demandes envoyées',outgoing.map(f=>person(f.name,btn('Annuler','remove:'+f.id),'En attente de réponse')))+
    (!list.length&&!invites.length?`<div class="empty-panel">${artTile('friends')}<h2>Votre liste d’amis est vide</h2><p>Ajoutez un joueur avec le pseudo de son compte.</p></div>`:'');
}
function challengeDialog(id) {
  const friend=clubState.friends.find(f=>f.id===id);
  if (!friend) return;
  popup('Inviter '+safe(friend.name),`${boardSizePicker(true)}${cadencePicker('friend-dialog')}<div class="actions">${btn('Envoyer l’invitation','send-game:'+id,'friends',true)}</div>`);
}
async function clubAction(action,id) {
  try {
    switch(action) {
      case 'profile': case 'login': afterLogin=null; accountDialog(); break;
      case 'register': accountDialog(true); break;
      case 'logout': await clubApi('logout',{}); setAccount(null); modal.close(); location.hash='nouvelle'; await route(); break;
      case 'add': addFriend(); break;
      case 'unfriend': popup('Retirer cet ami ?',btn('Retirer de mes amis','remove:'+id)+btn('Annuler','close')); break;
      case 'remove': case 'accept': await clubApi('friends/'+id+'/'+action,{}); modal.close(); await refreshClub(); break;
      case 'friend-game': challengeDialog(id); break;
      case 'send-game': { const r=await clubApi('friends/'+id+'/challenge',{n:Number($('[name=friend-size]:checked').value),cadence:selectedCadence()}); modal.close(); enterRoom(r); break; }
      case 'accept-room': enterRoom(await requestRoom('/'+id+'/join',{})); break;
      case 'decline-room': await requestRoom('/'+id+'/decline',{}); await refreshClub(); break;
    }
  } catch(err) { toast(err.message); }
}
async function bootClub() {
  try { setAccount((await clubApi('me')).user); await refreshClub(); }
  catch(err) { toast(err.message); }
  await route();
  setInterval(()=>{ if (account && !document.hidden) refreshClub().catch(()=>{}); },5000);
  window.addEventListener('focus',()=>{if(account) refreshClub().catch(()=>{});});
}
