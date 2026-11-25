'use strict';
const Go = (() => {
  const adjacent = (p, n) => [p % n > 0 && p - 1, p % n < n-1 && p + 1, p >= n && p-n, p < n*(n-1) && p+n].filter(x=>x!==false);
  function group(board, p, n) {
    const stones = new Set([p]), liberties = new Set();
    for (const s of stones) for (const q of adjacent(s,n)) {
      if (!board[q]) liberties.add(q);
      else if (board[q]===board[p]) stones.add(q);
    }
    return {stones, liberties};
  }
  function play(board, p, color, n, previous) {
    if(!Number.isInteger(p) || p<0 || p>=n*n || board[p]) return null;
    const next=board.slice(); next[p]=color;
    let captured=0;
    for(const q of adjacent(p,n)) if(next[q]===3-color) {
      const g=group(next,q,n);
      if(!g.liberties.size) for(const s of g.stones){next[s]=0;captured++}
    }
    if(!group(next,p,n).liberties.size || previous?.some(b=>b.every((v,i)=>v===next[i])))return null;
    return {board:next,captured};
  }
  function score(board,n,komi=6.5) {
    const points=[0,0,komi],visited=new Set();
    board.forEach((v,i)=>{
      if(v) {points[v]++;return}
      if(visited.has(i))return;
      const empty=new Set([i]),border=new Set();
      for(const p of empty){visited.add(p);for(const q of adjacent(p,n)){if(board[q])border.add(board[q]);else empty.add(q)}}
      if(border.size===1)points[[...border][0]]+=empty.size;
    });return points;
  }
  return {group,play,score,adjacent};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Go;
