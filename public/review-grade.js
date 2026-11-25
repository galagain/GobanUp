const letters='ABCDEFGHJKLMNOPQRST';
export const coordinate=(p,n)=>p===-1?'pass':letters[p%n]+(n-Math.floor(p/n));
export const side=(g,i)=>((g.first-1+i)%2)+1;
const french=p=>p==='pass'?'la passe':p;
function point(text,n){
  if(text==='pass')return -1;
  const m=/^([A-HJ-T])(\d{1,2})$/.exec(text);
  if(!m)return null;
  const x=letters.indexOf(m[1]),y=n-Number(m[2]);
  return x<n&&y>=0&&y<n?y*n+x:null;
}
export function play(Go,history,p,color,n){
  if(p===-1)return {board:history.at(-1),captured:0};
  return Go.play(history.at(-1),p,color,n,history);
}
function candidate(move,pv,estimate,g,history,ply,Go){
  if(!Number.isFinite(estimate.score)||!Number.isFinite(estimate.win))throw Error('Évaluation moteur incomplète');
  const steps=[],line=history.slice(),moves=[];
  const continuation=pv.map(text=>point(text.toLowerCase()==='pass'?'pass':text.toUpperCase(),g.n));
  if(continuation[0]!==move)continuation.unshift(move);
  for(const p of continuation.slice(0,10)){
    if(p===null)break;
    const next=play(Go,line,p,side(g,ply+moves.length),g.n);
    if(!next)break;
    steps.push(next);moves.push(p);line.push(next.board);
    if(p===-1 && (moves.length>1?moves.at(-2):g.moves[ply-1])===-1)break;
  }
  if(!moves.length)throw Error('Variante moteur illégale');
  const black=side(g,ply)===1;
  return {move,coord:coordinate(move,g.n),line:moves,steps,score:black?estimate.score:-estimate.score,
    win:black?estimate.win:1-estimate.win,visits:estimate.visits};
}
export function quality(same,loss,drop,bestWin){
  if(same)return 'best';
  const playedWin=bestWin-drop;
  const leadLost=bestWin>=.55 && playedWin<=.45;
  if(drop>=.20 && (leadLost || loss>=3))return 'blunder';
  if((drop>=.12 && loss>=2) || (loss>=6 && drop>=.08))return 'mistake';
  if(loss>=1 || drop>=.05)return 'inaccuracy';
  return 'good';
}
export function isTurningPoint(entry,previous){
  const shallow=Math.min(entry.best.visits,entry.played.visits,previous?.played.visits??Infinity)<12;
  const before=previous?(previous.color===entry.color?previous.played.win:1-previous.played.win):(entry.before||entry.best).win;
  const after=entry.played.win;
  const swing=Math.abs(before-after);
  if(entry.badge==='brilliant')return after-before>=.12;
  if(!['blunder','mistake','missed'].includes(entry.badge)||before<=after)return false;
  const crossed=[.25,.45,.55,.75].some(bound=>before>=bound&&after<bound);
  if(shallow)return entry.loss>=2 && entry.drop>=.15 && swing>=.15 && crossed;
  return entry.drop>=.08 && (swing>=.20 || (swing>=.10 && crossed));
}
function missedCapture(Go,g,ply,history,best,actual){
  const taken=best.steps[0].captured;
  if(taken<2 || actual.steps.length<2)return null;
  const color=side(g,ply),before=history.at(-1),afterBest=best.steps[0].board;
  const targets=[];
  for(let p=0;p<before.length;p++)if(before[p]===3-color&&!afterBest[p])targets.push(p);
  const reply=actual.steps[1].board;
  if(!targets.every(p=>reply[p]===3-color))return null;
  const retry=play(Go,[...history,actual.steps[0].board,reply],best.move,color,g.n);
  if(retry&&targets.some(p=>!retry.board[p]))return null;
  return `${best.coord} capturait ${taken} pierres. Après le coup joué, la réponse ${french(coordinate(actual.line[1],g.n))} écarte cette capture dans la variante.`;
}
function sacrifice(g,Go,best){
  if(best.move<0 || best.steps.length<3)return null;
  const [placed,reply,follow]=best.steps;
  const group=Go.group(placed.board,best.move,g.n);
  if(group.stones.size<2 || ![...group.stones].every(p=>reply.board[p]===0) ||
     follow.captured<=group.stones.size)return null;
  return `Dans la variante, ${best.coord} sacrifie ${group.stones.size} pierres puis ${coordinate(best.line[2],g.n)} en capture ${follow.captured}.`;
}
export function evaluatePly({Go,g,ply,history,before,after}){
  const color=side(g,ply),p=g.moves[ply],top=before.candidates[0];
  if(!top)throw Error('Aucun coup proposé par le moteur.');
  const bestMove=top.x<0?-1:top.y*g.n+top.x;
  const best=candidate(bestMove,top.pv,bestMove===p?after:{score:top.scoreLead,win:top.winRate,visits:top.visits},g,history,ply,Go);
  const playedLine=[coordinate(p,g.n),...(after.candidates[0]?.pv||[])];
  const actual=candidate(p,playedLine,after,g,history,ply,Go);
  const loss=Math.max(0,+(best.score-actual.score).toFixed(5)),drop=Math.max(0,+(best.win-actual.win).toFixed(6));
  const second=before.candidates[1];
  const brilliant=g.n===19 && bestMove===p && top.prior>=0 && top.prior<.02 && top.visits>=12 && second?.visits>=12 &&
    (top.scoreLead-second.scoreLead)*(color===1?1:-1)>=2 && sacrifice(g,Go,best);
  let badge=quality(best.move===p,loss,drop,best.win);
  let explanation;
  if(brilliant){badge='brilliant';explanation=brilliant}
  if(best.move!==p && loss>=1 && best.win>=0.5 && actual.win<0.5){
    const missed=missedCapture(Go,g,ply,history,best,actual);
    if(missed){badge='missed';explanation=missed}
  }
  const points=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(loss);
  if(!explanation){
    const captures=best.steps[0].captured;
    if(badge==='best')explanation=captures?`Premier choix de KataGo, ce coup capture ${captures} pierre${captures>1?'s':''}.`:'Premier choix de KataGo dans cette position.';
    else if(badge==='good')explanation=`Le résultat estimé est proche de celui de ${french(best.coord)}, premier choix du moteur.`;
    else {
      const who=color===1?'Noir':'Blanc';
      explanation=loss>=1
        ? `KataGo préfère ${french(best.coord)}. Le coup joué coûte environ ${points} point${loss>=2?'s':''} à ${who}.`
        : `KataGo préfère ${french(best.coord)}. Les chances de victoire de ${who} passent de ${Math.round(best.win*100)} % à ${Math.round(actual.win*100)} %.`;
    }
  }
  const compact=c=>({move:c.move,line:c.line,score:+c.score.toFixed(2),win:+c.win.toFixed(4),visits:c.visits});
  return {ply:ply+1,color,badge,explanation,before:{win:color===1?before.win:1-before.win,score:color===1?before.score:-before.score},loss:+loss.toFixed(2),drop:+drop.toFixed(4),best:compact(best),played:compact(actual)};
}
