'use strict';
importScripts('fuego/engine.js');
const engine=FuegoModule({locateFile:file=>new URL('fuego/'+file,self.location.href).href});
self.onmessage=async({data:{id,n,komi,moves}})=>{
  try{
    const mod=await engine;
    const ptr=mod._malloc(moves.length*4);
    if(!ptr)throw Error('memory');
    try{
      mod.HEAP32.set(moves,ptr/4);
      const move=mod._choose(n,ptr,moves.length,komi);
      self.postMessage({id,move});
    }finally{mod._free(ptr)}
  }catch{self.postMessage({id,error:true})}
};
