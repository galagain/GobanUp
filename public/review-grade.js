const fmt=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1});
const coordinate=(p,n)=>p===-1?'la passe':'ABCDEFGHJKLMNOPQRST'[p%n]+(n-Math.floor(p/n));

export function quality(preferred,loss,drop,beforeWin){
  const leadLost=beforeWin>=.55 && beforeWin-drop<=.45;
  if(drop>=.20 && (leadLost||loss>=3))return 'blunder';
  if((drop>=.12&&loss>=2)||(loss>=6&&drop>=.08))return 'mistake';
  if(loss>=1||drop>=.05)return 'inaccuracy';
  return preferred?'best':'good';
}

function missedCapture(Go,g,states,ply,color,alternative){
  const p=g.moves[ply],reply=g.moves[ply+1],n=g.n;
  if(alternative<0 || alternative===p || reply===undefined)return;
  const board=states[ply],answered=states[ply+2];
  const best=Go.play(board,alternative,color,n,states.slice(0,ply+1));
  if(!best||best.captured<2)return;
  const targets=[];
  for(let i=0;i<board.length;i++)if(board[i]===3-color&&!best.board[i])targets.push(i);
  if(!targets.every(i=>answered[i]===3-color))return;
  const retry=Go.play(answered,alternative,color,n,states.slice(0,ply+3));
  if(retry&&targets.some(i=>!retry.board[i]))return;
  return `${coordinate(alternative,n)} capturait ${best.captured} pierres. La réponse adverse ${coordinate(reply,n)} a écarté cette capture.`;
}
function sacrifice(Go,g,states,ply,color){
  const p=g.moves[ply],follow=states[ply+3];
  if(p<0||!follow)return;
  const placed=states[ply+1],reply=states[ply+2];
  const stones=Go.group(placed,p,g.n).stones;
  if(stones.size<2||![...stones].every(i=>reply[i]===0))return;
  let taken=0;
  for(let i=0;i<reply.length;i++)if(reply[i]===3-color&&!follow[i])taken++;
  if(taken>stones.size)return `Sacrifice de ${stones.size} pierres, suivi d’une capture de ${taken} pierres en ${coordinate(g.moves[ply+2],g.n)}.`;
}

export function evaluatePly({Go,g,states,ply,before,after}){
  const color=(g.first-1+ply)%2+1,black=color===1,p=g.moves[ply];
  const start={score:black?before.score:-before.score,win:black?before.win:1-before.win};
  const played={move:p,score:black?after.score:-after.score,win:black?after.win:1-after.win};
  const loss=Math.max(0,+(start.score-played.score).toFixed(5)),drop=Math.max(0,+(start.win-played.win).toFixed(6));
  let badge=quality(p===before.move,loss,drop,start.win);
  let explanation;
  if(loss>=1 && start.win>=.5 && played.win<.5){
    explanation=missedCapture(Go,g,states,ply,color,before.move);
    if(explanation)badge='missed';
  }else if(played.win-start.win>=.12 && played.score-start.score>=2){
    explanation=sacrifice(Go,g,states,ply,color);
    if(explanation)badge='brilliant';
  }
  if(!explanation){
    if(badge==='best')explanation='Premier choix du modèle dans cette position.';
    else if(badge==='good')explanation='Le coup conserve l’évaluation de la position.';
    else explanation=loss>=1?`Perte estimée de ${fmt.format(loss)} point${loss>=2?'s':''} pour ${black?'Noir':'Blanc'}.`:
      `Chances de victoire de ${black?'Noir':'Blanc'} en baisse de ${fmt.format(drop*100)} points de pourcentage.`;
  }
  const crossed=[.25,.45,.55,.75].some(v=>start.win>=v && played.win<v);
  const turning=badge==='brilliant'||(['mistake','blunder','missed'].includes(badge)&&loss>=2&&drop>=.15&&crossed);
  return {ply:ply+1,color,badge,explanation,loss,drop,before:start,played,suggestion:before.move,after,turning};
}
