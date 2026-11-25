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
function candidate(info,g,history,ply,Go){
  if(!info || !Number.isFinite(info.scoreLead) || !Number.isFinite(info.winrate) || !info.visits)
    throw Error('Évaluation moteur incomplète');
  const move=point(info.move,g.n), steps=[],line=history.slice(), moves=[];
  if (move===null) throw Error('Coordonnée moteur invalide');
  const pv=info.pv?.[0]===info.move?info.pv:[info.move,...(info.pv||[])];
  for(const text of pv.slice(0,10)){
    const p=point(text,g.n);
    if(p===null)break;
    const next=play(Go,line,p,side(g,ply+moves.length),g.n);
    if(!next)break;
    steps.push(next);moves.push(p);line.push(next.board);
    if(moves.length>=2&&moves.at(-1)===-1&&moves.at(-2)===-1)break;
  }
  if(!moves.length)throw Error('Variante moteur illégale');
  const black=side(g,ply)===1;
  return {move,coord:info.move,line:moves,steps,score:black?info.scoreLead:-info.scoreLead,
    win:black?info.winrate:1-info.winrate,visits:info.visits};
}
export function quality(same,loss,drop,bestWin){
  if(same)return 'best';
  if(loss>=6 || (bestWin>=0.30 && bestWin<=0.70 && drop>=0.20))return 'blunder';
  if(loss>=3 || drop>=0.15)return 'mistake';
  if(loss>=1 || drop>=0.05)return 'inaccuracy';
  return 'good';
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
  return `Dans la variante, ${best.coord} sacrifie ${group.stones.size} pierres puis ${coordinate(best.line[2],g.n)} en capture ${follow.captured}. Le choix est confirmé à recherche approfondie.`;
}
export async function evaluatePly({Go,g,ply,history,query}){
  const color=side(g,ply),p=g.moves[ply],played=coordinate(p,g.n);
  const ranked=async (visits,force)=> {
    const response=await query(visits,force);
    return {moves:[...response.moveInfos].sort((a,b)=>a.order-b.order),human:response.humanPolicy};
  };
  let {moves,human}=await ranked(96);
  let best=candidate(moves[0],g,history,ply,Go);
  const probability=human?.[p];
  let brilliant=null;
  if(g.n===19 && best.move===p && p>=0 && Number.isFinite(probability) && probability>=0 && probability<0.02 && sacrifice(g,Go,best)){
    ({moves}=await ranked(384));
    best=candidate(moves[0],g,history,ply,Go);
    const second=moves[1];
    if(best.move===p && second?.visits>=12 && (moves[0].scoreLead-second.scoreLead)*(color===1?1:-1)>=2)
      brilliant=sacrifice(g,Go,best);
  }
  if(best.visits<12)best=candidate((await ranked(48,best.coord)).moves[0],g,history,ply,Go);
  let actual=best;
  if(best.move!==p){
    let found=moves.find(m=>m.move===played);
    if(!found || found.visits<12)found=(await ranked(48,played)).moves[0];
    actual=candidate(found,g,history,ply,Go);
    if(actual.move!==p)throw Error('Le moteur n’a pas évalué le coup joué');
  }
  const loss=Math.max(0,+(best.score-actual.score).toFixed(5)),drop=Math.max(0,+(best.win-actual.win).toFixed(6));
  let badge=quality(best.move===p,loss,drop,best.win);
  let explanation;
  if(brilliant){badge='brilliant';explanation=brilliant+' Le modèle humain 5 kyū lui donne moins de 2 % de probabilité.'}
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
  return {ply:ply+1,color,badge,explanation,loss:+loss.toFixed(2),drop:+drop.toFixed(4),best:compact(best),played:compact(actual)};
}
