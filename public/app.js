
'use strict';
const $=s=>document.querySelector(s);
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={home:'<path d="m3 10 9-7 9 7v10h-6v-6H9v6H3z"/>',play:'<path d="M4 8h16M4 16h16M8 4v16M16 4v16"/><circle cx="8" cy="8" r="2.9" fill="currentColor"/><circle cx="16" cy="16" r="2.9" fill="currentColor"/>',analysis:'<path d="M3 4v16h18M6 15l5-6 4 3 6-8"/>',friends:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5"/>',book:'<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14"/>',down:'<path d="m6 9 6 6 6-6"/>',right:'<path d="m9 5 7 7-7 7"/>',left:'<path d="m15 5-7 7 7 7"/>',first:'<path d="M5 5v14m13-14-7 7 7 7"/>',last:'<path d="M19 5v14M6 5l7 7-7 7"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',bolt:'<path d="M13 2 4 14h7l-1 8L21 9h-8z"/>',stones:'<circle cx="9" cy="9" r="5"/><path d="M15 8a6 6 0 1 1-7 7"/>',share:'<path d="M9 15l6-6m-8 3-2 2a4 4 0 0 0 6 6l3-3m-4-10 3-3a4 4 0 0 1 6 6l-2 2"/>'};
const icon=(name,small=false)=>`<svg aria-hidden="true" class="${small?'small-icon':'ico'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name]||''}</svg>`;
const get=(k,f)=>{try{return JSON.parse(localStorage.getItem('gobanup.'+k))??f}catch{return f}};
const save=(k,v)=>localStorage.setItem('gobanup.'+k,JSON.stringify(v));
let games=get('games',[]),friends=get('friends',[]),name=get('name','Joueur'),game,position=0,reviewing=false,timer;
const main=$('#main'),modal=$('#modal');
function toast(text){$('#toast').textContent=text;$('#toast').className='show';clearTimeout(timer);timer=setTimeout(()=>$('#toast').className='',3200)}
function popup(title,body){modal.innerHTML=`<button type="button" class="close" aria-label="Fermer" data-action="close">${icon('close')}</button><h2>${title}</h2>${body}`;if(!modal.open)modal.showModal()}
modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close()}});
const routes=[['jouer','stones','Jouer'],['analyse','analysis','Analyse'],['amis','friends','Amis']];
function header(route){
  $('#nav').innerHTML=routes.map(([key,i,label])=>`<a href="#${key}" class="${key===route?'active':''}" ${key===route?'aria-current="page"':''}>${icon(i)}${label}</a>`).join('');
  $('#profile').innerHTML=`<span class="avatar">${safe(name.slice(0,1).toUpperCase())}</span><span>${safe(name)}</span>${icon('down',true)}`;
}
function page(title,subtitle='',action=''){return `<div class="page-title"><div><h1>${title}</h1>${subtitle?`<p>${subtitle}</p>`:''}</div>${action}</div>`}
function btn(label,act,i='',primary=false){return `<button class="btn ${primary?'primary':''}" data-action="${act}">${i?icon(i):''}${label}</button>`}
function newGame(n,mode,opponent){return {id:crypto.randomUUID(),n,mode,opponent,moves:[],date:Date.now()}}
function saveGame(){games=[game,...games.filter(g=>g.id!==game.id)].slice(0,80);save('games',games)}
const demos=[{id:'opening',title:'Les premiers coups',n:19,moves:[60,300,72,288,244,270,41,319,110,249]},{id:'atari',title:'Comprendre l’atari',n:9,moves:[39,40,31,50,41,51,49]}];
function gameTitle(g){return g.title||({bot:'Partie rapide',local:'Partie à deux',online:'Partie en ligne',link:'Partie par correspondance'}[g.mode]||'Étude libre')}
const turnAt=(g,i)=>((g.first===2?1:0)+i)%2+1;
function makeStates(g){let board=g.start?g.start.slice():Array(g.n*g.n).fill(0);const states=[board],caps=[[0,0]];for(let i=0;i<g.moves.length;i++){let cap=caps[i].slice();if(g.moves[i]!==-1){const r=Go.play(board,g.moves[i],turnAt(g,i),g.n,states);if(!r)throw Error('Coup incorrect');board=r.board;cap[turnAt(g,i)-1]+=r.captured}states.push(board);caps.push(cap)}return {states,caps}}
const ended=g=>g.moves.length>=2&&g.moves.slice(-2).every(m=>m===-1);
const coord=(p,n)=>p===-1?'Passe':'ABCDEFGHJKLMNOPQRST'[p%n]+(n-Math.floor(p/n));
function boardSvg(board,n,last=-1,keys=false){const e=12,side=100,gap=(side-2*e)/(n-1),axis=v=>e+v*gap,rad=gap*.455;let lines='',dots='',stones='',labels='';
for(let i=0;i<n;i++){const v=axis(i);lines+=`M${v} ${e}V${side-e}M${e} ${v}H${side-e}`;if(keys)labels+=`<text x="${v}" y="6.5">${'ABCDEFGHJKLMNOPQRST'[i]}</text><text x="5.6" y="${v+1.05}">${n-i}</text>`}
const marks=n===9?[2,4,6]:n===13?[3,6,9]:[3,9,15];for(const i of marks)for(const j of marks)if(n===19||(i===marks[1])===(j===marks[1]))dots+=`<circle cx="${axis(i)}" cy="${axis(j)}" r="${gap*.115}"/>`;
board.forEach((v,i)=>{if(!v)return;const x=axis(i%n),y=axis(Math.floor(i/n));stones+=`<circle cx="${x+.28}" cy="${y+.5}" r="${rad}" fill="#5b402b66"/><circle cx="${x}" cy="${y}" r="${rad}" fill="${v===1?'url(#stoneB)':'url(#stoneW)'}" stroke="${v===1?'#161714':'#dbd4c4'}" stroke-width=".18"/>`;if(last===i)stones+=`<circle cx="${x}" cy="${y}" r="${rad*.34}" fill="none" stroke="${v===1?'#eee':'#4a493e'}" stroke-width="${gap*.09}"/>`});
return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="stoneB" cx="34%" cy="24%" r="77%"><stop stop-color="#54554e"/><stop offset=".55" stop-color="#282a26"/><stop offset="1" stop-color="#141513"/></radialGradient><radialGradient id="stoneW" cx="34%" cy="24%" r="77%"><stop stop-color="#fffef6"/><stop offset=".72" stop-color="#f0ecdf"/><stop offset="1" stop-color="#d6d0c0"/></radialGradient></defs><path d="${lines}" fill="none" stroke="#745934" stroke-width="${n===19?.16:.28}"/><g fill="#5d482d">${dots}</g><g fill="#665136" font-family="sans-serif" font-size="${n===19?2.2:3}" text-anchor="middle">${labels}</g>${stones}</svg>`}
let autoAnalyze=null;
function launch(g){game=g;if(g.mode==='link')game.seat=1;saveGame();modal.close();location.hash='partie/'+g.id}
function readGame(id){return games.find(g=>g.id===id)||demos.find(g=>g.id===id)}
function shareUrl(){const {id,n,moves,opponent}=game;const payload={id,n,moves,opponent:game.seat===1?name:opponent,seat:3-game.seat};return location.href.split('#')[0]+'#invitation/'+encodeURIComponent(JSON.stringify(payload))}
function share(){popup('Transmettre la partie',`<p>Envoyez ce lien à votre partenaire pour qu’il ouvre le goban et joue son coup.</p><label for="url">Lien de la position</label><textarea id="url" readonly rows="3">${safe(shareUrl())}</textarea><div class="actions">${btn('Copier le lien','copy','share',true)}</div>`)}
function receive(raw){try{const data=JSON.parse(decodeURIComponent(raw));const {id,n,moves,seat}=data;if(!/^[a-f0-9-]{36}$/.test(id)||![9,13,19].includes(n)||![1,2].includes(seat)||!Array.isArray(moves)||moves.length>3000||!moves.every(p=>Number.isInteger(p)&&p>=-1&&p<n*n))throw Error();const old=games.find(g=>g.id===id);let g={id,n,moves,seat,mode:'link',date:Date.now(),opponent:String(data.opponent||'Partenaire').slice(0,32)};makeStates(g);if(old){if(old.mode!=='link'||old.n!==n||!moves.slice(0,Math.min(old.moves.length,moves.length)).every((m,i)=>old.moves[i]===m))throw Error();if(old.moves.length>=moves.length||old.seat!==seat)g=old}game=g;saveGame();location.replace('#partie/'+id)}catch{toast('Ce lien de partie est invalide.');location.replace('#jouer')}}
function drawGame(){const {states,caps}=makeStates(game),n=game.n,b=states[position],color=turnAt(game,position),finished=position>=2&&game.moves.slice(position-2,position).every(p=>p===-1),interactive=!reviewing&&!finished&&(game.mode!=='bot'||color===1)&&(!['online','link'].includes(game.mode)||game.seat===color);let dots='';
if(interactive){for(let p=0;p<b.length;p++){if(b[p])continue;const scale=76/(n-1);dots+=`<button style="left:${12+(p%n)*scale}%;top:${12+Math.floor(p/n)*scale}%;width:${scale}%;height:${scale}%" data-point="${p}" aria-label="Jouer en ${coord(p,n)}"></button>`}}
const title=gameTitle(game);const titleAct=reviewing?btn('Carnet d’analyse','library','book'):btn('Modes de jeu','home','play');
const score=finished?Go.score(b,n,game.komi):null;const status=finished?`Score sur le goban · Noir ${score[1]} / Blanc ${String(score[2]).replace('.',',')}`:color===1?'Aux noirs de jouer':'Aux blancs de jouer';
main.innerHTML=page(safe(title),`${n} × ${n} · ${reviewing?'Analyse de la position':game.mode==='online'?safe(game.black)+' contre '+safe(game.white):game.mode==='link'?'Par correspondance':game.mode==='bot'?'Contre l’ordinateur':game.mode==='study'?'Analyse libre':'Sur cet appareil'}`,titleAct)+`<div class="game-layout"><div class="board-wrap"><div class="board" aria-label="Goban ${n} par ${n}">${boardSvg(b,n,game.moves[position-1],true)}${dots}</div></div><aside class="panel side"><h2>${reviewing?'Naviguer dans la partie':'La partie'}</h2><div class="turn"><i class="stone ${color===2?'white':''}"></i>${status}</div><p>Coup ${position}${position?' · '+coord(game.moves[position-1],n):''}<br>Captures · Noir ${caps[position][0]} / Blanc ${caps[position][1]}</p>${reviewing?`<div class="line"></div><div class="move-nav">${[['first',0],['left',Math.max(0,position-1)],['right',Math.min(game.moves.length,position+1)],['last',game.moves.length]].map(([i,d],ix)=>`${ix===2?`<span>${position} / ${game.moves.length}</span>`:''}<button class="btn" aria-label="${['Début','Coup précédent','Coup suivant','Fin'][ix]}" data-action="step:${d}" ${d===position?'disabled':''}>${icon(i,true)}</button>`).join('')}</div><input aria-label="Position dans la partie" type="range" min="0" max="${game.moves.length}" value="${position}" id="slider"><div class="actions">${btn('Tester une variante','branch','analysis')}</div>`:`<div class="line"></div>${game.mode==='link'?`<p>${game.seat===color&&!finished?'À vous de jouer.':'Transmettez la position à votre partenaire.'}</p>`:''}<div class="actions">${interactive?btn('Passer','pass'):''}${game.mode==='link'&&(game.seat!==color||finished)?btn('Transmettre le lien','share','share',true):''}${btn('Analyser','review:'+game.id,'analysis')}</div>`}${reviewing||game.mode==='study'?'<section id="local-analysis"></section>':''}</aside></div>`;if($('#local-analysis'))LocalAnalysis.mount(game,position,states);if($('#slider'))$('#slider').oninput=e=>{position=+e.target.value;drawGame();$('#slider').focus()}}
function move(p){const st=makeStates(game).states,color=turnAt(game,game.moves.length);if(ended(game)||reviewing||game.mode==='link'&&game.seat!==color)return;const result=p===-1?null:Go.play(st.at(-1),p,color,game.n,st);if(p!==-1&&!result){toast('Coup interdit sur cette intersection.');return}game.moves.push(p);
if(game.mode==='bot'&&!ended(game)){const boards=makeStates(game).states,b=boards.at(-1);let best=-Infinity,choice=-1;if(p!==-1){for(let q=0;q<b.length;q++){const r=Go.play(b,q,2,game.n,boards);if(!r)continue;const g=Go.group(r.board,q,game.n);const adj=Go.adjacent(q,game.n);if(adj.every(v=>b[v]===2)&&!r.captured)continue;const score=r.captured*(game.level==='easy'?2:12)+Math.random()*(game.level==='easy'?12:4)+adj.filter(i=>b[i]===1).length*.7+(g.liberties.size===1?-7:0)-Math.abs((q%game.n)-(game.n-1)/2)*.06;if(score>best){best=score;choice=q}}}game.moves.push(choice)}
position=game.moves.length;saveGame();drawGame()}

Object.assign(paths,{
 globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7.5h14M5 16.5h14"/>',
 bot:'<rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 7V4m-2 12h4M1.5 11.5v4m21-4v4"/><circle cx="12" cy="3" r="1"/><circle cx="8.5" cy="12" r=".8" fill="currentColor"/><circle cx="15.5" cy="12" r=".8" fill="currentColor"/>',
 file:'<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 15h6m-3-3v6"/>',
 edit:'<path d="M4 5h12M4 10h7M4 15h4m3 5 1-5 7-7 4 4-7 7z"/>',
 arrow:'<path d="M6 18 18 6M6 6h12v12"/>',
 stones:'<circle cx="9" cy="9" r="6"/><path d="M16 8.5a6 6 0 1 1-7.5 7.5"/>'
});
const artTile=(iconName)=>`<span class="mode-art">${icon(iconName)}</span>`;
function optionCard(title,description,glyph,action){
  return `<button class="mode-card" data-action="${action}">${artTile(glyph)}<span><strong>${title}</strong><small>${description}</small></span>${icon('right',true)}</button>`;
}
function row(g,link){
  return `<a class="record" href="#${link}/${g.id}"><span class="record-icon">${icon(g.mode==='bot'?'bot':g.mode==='online'?'globe':'play')}</span><span><strong>${safe(gameTitle(g))}</strong><small>${g.n} × ${g.n} · ${g.moves.length} coups</small></span>${icon('right',true)}</a>`;
}
function lobby(){
  const previous=games.filter(g=>g.mode!=='study'&&!ended(g));
  main.innerHTML=page('Jouer','Choisissez votre mode de jeu.')+
  `<section class="feature"><div class="feature-copy"><span class="hero-icon">${icon('globe')}</span><h2>Jouer en ligne</h2><p>Retrouvez un adversaire sur le goban.</p>${btn('Trouver un adversaire','queue','globe',true)}</div></section>
  <div class="mode-grid">${optionCard('Contre un bot','Entraînez-vous à votre rythme.','bot','bot')}${optionCard('Avec un ami','Invitez un partenaire à jouer.','friends','challenge')}</div>
  ${previous.length?`<section class="records"><h2>Reprendre une partie</h2>${previous.map(g=>row(g,g.mode==='online'?'salon':'partie')).join('')}</section>`:''}`;
}
function library(){
  main.innerHTML=page('Analyse','Explorez une partie ou construisez une position avec KataGo.')+
  `<div class="mode-grid first">${optionCard('Importer une partie','Ouvrir un fichier SGF.','file','import')}${optionCard('Définir une position','Placer les pierres sur le goban.','edit','setup')}</div>
  <input type="file" id="sgf-input" accept=".sgf,application/x-go-sgf" hidden>
  ${games.length?`<section class="records"><h2>Mes parties et études</h2>${games.map(g=>row(g,'etude')).join('')}</section>`:''}`;
  $('#sgf-input').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      if(file.size>2_000_000)throw Error('Le fichier dépasse 2 Mo.');
      game=importSgf(await file.text(),file.name);saveGame();location.hash='etude/'+game.id;
    }catch(err){popup('Import impossible',`<p>${safe(err.message)}</p>${btn('Choisir un autre fichier','import')}`)}
    e.target.value='';
  };
}
function friendsPage(){
  main.innerHTML=page('Amis','Vos partenaires de jeu.',btn('Ajouter un ami','add','plus',true))+
  (friends.length?`<div class="panel">${friends.map((f,i)=>`<div class="friend-row"><span class="avatar">${safe(f.slice(0,1).toUpperCase())}</span><strong>${safe(f)}</strong>${btn('Inviter','challenge:'+i,'friends')}</div>`).join('')}</div>`:
    `<div class="empty-panel">${artTile('friends')}<h2>Votre liste d’amis est vide</h2><p>Ajoutez un pseudo pour retrouver vos partenaires sur cet appareil.</p></div>`);
}
function sizeOptions(initial){
  return `<fieldset><legend>Taille du goban</legend><div class="options">${[9,13,19].map(n=>`<label><input type="radio" name="size" value="${n}" ${n===initial?'checked':''}><span>${n} × ${n}</span></label>`).join('')}</div></fieldset>`;
}
function startForm(mode,friend){
  const isBot=mode==='bot';
  const title=isBot?'Jouer contre un bot':mode==='queue'?'Jouer en ligne':'Jouer avec un ami';
  popup(title,`<form id="start">${sizeOptions(isBot?9:19)}${isBot?'<label for="level">Niveau du bot</label><select id="level"><option value="easy">Découverte</option><option value="normal">Tactique</option></select>':
    mode==='invite'?`<p>${friend?`Envoyez le lien à ${safe(friend)} pour jouer ensemble.`:'Partagez un lien pour jouer à deux sur le même goban.'}</p>`:'<p>La partie commence dès qu’un autre joueur recherche cette taille de goban.</p>'}<p role="status" class="error"></p><button class="btn primary" type="submit">${isBot?'Commencer':mode==='queue'?'Chercher un adversaire':'Créer une invitation'}</button></form>`);
  const ticket=crypto.randomUUID();
  $('#start').onsubmit=async e=>{
    e.preventDefault();const form=e.currentTarget,n=+new FormData(form).get('size');
    if(isBot){const g=newGame(n,'bot','Ordinateur');g.level=$('#level').value;launch(g);return}
    const submit=form.querySelector('button[type=submit]');submit.disabled=true;
    try{const room=await requestRoom('',{kind:mode,n,ticket,name});modal.close();enterRoom(room)}
    catch(err){form.querySelector('.error').textContent=err.message;submit.disabled=false}
  };
}
function identity(profile){
  popup(profile?'Mon profil':'Ajouter un ami',`<form id="identity"><label for="nickname">${profile?'Votre pseudo':'Pseudo du partenaire'}</label><input id="nickname" required maxlength="32" value="${profile?safe(name):''}" autocomplete="off"><p class="error" role="status"></p><button class="btn primary">${profile?'Enregistrer':'Ajouter'}</button></form>`);
  $('#identity').onsubmit=e=>{
    e.preventDefault();const value=$('#nickname').value.trim();
    if(!value)return;
    if(profile){name=value;save('name',name);header($('#nav .active')?.hash.slice(1)||'jouer')}
    else{
      if(friends.some(f=>f.toLocaleLowerCase()===value.toLocaleLowerCase())){$('#identity .error').textContent='Ce pseudo figure déjà dans votre liste.';return}
      friends.push(value);save('friends',friends);friendsPage();
    }
    modal.close();
  };
}
let setupBoard,brush=1;
function openSetup(){setupBoard=newGame(19,'study','');setupBoard.start=Array(361).fill(0);setupBoard.first=1;setupBoard.title='Position libre';brush=1;showSetup()}
function showSetup(){
  const n=setupBoard.n,step=76/(n-1);
  const hits=setupBoard.start.map((v,p)=>`<button data-place="${p}" aria-label="${coord(p,n)} · ${['Vide','Noir','Blanc'][v]}" style="left:${12+(p%n)*step}%;top:${12+Math.floor(p/n)*step}%;width:${step}%;height:${step}%"></button>`).join('');
  main.innerHTML=page('Définir une position','Placez les pierres, puis choisissez qui joue.')+
  `<div class="game-layout"><div class="board-wrap"><div class="board">${boardSvg(setupBoard.start,n,-1,true)}${hits}</div></div><aside class="panel side">
  <label for="editor-size">Taille du goban</label><select id="editor-size">${[9,13,19].map(v=>`<option value="${v}" ${v===n?'selected':''}>${v} × ${v}</option>`).join('')}</select>
  <fieldset><legend>Outil</legend><div class="actions">${[1,2,0].map(v=>`<button class="btn" data-brush="${v}" aria-pressed="${v===brush}">${['Effacer','● Noir','○ Blanc'][v]}</button>`).join('')}</div></fieldset>
  <label for="next">Au trait</label><select id="next"><option value="1">Noir</option><option value="2">Blanc</option></select>
  <div class="actions">${btn('Analyser la position','finish-setup','analysis',true)}</div></aside></div>`;
  $('#next').value=setupBoard.first;$('#next').onchange=e=>setupBoard.first=+e.target.value;
  $('#editor-size').onchange=e=>{
    const size=+e.target.value;
    if(setupBoard.start.some(Boolean)&&!confirm('Changer de taille effacera les pierres placées. Continuer ?')){showSetup();return}
    setupBoard.n=size;setupBoard.start=Array(size*size).fill(0);showSetup();
  };
}
let pollTimer,routeVersion=0,activeRoom,pendingMove=false;
async function requestRoom(suffix,payload){
  let key=get('session',null);if(!key){key=crypto.randomUUID();save('session',key)}
  const res=await fetch('/api/rooms'+suffix,{method:payload?'POST':'GET',cache:'no-store',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined});
  if(!res.headers.get('content-type')?.includes('application/json'))throw Error('Le service de jeu en ligne est indisponible.');
  const data=await res.json();if(!res.ok)throw Error(data.error||'Connexion interrompue.');return data;
}
function enterRoom(r){location.hash='salon/'+r.id}
function roomView(r){
  if(activeRoom?.id===r.id&&(r.revision<activeRoom.revision||activeRoom.ready&&!r.ready)) return;
  const waiting=!r.ready;
  activeRoom=r;
  if(waiting){
    game={...r,mode:'online',date:Date.now()};saveGame();
    const link=location.href.split('#')[0]+'#rejoindre/'+r.id;
    main.innerHTML=page(r.kind==='queue'?'Recherche d’un adversaire':'Invitation à jouer',`Goban ${r.n} × ${r.n}`)+
      `<section class="panel waiting">${artTile(r.kind==='queue'?'globe':'friends')}<h2>${r.kind==='queue'?'En attente d’un joueur…':'En attente de votre ami'}</h2><p>${r.kind==='queue'?'Gardez cette page ouverte. La partie démarrera automatiquement.':'Partagez ce lien avec votre partenaire.'}</p>${r.kind==='invite'?`<input id="url" aria-label="Lien d’invitation" readonly value="${safe(link)}">${btn('Copier le lien','copy','share')}`:''}<div class="actions">${btn('Annuler','cancel-room')}</div></section>`;
  }else{
    game={...r,mode:'online',date:Date.now()};position=r.moves.length;saveGame();drawGame();
  }
}
async function pollRoom(id,version){
  if(version!==routeVersion)return;
  try{
    const r=await requestRoom('/'+id);
    if(version!==routeVersion)return;
    if(!activeRoom||r.revision>activeRoom.revision||r.ready&&!activeRoom.ready)roomView(r);
    $('#network-message')?.remove();
    if(r.ready&&ended(r))return;
  }catch(err){
    if(version!==routeVersion)return;
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
async function route(){
  LocalAnalysis.detach();modal.close();clearTimeout(pollTimer);const version=++routeVersion;
  activeRoom=null;reviewing=false;
  const [key,id]=location.hash.slice(1).split('/');
  header(['etude','position','analyse'].includes(key)?'analyse':key==='amis'?'amis':'jouer');
  if(key==='salon'){main.innerHTML=page('Partie en ligne','Connexion au goban…');pollRoom(id,version)}
  else if(key==='rejoindre'){
    main.innerHTML=page('Invitation à jouer','Rejoignez le goban de votre partenaire.',btn('Rejoindre la partie','join','friends',true));
  }else if(key==='invitation'){receive(id);return}
  else if(key==='partie'||key==='etude'){
    game=readGame(id);if(!game){location.replace('#jouer');return}
    if(game.mode==='online'&&key==='partie'){location.replace('#salon/'+id);return}
    reviewing=key==='etude';if(game.mode==='study')header('analyse');position=game.moves.length;drawGame();
    if(autoAnalyze===game.id){autoAnalyze=null;document.querySelector('[data-kata=run]')?.click()}
  }else if(key==='amis')friendsPage();
  else if(key==='analyse')library();
  else if(key==='position')openSetup();
  else lobby();
  window.scrollTo(0,0);
}
document.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button)return;
  const {point,place,action}=button.dataset;
  if(place!==undefined){setupBoard.start[+place]=brush;showSetup();return}
  if(button.dataset.brush!==undefined){brush=+button.dataset.brush;showSetup();return}
  if(point!==undefined){if(game.mode==='online')await onlineMove(+point);else move(+point);return}
  if(!action)return;
  const [a,id]=action.split(':');
  switch(a){
    case 'close':modal.close();break;
    case 'new':case 'home':location.hash='jouer';break;
    case 'queue':case 'bot':startForm(a);break;
    case 'challenge':startForm('invite',friends[+id]);break;
    case 'library':location.hash='analyse';break;
    case 'add':case 'profile':identity(a==='profile');break;
    case 'import':modal.close();$('#sgf-input').click();break;
    case 'setup':location.hash='position';break;
    case 'finish-setup':autoAnalyze=setupBoard.id;launch(setupBoard);break;
    case 'step':position=+id;drawGame();break;
    case 'review':location.hash='etude/'+id;break;
    case 'branch':{
      const g={...game,...newGame(game.n,'study',''),moves:game.moves.slice(0,position),title:'Variante · '+gameTitle(game).replace(/^Variante · /,'')};launch(g);break;
    }
    case 'pass':if(game.mode==='online')await onlineMove(-1);else move(-1);break;
    case 'share':share();break;
    case 'copy':{
      const field=$('#url');field.select();try{await navigator.clipboard.writeText(field.value);toast('Lien copié.')}catch{toast('Le lien est sélectionné pour la copie.')}break;
    }
    case 'cancel-room':try{await requestRoom('/'+activeRoom.id+'/cancel',{});games=games.filter(g=>g.id!==activeRoom.id);save('games',games);location.hash='jouer'}catch(err){toast(err.message)}break;
    case 'join':try{enterRoom(await requestRoom('/'+location.hash.split('/')[1]+'/join',{name}))}catch(err){toast(err.message)}break;
  }
});
window.addEventListener('hashchange',route);route();

