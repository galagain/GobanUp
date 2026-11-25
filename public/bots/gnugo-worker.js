// SPDX-License-Identifier: GPL-3.0-or-later
// Separate GNU Go process, communicating only the game record and one move.
'use strict';
self.exports={};
importScripts('gnugo/gnugo.js?v=382df5a9');
self.onmessage=async({data:{n,moves,board,komi,id}})=>{
  try{
    const engine=await self.exports.get(new URL('gnugo/gnugo.wasm?v=d2083a69',self.location.href).href);
    const coord=p=>p<0?'':String.fromCharCode(97+p%n,97+Math.floor(p/n));
    const setup=[1,2].map(color=>{
      const stones=board.flatMap((v,p)=>v===color?['['+coord(p)+']']:[]);
      return stones.length?(color===1?'AB':'AW')+stones.join(''):'';
    }).join('');
    const sgf='(;GM[1]FF[4]SZ['+n+']KM['+komi+']RU[Chinese]PL[B]'+setup+moves.map((p,i)=>';'+(i%2?'W':'B')+'['+coord(p)+']').join('')+')';
    const out=engine.ccall('play','string',['number','string'],[crypto.getRandomValues(new Uint32Array(1))[0]>>>1,sgf]);
    const last=Array.from(out.matchAll(/;\s*([BW])\[([a-z]{2}|)\]/g)).at(-1);
    if(last?.[1]!=='W')throw Error('missing move');
    const point=last[2],x=point.charCodeAt(0)-97,y=point.charCodeAt(1)-97;
    if(point && point!=='tt' && (x>=n || y>=n))throw Error('invalid move');
    self.postMessage({id,move:!point || point==='tt'?-1:y*n+x});
  }catch{self.postMessage({id,error:true})}
};
