import {createHash} from 'node:crypto';
import {cp,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const assets=[
  ['katago/human-v0.bin.gz','https://github.com/lightvector/KataGo/releases/download/v1.15.0/b18c384nbt-humanv0.bin.gz','637746e44f0efe00ad1245a50aa9bbf0716efe364c43965ead97bd6835d84ab5'],
  ['katago/raylu-s9996604416.bin.gz','https://media.katagotraining.org/uploaded/networks/models/kata1/kata1-b18c384nbt-s9996604416-d4316597426.bin.gz','9d7a6afed8ff5b74894727e156f04f0cd36060a24824892008fbb6e0cba51f1d'],
];
export async function downloadModels(dir){
  await mkdir(dir+'/katago',{recursive:true});
  await Promise.all(assets.map(async ([path,url,digest])=>{
    const response=await fetch(url,{signal:AbortSignal.timeout(240000)});
    if(!response.ok)throw Error(path+' HTTP '+response.status);
    const data=Buffer.from(await response.arrayBuffer());
    if(createHash('sha256').update(data).digest('hex')!==digest)throw Error('Checksum '+path);
    await writeFile(dir+'/'+path,data);
  }));
}
export async function copyBotAssets(dir){
  if(process.env.BOT_MODEL_ASSETS){
    await cp(process.env.BOT_MODEL_ASSETS+'/katago',dir+'/katago',{recursive:true});
  }else{
    await downloadModels(dir);
  }
  for(const [name,source] of [['fuego',process.env.FUEGO_ASSETS],['leela',process.env.LEELA_ASSETS]]){
    const dest=dir+'/bots/'+name;
    if(source){
      await cp(source,dest,{recursive:true});
    }else{
      execFileSync('docker',['build','--target',name+'-artifacts','--output','type=local,dest='+dest,'.'],{stdio:'inherit'});
    }
  }
}
