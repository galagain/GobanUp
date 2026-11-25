
'use strict';
const $=s=>document.querySelector(s);
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={home:'<path d="m3 10 9-7 9 7v10h-6v-6H9v6H3z"/>',play:'<path d="M4 8h16M4 16h16M8 4v16M16 4v16"/><circle cx="8" cy="8" r="2.9" fill="currentColor"/><circle cx="16" cy="16" r="2.9" fill="currentColor"/>',analysis:'<path d="M3 4v16h18M6 15l5-6 4 3 6-8"/>',friends:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5"/>',book:'<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14"/>',down:'<path d="m6 9 6 6 6-6"/>',right:'<path d="m9 5 7 7-7 7"/>',left:'<path d="m15 5-7 7 7 7"/>',first:'<path d="M5 5v14m13-14-7 7 7 7"/>',last:'<path d="M19 5v14M6 5l7 7-7 7"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',bolt:'<path d="M13 2 4 14h7l-1 8L21 9h-8z"/>',stones:'<circle cx="9" cy="9" r="5"/><path d="M15 8a6 6 0 1 1-7 7"/>',share:'<path d="M9 15l6-6m-8 3-2 2a4 4 0 0 0 6 6l3-3m-4-10 3-3a4 4 0 0 1 6 6l-2 2"/>'};
const icon=(name,small=false)=>`<svg aria-hidden="true" class="${small?'small-icon':'ico'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name]||''}</svg>`;
const get=(k,f)=>{try{return JSON.parse(localStorage.getItem('gobanup.'+k))??f}catch{return f}};
const save=(k,v)=>localStorage.setItem('gobanup.'+k,JSON.stringify(v));
let games=get('games',[]),name='Connexion',game,position=0,reviewing=false,timer;
const main=$('#main'),modal=$('#modal');
function toast(text){$('#toast').textContent=text;$('#toast').className='show';clearTimeout(timer);timer=setTimeout(()=>$('#toast').className='',3200)}
function popup(title,body){modal.innerHTML=`<button type="button" class="close" aria-label="Fermer" data-action="close">${icon('close')}</button><h2>${title}</h2>${body}`;if(!modal.open)modal.showModal()}
modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close()}});
const tabs = [
  { key: 'jouer', label: 'Jouer', picture: `
    <ellipse cx="8.8" cy="10.6" rx="7.4" ry="6.4" fill="#181716" stroke="#8a8780"/>
    <path d="M4 8.8c1-1.7 2.5-2.6 4.4-2.8" fill="none" stroke="#77736c" stroke-linecap="round"/>
    <ellipse cx="16" cy="16.3" rx="7" ry="5.8" fill="#b6b1a5"/>
    <ellipse cx="15.8" cy="15" rx="6.8" ry="5.5" fill="#eeeae0"/>
    <path d="M11.3 14.3c.6-1.1 1.6-1.8 2.8-2.1" fill="none" stroke="#fffdf8" stroke-linecap="round"/>` },
  { key: 'analyse', label: 'Analyse', picture: `
    <path d="M5 19.2v-4.5c0-3.1 2.1-4.4 4.7-4.4H13c2.8 0 5.2-1.5 5.2-5.3m-8.4 5.3c3.6 0 5.1 3.7 8.4 3.7" fill="none" stroke="#c7c3b8" stroke-width="2.3" stroke-linecap="round"/>
    <circle cx="5" cy="19.1" r="3.4" fill="#eeeae0"/><circle cx="18.2" cy="4.5" r="3.4" fill="#debe90"/>
    <circle cx="18.9" cy="14.3" r="2.8" fill="#33302c" stroke="#c7c3b8" stroke-width="1.4"/>` },
  { key: 'amis', label: 'Amis', picture: `
    <circle cx="16.8" cy="7.8" r="3.7" fill="#aaa69d"/>
    <path d="M11.5 18.5v-1.8a5.7 5.7 0 0 1 11.4 0v1.8z" fill="#aaa69d"/>
    <circle cx="8.4" cy="8.5" r="4.1" fill="#e8e4d9"/>
    <path d="M1.1 20.8v-1.7a7.3 7.3 0 0 1 14.6 0v1.7z" fill="#e8e4d9" stroke="#353330" stroke-width="1.2"/>` }
];
function header(route){
  $('#nav').innerHTML = tabs.map(({key, label, picture}) => `<a href="#${key}" aria-label="${label}" title="${label}" ${key===route?'aria-current="page" class="active"':''}><svg class="tab-symbol" viewBox="0 0 24 24" aria-hidden="true">${picture}</svg><span>${label}</span></a>`).join('');
  $('#profile').setAttribute('aria-label',account?'Mon compte · '+name:'Se connecter');
  $('#profile').innerHTML=`<span class="avatar">${safe(name.slice(0,1).toUpperCase())}</span><span>${safe(name)}</span>${icon('down',true)}`;
}
function btn(label,act,i='',primary=false){return `<button class="btn ${primary?'primary':''}" data-action="${act}">${i?icon(i):''}${label}</button>`}
function newGame(n,mode,opponent){return {id:crypto.randomUUID(),n,mode,opponent,moves:[],date:Date.now()}}
function persistGames() {
  const local=account?games.filter(g=>g.mode!=='online'):games;
  save(historyKey(),local.slice(0,80));
}
function saveGame() {
  games=[game,...games.filter(g=>g.id!==game.id)];
  if(!account)games=games.slice(0,80);
  if(game.mode!=='online')persistGames();
}
const demos=[{id:'opening',title:'Les premiers coups',n:19,moves:[60,300,72,288,244,270,41,319,110,249]},{id:'atari',title:'Comprendre l’atari',n:9,moves:[39,40,31,50,41,51,49]}];
function gameTitle(g){return g.title||({bot:'Partie contre '+BotPlayers.name(g.level),local:'Partie à deux',online:'Partie en ligne',link:'Partie par correspondance'}[g.mode]||'Étude libre')}
const turnAt=(g,i)=>((g.first===2?1:0)+i)%2+1;
function makeStates(g){let board=g.start?g.start.slice():Array(g.n*g.n).fill(0);const states=[board],caps=[[0,0]];for(let i=0;i<g.moves.length;i++){let cap=caps[i].slice();if(g.moves[i]!==-1){const r=Go.play(board,g.moves[i],turnAt(g,i),g.n,states);if(!r)throw Error('Coup incorrect');board=r.board;cap[turnAt(g,i)-1]+=r.captured}states.push(board);caps.push(cap)}return {states,caps}}
const twoPasses=(moves,index=moves.length)=>index>=2 && moves[index-1]===-1 && moves[index-2]===-1;
const ended=g=>Boolean(g.resigned||g.timedOut)||twoPasses(g.moves);
const finishResult=g=>((g.resigned||g.timedOut)===1?'Blanc':'Noir')+(g.timedOut?' gagne au temps':' gagne par abandon');
const coord=(p,n)=>p===-1?'Passe':'ABCDEFGHJKLMNOPQRST'[p%n]+(n-Math.floor(p/n));
function boardStars(n,axis,radius){
  const marks=n===9?[2,4,6]:n===13?[3,6,9]:[3,9,15];
  let circles='';
  for(const x of marks)for(const y of marks){
    if(n===19 || (x===marks[1])===(y===marks[1]))circles+=`<circle cx="${axis(x)}" cy="${axis(y)}" r="${radius}"/>`;
  }
  return circles;
}
function boardSvg(board,n,last=-1,keys=false){const e=boardMargin,side=100,gap=(side-2*e)/(n-1),axis=v=>e+v*gap,rad=gap*.455;let lines='',stones='',labels='';
const dots=boardStars(n,axis,gap*.115);
for(let i=0;i<n;i++){const v=axis(i);lines+=`M${v} ${e}V${side-e}M${e} ${v}H${side-e}`;if(keys)labels+=`<text x="${v}" y="3.5">${'ABCDEFGHJKLMNOPQRST'[i]}</text><text x="2.9" y="${v+1.05}">${n-i}</text>`}

board.forEach((v,i)=>{if(!v)return;const x=axis(i%n),y=axis(Math.floor(i/n));stones+=`<circle cx="${x+.28}" cy="${y+.5}" r="${rad}" fill="#5b402b66"/><circle cx="${x}" cy="${y}" r="${rad}" fill="${v===1?'url(#stoneB)':'url(#stoneW)'}" stroke="${v===1?'#161714':'#dbd4c4'}" stroke-width=".18"/>`;if(last===i)stones+=`<circle class="last-stone" cx="${x}" cy="${y}" r="${rad*.34}" fill="none" stroke="${v===1?'#eee':'#4a493e'}" stroke-width="${gap*.09}"/>`});
return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="stoneB" cx="34%" cy="24%" r="77%"><stop stop-color="#54554e"/><stop offset=".55" stop-color="#282a26"/><stop offset="1" stop-color="#141513"/></radialGradient><radialGradient id="stoneW" cx="34%" cy="24%" r="77%"><stop stop-color="#fffef6"/><stop offset=".72" stop-color="#f0ecdf"/><stop offset="1" stop-color="#d6d0c0"/></radialGradient></defs><path d="${lines}" fill="none" stroke="#745934" stroke-width="${n===19?.16:.28}"/><g fill="#5d482d">${dots}</g><g fill="#624b36" font-family="sans-serif" font-size="${n===19?2.05:2.55}" text-anchor="middle">${labels}</g>${stones}</svg>`}
function launch(g){game=g;if(g.mode==='link')game.seat=1;saveGame();modal.close();location.hash='partie/'+g.id}
function readGame(id){return games.find(g=>g.id===id)||demos.find(g=>g.id===id)}
function shareUrl(){const {id,n,moves,opponent}=game;const payload={id,n,moves,resigned:game.resigned,opponent:game.seat===1?name:opponent,seat:3-game.seat};return location.href.split('#')[0]+'#invitation/'+encodeURIComponent(JSON.stringify(payload))}
function share(){popup('Transmettre la partie',`<p>Envoyez ce lien à votre partenaire pour qu’il ouvre le goban et joue son coup.</p><label for="url">Lien de la position</label><textarea id="url" readonly rows="3">${safe(shareUrl())}</textarea><div class="actions">${btn('Copier le lien','copy','share',true)}</div>`)}
function receive(raw){try{const data=JSON.parse(decodeURIComponent(raw));const {id,n,moves,seat}=data;if(!/^[a-f0-9-]{36}$/.test(id)||![9,13,19].includes(n)||![1,2].includes(seat)||!Array.isArray(moves)||moves.length>3000||!moves.every(p=>Number.isInteger(p)&&p>=-1&&p<n*n))throw Error();const old=games.find(g=>g.id===id);let g={id,n,moves,seat,mode:'link',date:Date.now(),opponent:String(data.opponent||'Partenaire').slice(0,32)};if(data.resigned!=null){if(data.resigned!==3-seat||twoPasses(moves))throw Error();g.resigned=data.resigned}makeStates(g);if(old){if(old.mode!=='link'||old.n!==n||!moves.slice(0,Math.min(old.moves.length,moves.length)).every((m,i)=>old.moves[i]===m))throw Error();if(ended(old)||old.moves.length>moves.length||old.moves.length===moves.length&&!g.resigned||old.seat!==seat)g=old}game=g;saveGame();location.replace('#partie/'+id)}catch{toast('Ce lien de partie est invalide.');location.replace('#jouer')}}
function recordLocalMove(p){
  if(game.clock){
    const now=Date.now(),expired=Cadences.expired(game.clock,now);
    if(expired){game.timedOut=expired;return}
    game.clock=Cadences.advance(game.cadence,game.clock,now,p===-1 && game.moves.at(-1)===-1);
  }
  game.moves.push(p);
}
function move(p){const st=makeStates(game).states,color=turnAt(game,game.moves.length);if(ended(game)||reviewing||game.mode==='bot'&&color!==1||game.mode==='link'&&game.seat!==color)return;const result=p===-1?null:Go.play(st.at(-1),p,color,game.n,st);if(p!==-1&&!result){toast('Coup interdit sur cette intersection.');return}recordLocalMove(p);
if(game.mode==='bot'&&!ended(game)&&!BotPlayers.external(game.level)){const boards=makeStates(game).states,b=boards.at(-1);let best=-Infinity,choice=-1;if(p!==-1){for(let q=0;q<b.length;q++){const r=Go.play(b,q,2,game.n,boards);if(!r)continue;const g=Go.group(r.board,q,game.n);const adj=Go.adjacent(q,game.n);if(adj.every(v=>b[v]===2)&&!r.captured)continue;const score=r.captured*(game.level==='easy'?2:12)+Math.random()*(game.level==='easy'?12:4)+adj.filter(i=>b[i]===1).length*.7+(g.liberties.size===1?-7:0)-Math.abs((q%game.n)-(game.n-1)/2)*.06;if(score>best){best=score;choice=q}}}recordLocalMove(choice)}
position=game.moves.length;saveGame();drawGame()}

Object.assign(paths,{
 globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7.5h14M5 16.5h14"/>',
 bot:'<rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 7V4m-2 12h4M1.5 11.5v4m21-4v4"/><circle cx="12" cy="3" r="1"/><circle cx="8.5" cy="12" r=".8" fill="currentColor"/><circle cx="15.5" cy="12" r=".8" fill="currentColor"/>',
 file:'<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 15h6m-3-3v6"/>',
 edit:'<path d="M4 5h12M4 10h7M4 15h4m3 5 1-5 7-7 4 4-7 7z"/>',
 infinity:'<path d="M12 12c-2.3-3.3-3.8-4.7-6.1-4.7a4.7 4.7 0 1 0 0 9.4c4.7 0 7.5-9.4 12.2-9.4a4.7 4.7 0 0 1 0 9.4c-2.3 0-3.8-1.4-6.1-4.7Z"/>',
 sliders:'<path d="M3 7h8m4 0h6M3 17h3m4 0h11"/><circle cx="13" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
 arrow:'<path d="M6 18 18 6M6 6h12v12"/>',
 stones:'<circle cx="9" cy="9" r="6"/><path d="M16 8.5a6 6 0 1 1-7.5 7.5"/>'
});
const artTile=(iconName)=>`<span class="mode-art">${icon(iconName)}</span>`;
function row(g,link){
  return `<a class="record" href="#${link}/${g.id}"><span class="record-icon">${icon(g.mode==='bot'?'bot':g.mode==='online'?'globe':'play')}</span><span><strong>${safe(g.mode==='online' ? ((g.seat===1?g.white:g.black) ? 'Contre '+(g.seat===1?g.white:g.black) : 'En attente d’un adversaire') : gameTitle(g))}</strong><small>${g.n} × ${g.n} · ${g.moves.length} coups${(g.resigned||g.timedOut)?' · '+finishResult(g):''}</small></span>${icon('right',true)}</a>`;
}

let boardSize=[9,13,19].includes(get('board-size',19))?get('board-size',19):19;
let incomingRoom=null;
const playMode=(title,detail,glyph,action,primary=false)=>`<button class="play-mode ${primary?'featured':''}" data-action="${action}">
  <span class="action-symbol">${icon(glyph)}</span><span><strong>${title}</strong><small>${detail}</small></span></button>`;
function lobby(keepBoard=false){
  const side=keepBoard?panelForCurrentBoard():emptyStage(boardSize);
  if(keepBoard) boardSize=displayedSetup?setupBoard.n:readGame(displayedGame?.id)?.n??boardSize;
  const bot=playTab==='bot', friend=playTab==='invite';
  const target=friend?friendOptions():'';
  const actionLabel=bot?'Jouer contre le bot':friend?(selectedFriend?'Envoyer l’invitation':'Créer un lien d’invitation'):'Trouver un adversaire';
  side.innerHTML=playTabs()+`<div class="side-content play-config">${cadencePicker(playTab)}<div class="play-options">${boardSizePicker()}
    ${bot?`<label for="level">Adversaire</label><select id="level">${BotPlayers.options()}</select><small class="bot-download" id="bot-download" hidden></small><a class="bot-credits" href="bots/sources.html" target="_blank" rel="noopener">Sources des bots</a>`:target}
    </div></div><div class="play-submit">${btn(actionLabel,friend?'challenge':playTab,'right',true)}</div>`;
  if(bot){
    const picker=side.querySelector('#level'),footer=side.querySelector('.play-submit'),hint=side.querySelector('#bot-download');
    function showOpponent(){
      const entry=OpponentCatalog.get(picker.value);
      const remote=entry && !entry.engine;
      const large=picker.value.startsWith('human-') || picker.value==='raylu';
      hint.hidden=!large && !remote;
      hint.textContent=remote?(['ogs-2143892','ogs-2122166','ogs-2123396'].includes(entry.key)?'Sur OGS · Goban 9 × 9 uniquement':'Taille et cadence à choisir sur OGS'):large?'Premier chargement du modèle · environ 99 Mo':'';
      footer.innerHTML=remote?`<a class="btn primary" href="${entry.url}" target="_blank" rel="noopener">Voir ${safe(entry.name)} sur OGS ↗</a>`:btn(actionLabel,'bot','right',true);
    }
    picker.value=get('bot-level','normal');
    if(!picker.value)picker.value='normal';
    picker.onchange=()=>{save('bot-level',picker.value);showOpponent()};
    showOpponent();
  }
  if($('#opponent'))$('#opponent').onchange=e=>{selectedFriend=e.target.value;side.querySelector('[data-action="challenge"]').lastChild.textContent=selectedFriend?'Envoyer l’invitation':'Créer un lien d’invitation'};
  const previous=games.filter(g=>g.mode!=='study'&&!ended(g));
  if(previous.length)side.querySelector('.side-content').insertAdjacentHTML('beforeend',`<details class="resume-list"><summary>Reprendre une partie (${previous.length})</summary>${previous.map(g=>row(g,g.mode==='online'?'salon':'partie')).join('')}</details>`);
}
async function startMode(mode){
  if(mode==='bot'){const level=$('#level')?.value||get('bot-level','normal');if(!BotPlayers.playable(level))return;const g=newGame(boardSize,'bot','Ordinateur');g.level=level;g.cadence=selectedCadence();g.clock=Cadences.initial(g.cadence,Date.now());launch(g);return}
  if(!requireAccount(()=>startMode(mode)))return;
  const version=routeVersion;
  const side=emptyStage(boardSize);
  side.innerHTML=`<div class="panel-head">${icon(mode==='queue'?'globe':'friends')}<h2>${mode==='queue'?'Jouer en ligne':'Avec un ami'}</h2></div><div class="side-content"><p role="status">Connexion au salon…</p></div>`;
  try{
    const cadence=selectedCadence();
    const r=mode==='invite'&&selectedFriend?await clubApi('friends/'+selectedFriend+'/challenge',{n:boardSize,cadence}):await requestRoom('',{kind:mode,n:boardSize,cadence,ticket:crypto.randomUUID()});
    if(routeVersion!==version){
      if(!r.ready)await requestRoom('/'+r.id+'/cancel',{}).catch(()=>{});
      return;
    }
    enterRoom(r);
  }catch(err){
    if(version===routeVersion){lobby();toast(err.message)}
  }
}
function waitingRoom(r){
  const side=emptyStage(r.n);
  displayedGame={id:r.id,position:0};
  const link=location.href.split('#')[0]+'#rejoindre/'+r.id;
  side.innerHTML=`<div class="panel-head">${icon(r.kind==='queue'?'globe':'friends')}<h2>${r.kind==='queue'?'Recherche en ligne':'Invitation à jouer'}</h2></div><div class="side-content">
  <p class="room-settings">${r.n} × ${r.n} · ${Cadences.label(r.cadence)}</p>
  <p class="waiting-status" role="status">${r.kind==='queue'?'En attente d’un adversaire…':'En attente de votre ami…'}</p>
  <p>${r.kind==='queue'?'La partie commencera ici dès qu’un joueur vous rejoint.':r.kind==='friend'?'Votre ami peut accepter l’invitation dans l’onglet Amis.':'Transmettez ce lien à votre partenaire.'}</p>
  ${r.kind==='invite'?`<input id="url" aria-label="Lien d’invitation" readonly value="${safe(link)}">${btn('Copier le lien','copy','share',true)}`:''}<div class="side-foot">${btn('Annuler','cancel-room')}</div></div>`;
}

function library(){
  const side=panelForCurrentBoard();
  side.innerHTML=`<div class="side-content"><div class="launch-modes">
    ${playMode('Importer une partie','Ouvrir un fichier SGF','file','import',true)}
    ${playMode('Définir une position','Placer les pierres sur le goban','edit','setup')}</div>
    <input type="file" id="sgf-input" accept=".sgf,application/x-go-sgf" hidden>
    ${games.length?`<section class="records"><h2>Mes parties et études</h2>${games.map(g=>row(g,'etude')).join('')}</section>`:''}</div>`;
  $('#sgf-input').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      if(file.size>2_000_000)throw Error('Le fichier dépasse 2 Mo.');
      game=importSgf(await file.text(),file.name);saveGame();location.hash='etude/'+game.id;
    }catch(err){popup('Import impossible',`<p>${safe(err.message)}</p>${btn('Choisir un autre fichier','import')}`)}
    e.target.value='';
  };
}
let setupBoard,brush=1;
function openSetup(){setupBoard=newGame(readGame(displayedGame?.id)?.n??boardSize,'study','');setupBoard.start=Array(setupBoard.n**2).fill(0);setupBoard.first=1;setupBoard.title='Position libre';brush=1;showSetup()}
function showSetup(){
  const n=setupBoard.n;
  displayedGame=null;displayedSetup=true;
  const side=boardShell();
  seats('Noir','Blanc');paintBoard(setupBoard.start,n,-1,'place');
  side.innerHTML=`<div class="panel-head">${icon('edit')}<h2>Définir une position</h2></div><div class="side-content">
  <label for="editor-size">Taille du goban</label><select id="editor-size">${[9,13,19].map(v=>`<option value="${v}" ${v===n?'selected':''}>${v} × ${v}</option>`).join('')}</select>
  <fieldset><legend>Outil</legend><div class="actions">${[1,2,0].map(v=>`<button class="btn" data-brush="${v}" aria-pressed="${v===brush}">${['Effacer','● Noir','○ Blanc'][v]}</button>`).join('')}</div></fieldset>
  <label for="next">Au trait</label><select id="next"><option value="1">Noir</option><option value="2">Blanc</option></select>
  <div class="actions">${btn('Analyser la position','finish-setup','analysis',true)}</div></div>`;
  $('#next').value=setupBoard.first;$('#next').onchange=e=>setupBoard.first=+e.target.value;
  $('#editor-size').onchange=e=>{
    const size=+e.target.value;
    if(setupBoard.start.some(Boolean)&&!confirm('Changer de taille effacera les pierres placées. Continuer ?')){showSetup();return}
    setupBoard.n=size;setupBoard.start=Array(size*size).fill(0);showSetup();
  };
}
let pollTimer,routeVersion=0,activeRoom,pendingMove=false;
async function requestRoom(suffix,payload){
  return clubApi('rooms'+suffix,payload);
}
function enterRoom(r){incomingRoom=r;location.hash='salon/'+r.id}
function roomView(r){
  if(activeRoom?.id===r.id&&(r.revision<activeRoom.revision||activeRoom.ready&&!r.ready)) return;
  const waiting=!r.ready;
  activeRoom=r;
  if(waiting){
    game={...r,mode:'online',date:Date.now()};saveGame();
    waitingRoom(r);
  }else{
    game={...r,mode:'online',date:Date.now()};position=r.moves.length;saveGame();drawGame();
  }
}
async function pollRoom(id,version){
  if(version!==routeVersion)return;
  try{
    const r=await requestRoom('/'+id);
    if(version!==routeVersion)return;
    if(!activeRoom||r.revision>activeRoom.revision||r.timedOut!==activeRoom.timedOut||r.ready&&!activeRoom.ready)roomView(r);
    $('#network-message')?.remove();
    if(r.ready&&ended(r))return;
  }catch(err){
    if(version!==routeVersion)return;
    if(err.status===404 || err.status===403){
      games=games.filter(g=>g.id!==id); toast(err.message); location.replace('#nouvelle'); return;
    }
    if(!$('#network-message'))main.insertAdjacentHTML('beforeend',`<p id="network-message" role="status">${safe(err.message)} ${btn('Retour','home')}</p>`);
  }
  if(version===routeVersion)pollTimer=setTimeout(()=>pollRoom(id,version),1800);
}
async function onlineMove(p){
  if(pendingMove||!activeRoom?.ready)return;
  const r=activeRoom,version=routeVersion;pendingMove=true;
  try{const updated=await requestRoom('/'+r.id+'/move',{at:r.moves.length,p});if(version===routeVersion)roomView(updated)}
  catch(err){if(version===routeVersion)toast(err.message)}
  finally{pendingMove=false}
}
let reviewSource=null, forkPosition=null, reviewOverview=false, lastReview=null;
function setReviewView(overview,ply){
  ReviewSummary.leave();
  LocalAnalysis.detach();
  MoveReview.manual();
  forkPosition=null;
  game=reviewSource;
  position=Math.max(0,Math.min(game.moves.length,ply));
  reviewOverview=overview;
  displayedGame={id:game.id,position};
  drawGame();
  if(!overview)LocalAnalysis.enable();
  window.scrollTo(0,0);
}
function switchReview(overview,ply=forkPosition??position){
  const hash='#etude/'+reviewSource.id+(overview?'':'/lignes/'+ply);
  if(location.hash!==hash)history.pushState(null,'',hash);
  setReviewView(overview,ply);
  document.querySelector('.review-report h1,.analysis-panel h1')?.focus({preventScroll:true});
}
function openReview(source,index,lines=false){
  reviewing=true;
  reviewSource=game=source;
  forkPosition=null;
  MoveReview.begin(source);
  setReviewView(!!source.moves.length&&!lines,index);
}
function exploreLine(points,ply=points.length){
  if(!reviewing || !points.length)return;
  const prefix=game.moves.slice(0,position);
  const history=makeStates({...game,moves:prefix}).states;
  for(const p of points){
    const before=history.at(-1);
    const next=p===-1?before:Go.play(before,p,turnAt(game,prefix.length),game.n,history)?.board;
    if(!next){toast('Coup interdit sur cette intersection.');return}
    prefix.push(p);
    history.push(next);
  }
  const target=position+ply;
  // Follow an existing continuation without discarding its later moves.
  if(!points.every((p,i)=>game.moves[position+i]===p)){
    let common=0;
    while(common<prefix.length && prefix[common]===reviewSource.moves[common])common++;
    forkPosition=common===prefix.length?null:common;
    game=forkPosition===null?reviewSource:{...reviewSource,moves:prefix,resigned:null};
  }
  position=target;
  drawGame();
}
function returnToRecord(){
  position=forkPosition??position;
  forkPosition=null;game=reviewSource;drawGame();
}
async function resign(){
  if(reviewing||ended(game)||game.mode==='study')return;
  modal.close();
  if(game.mode==='online'){
    const version=routeVersion;
    try{
      const updated=await requestRoom('/'+game.id+'/resign',{});
      if(version===routeVersion)roomView(updated);
    }catch(err){if(version===routeVersion)toast(err.message)}
  }else{
    if(game.clock){if(Cadences.expired(game.clock,Date.now())){displayClocks();return}game.clock=Cadences.advance(game.cadence,game.clock,Date.now(),true)}
    game.resigned=game.mode==='bot'?1:game.seat||turnAt(game,position);
    saveGame();drawGame();
  }
}
async function route(){
  const [key,id,view,rawPly]=location.hash.slice(1).split('/');
  const requestedPly=Number(rawPly);
  const linePly=source=>Number.isInteger(requestedPly)?requestedPly:source.moves.length;
  if(key==='etude'&&reviewing&&reviewSource?.id===id){
    setReviewView(!!reviewSource.moves.length&&view!=='lignes',view==='lignes'?linePly(reviewSource):forkPosition??position);
    return;
  }
  if(reviewing)lastReview={source:reviewSource,game,position,forkPosition,overview:reviewOverview,board:$('#live-goban')?.dataset.position};
  reviewOverview=false;
  BotPlayers.stop();MoveReview.stop();LocalAnalysis.detach();modal.close();clearTimeout(pollTimer);const version=++routeVersion;
  const hadBoard=!!$('#board-desk')||!!$('.review-report');
  activeRoom=null;reviewing=false;reviewSource=null;forkPosition=null;
  const tab=['etude','position','analyse','bibliotheque'].includes(key)?'analyse':key==='amis'?'amis':'jouer';
  header(tab);
  updateBadge();
  main.setAttribute('aria-label',tabs.find(t=>t.key===tab).label);
  if(key==='salon'){
    if(!account){emptyStage(boardSize).innerHTML='<div class="side-content">'+btn('Se connecter','profile')+'</div>';return}
    const cached=incomingRoom?.id===id?incomingRoom:readGame(id);
    incomingRoom=null;
    if(cached)roomView(cached);
    else emptyStage(boardSize).innerHTML='<div class="side-content">Connexion au goban…</div>';
    pollRoom(id,version);
  }
  else if(key==='rejoindre'){
    const side=emptyStage(boardSize);
    side.innerHTML=`<div class="panel-head"><h2>Invitation à jouer</h2></div><div class="side-content">${btn('Rejoindre la partie','join','friends',true)}</div>`;
    try{const info=await requestRoom('/'+id+'/preview');if(version===routeVersion)side.querySelector('.side-content').insertAdjacentHTML('afterbegin',`<p>${info.n} × ${info.n} · ${Cadences.label(info.cadence)}</p>`)}catch(err){if(version===routeVersion)toast(err.message)}
  }else if(key==='invitation'){receive(id);return}
  else if(key==='partie'||key==='etude'){
    game=readGame(id);if(!game){location.replace('#jouer');return}
    if(game.mode==='online'&&key==='partie'){location.replace('#salon/'+id);return}
    if(key==='etude'||game.mode==='study'){
      header('analyse');main.setAttribute('aria-label','Analyse');
      openReview(game,view==='lignes'?linePly(game):twoPasses(game.moves)?game.moves.length-2:game.moves.length,view==='lignes');
    }else{position=game.moves.length;drawGame()}
  }else if(key==='amis'){friendsPage()}
  else if(key==='analyse'&&lastReview&&displayedGame?.id===lastReview.source.id&&$('#live-goban')?.dataset.position===lastReview.board){
    reviewing=true;reviewSource=lastReview.source;game=lastReview.game;
    position=lastReview.position;forkPosition=lastReview.forkPosition;reviewOverview=lastReview.overview;
    MoveReview.begin(reviewSource);drawGame();if(!reviewOverview)LocalAnalysis.enable();
  }
  else if(key==='analyse'&&hadBoard&&displayedGame&&readGame(displayedGame.id)&&readGame(displayedGame.id).ready!==false){
    const source=readGame(displayedGame.id);
    const index=displayedGame.position;
    openReview(source,index);
  }
  else if(key==='analyse'&&hadBoard&&displayedSetup)showSetup();
  else if(key==='analyse')openReview(newGame(boardSize,'study',''),0);
  else if(key==='bibliotheque')library();
  else if(key==='position')openSetup();
  else {
    const current=hadBoard&&key==='jouer'&&displayedGame?readGame(displayedGame.id):null;
    if(current&&current.mode!=='study'&&displayedGame.position===current.moves.length){
      if(current.mode==='online'){location.replace('#salon/'+current.id);return}
      history.replaceState(null,'','#partie/'+current.id);
      game=current;position=current.moves.length;drawGame();
    }else lobby(key==='jouer'&&hadBoard);
  }
  if(!hadBoard||!$('#board-desk'))window.scrollTo(0,0);
}
document.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button)return;
  const {point,place,action}=button.dataset;
  if(button.dataset.playTab){playTab=button.dataset.playTab;lobby(true);document.querySelector('[data-play-tab="'+playTab+'"]').focus({preventScroll:true});return}
  if(button.dataset.size){boardSize=+button.dataset.size;save('board-size',boardSize);lobby();return}
  if(place!==undefined){setupBoard.start[+place]=brush;showSetup();return}
  if(button.dataset.brush!==undefined){brush=+button.dataset.brush;showSetup();return}
  if(point!==undefined){if(reviewing){MoveReview.manual();exploreLine([+point])}else if(game.mode==='online')await onlineMove(+point);else move(+point);return}
  if(!action)return;
  const [a,id]=action.split(':');
  switch(a){
    case 'close':modal.close();break;
    case 'new':case 'home':location.hash='nouvelle';break;
    case 'queue':case 'bot':await startMode(a);break;
    case 'challenge':await startMode('invite');break;
    case 'explore-review':switchReview(false);break;
    case 'review-overview':switchReview(true);break;
    case 'library':location.hash='bibliotheque';break;
    case 'add':case 'profile':case 'login':case 'register':case 'logout':case 'unfriend':case 'remove':case 'accept':case 'friend-game':case 'send-game':case 'accept-room':case 'decline-room':await clubAction(a,id);break;
    case 'import':modal.close();$('#sgf-input').click();break;
    case 'setup':location.hash='position';break;
    case 'finish-setup':launch(setupBoard);break;
    case 'step':position=+id;drawGame();break;
    case 'review':location.hash='etude/'+id;break;
    case 'original':MoveReview.manual();returnToRecord();break;
    case 'branch':{
      const g={...newGame(game.n,'study',''),first:game.first,start:game.start,komi:game.komi,rules:game.rules,
        moves:game.moves.slice(0,position),title:'Variante · '+gameTitle(game).replace(/^Variante · /,'')};
      launch(g);break;
    }
    case 'retry-bot':BotPlayers.stop();drawGame();break;
    case 'resign':popup('Abandonner la partie ?',`<p>Votre adversaire remportera la partie.</p><div class="actions">${btn('Continuer à jouer','close')}${btn('Confirmer l’abandon','confirm-resign')}</div>`);break;
    case 'confirm-resign':await resign();break;
    case 'pass':if(reviewing){MoveReview.manual();exploreLine([-1])}else if(game.mode==='online')await onlineMove(-1);else move(-1);break;
    case 'share':share();break;
    case 'copy':{
      const field=$('#url');field.select();try{await navigator.clipboard.writeText(field.value);toast('Lien copié.')}catch{toast('Le lien est sélectionné pour la copie.')}break;
    }
    case 'cancel-room':try{await requestRoom('/'+activeRoom.id+'/cancel',{});games=games.filter(g=>g.id!==activeRoom.id);persistGames();location.hash='nouvelle'}catch(err){toast(err.message)}break;
    case 'join':if(!requireAccount(()=>document.querySelector('[data-action=join]')?.click()))return;try{enterRoom(await requestRoom('/'+location.hash.split('/')[1]+'/join',{name}))}catch(err){toast(err.message)}break;
  }
});
document.addEventListener('keydown',event=>{
  if(!reviewing||reviewOverview||modal.open||event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,select,textarea'))return;
  if(event.key==='Escape'&&forkPosition!==null){MoveReview.manual();returnToRecord();return}
  const step={ArrowLeft:-1,ArrowRight:1}[event.key];
  if(step){event.preventDefault();position=Math.max(0,Math.min(game.moves.length,position+step));drawGame()}
});
window.addEventListener('hashchange',route);bootClub();

