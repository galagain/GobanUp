
'use strict';
function importSgf(input, fallbackName) {
  const text=input.trim().replace(/^\uFEFF/,'');
  if(text.length>2_000_000) throw Error('Le fichier dépasse 2 Mo.');
  let i=0,trees=0;
  const stack=[],nodes=[];
  const skip=()=>{while(i<text.length&&/\s/.test(text[i]))i++};
  const invalid=()=>{throw Error('Le fichier SGF est incomplet ou mal formé.')};
  while(i<text.length) {
    skip(); if(i===text.length)break;
    const token=text[i++];
    const parent=stack.at(-1);
    if(token==='('){
      const keep=parent?parent.keep&&parent.children++===0:trees++===0;
      stack.push({keep,children:0});continue;
    }
    if(token===')'){if(!stack.length)invalid();stack.pop();continue}
    if(token!== ';'||!parent) invalid();
    const node={};skip();
    while(i<text.length&&/[A-Za-z]/.test(text[i])){
      const begin=i;while(i<text.length&&/[A-Za-z]/.test(text[i]))i++;
      const key=text.slice(begin,i).toUpperCase();skip();
      if(text[i]!=='[')invalid();
      while(text[i]==='['){
        i++;let value='';
        while(i<text.length&&text[i]!==']'){
          let ch=text[i++];
          if(ch==='\\'){
            if(i===text.length)invalid();ch=text[i++];
            if(ch==='\r'||ch==='\n'){if(ch==='\r'&&text[i]==='\n')i++;continue}
          }
          value+=ch;
        }
        if(text[i++]!==']')invalid();
        (node[key]??=[]).push(value);skip();
      }
    }
    if(parent.keep)nodes.push(node);
  }
  if(stack.length||!nodes.length)invalid();
  const root=nodes[0];
  if(root.GM&&root.GM[0]!=='1')throw Error('Ce fichier ne contient pas une partie de go.');
  const n=Number(root.SZ?.[0]||19);
  if(![9,13,19].includes(n))throw Error('Les gobans pris en charge sont 9 × 9, 13 × 13 et 19 × 19.');
  const point=(s,pass=false)=>{
    if(pass&&(s===''||s==='tt'))return -1;
    if(!/^[a-s]{2}$/.test(s))invalid();
    const x=s.charCodeAt(0)-97,y=s.charCodeAt(1)-97;
    if(x>=n||y>=n)invalid();return y*n+x;
  };
  const start=Array(n*n).fill(0);
  for(const [key,value] of [['AB',1],['AW',2],['AE',0]])for(const pair of root[key]||[]){
    const [first,last]=pair.split(':');const a=point(first),b=point(last??first);
    for(let y=Math.floor(a/n);y<=Math.floor(b/n);y++)for(let x=a%n;x<=b%n;x++)start[y*n+x]=value;
  }
  const firstMove=nodes.find(node=>node.B||node.W);
  const first=root.PL?(root.PL[0]==='W'?2:1):firstMove?(firstMove.W?2:1):Number(root.HA?.[0])>=2?2:1;
  const g=newGame(n,'study','');
  const ru=root.RU?.[0]?.toLowerCase()||'';
  const rules=Object.entries({'japanese':'jap','korean':'kor','aga':'aga','new-zealand':'new zealand','tromp-taylor':'tromp'}).find(([,v])=>ru.startsWith(v))?.[0]||'chinese';
  const komi=Number(root.KM?.[0]??6.5);if(!Number.isFinite(komi))throw Error('Le komi du fichier est invalide.');
  Object.assign(g,{start,first,komi,rules,title:root.GN?.[0]||(root.PB&&root.PW?`${root.PB[0]} – ${root.PW[0]}`:fallbackName.replace(/\.sgf$/i,''))||'Partie importée'});
  nodes.forEach((node,index)=>{
    if(index&&(node.AB||node.AW||node.AE||node.PL))throw Error('Ce SGF modifie la position en cours de partie. Importez une ligne de jeu continue.');
    if(!node.B&&!node.W)return;
    if(g.moves.length>3000)throw Error('Cette partie dépasse la limite de 3 000 coups.');
    const color=node.B?1:2;
    if(turnAt(g,g.moves.length)!==color)throw Error('La suite de coups de ce fichier n’alterne pas les couleurs.');
    g.moves.push(point((node.B||node.W)[0],true));
  });
  makeStates(g);return g;
}

