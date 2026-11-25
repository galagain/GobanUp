'use strict';
importScripts('leela/engine.js');

let ready;
async function loadEngine(){
  const [engine,response]=await Promise.all([
    LeelaModule({locateFile:file=>new URL('leela/'+file,self.location.href).href}),
    fetch('leela/elf-v1.gz')
  ]);
  if(!response.ok)throw Error('Modèle ELF indisponible');
  const stream=response.body.pipeThrough(new DecompressionStream('gzip'));
  const weights=new Uint8Array(await new Response(stream).arrayBuffer());
  engine.FS.writeFile('/elf',weights,{canOwn:true});
  try{engine._load_engine()}finally{engine.FS.unlink('/elf')}
  return engine;
}
self.onmessage=async({data:{id,n,moves}})=>{
  try{
    if(n!==19)throw Error('Goban 19 × 19 requis');
    ready??=loadEngine();
    const engine=await ready;
    const ptr=engine._malloc(moves.length*4);
    try{
      engine.HEAP32.set(moves,ptr/4);
      self.postMessage({id,move:engine._choose(ptr,moves.length)});
    }finally{engine._free(ptr)}
  }catch{self.postMessage({id,error:true})}
};
