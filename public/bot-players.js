'use strict';
const BotPlayers=(()=>{
  const ranks=[18,14,10,6,2,-1];
  const styles={
    local:{name:'Local',fraction:0,count:15,deviation:1.5,endgame:.5,override:.95},
    tenuki:{name:'Tenuki',fraction:.4,count:5,deviation:7.5,endgame:.45,override:.85},
    territory:{name:'Territoire',fraction:.3,count:5,line:2,endgame:.4,override:.95},
    influence:{name:'Influence',fraction:.3,count:5,line:10,endgame:.4,override:.95},
    weighted:{name:'Pondéré',override:1}
  };
  const groups=[
    ['GobanUp',[['easy','Découverte'],['normal','Tactique']]],
    ['Moteurs',[['gnugo','GNU Go'],['katago','KataGo']]],
    ['KaTrain · profils de niveau indicatif',ranks.map(rank=>['rank'+rank,'KaTrain · '+(rank<0?'2 dan':rank+' kyu')])],
    ['KaTrain · styles',Object.entries(styles).map(([id,style])=>[id,'KaTrain · '+style.name])]
  ];
  const names=new Map(groups.flatMap(([,options])=>options));
  const name=id=>names.get(id)||names.get('normal');
  const external=id=>names.has(id) && id!=='easy' && id!=='normal';
  function options(){
    return groups.map(([label,items])=>`<optgroup label="${label}">${items.map(([id,text])=>`<option value="${id}">${text}</option>`).join('')}</optgroup>`).join('');
  }
  function policy(logits,n,states){
    if(logits?.length!==n*n+1)throw Error('policy');
    const board=states.at(-1), choices=[];
    for(let p=0;p<logits.length;p++){
      if(!Number.isFinite(logits[p]))continue;
      if(p===board.length || (!board[p] && Go.play(board,p,2,n,states))){
        choices.push({p:p===board.length?-1:p,logit:logits[p]});
      }
    }
    if(!choices.some(move=>move.p===-1))throw Error('pass');
    choices.sort((a,b)=>b.logit-a.logit);
    const max=choices[0].logit;
    let sum=0;
    for(const c of choices){c.prob=Math.exp(c.logit-max);sum+=c.prob}
    for(const c of choices)c.prob/=sum;
    return choices;
  }
  // KaTrain 1.7.6 calibrated pick strategy (ai.py, MIT).
  function rankSample(rank,legal,area){
    const f=legal/area;
    const original=.063015+.7624*area/10**(-.05737*rank+1.9482);
    const exponent=3.002*f*f-f-.034889*rank-.5097;
    const modified=(.3931+.6559*f*Math.exp(-(exponent**2))-.01093*rank)*original;
    return Math.max(1,Math.round(legal/(1.31165*(modified+1)-.082653)));
  }
  function styleWeight(id,style,p,n,last){
    const x=p%n,y=Math.floor(p/n);
    if(style.deviation){
      const distance=(x-last%n)**2+(y-Math.floor(last/n))**2;
      const local=Math.exp(-distance/(2*style.deviation**2));
      return id==='local'?local:1-local;
    }
    const dx=Math.min(x,n-1-x),dy=Math.min(y,n-1-y);
    const penalty=id==='influence'?Math.max(0,2.5-dx)+Math.max(0,2.5-dy):Math.max(0,Math.min(dx,dy)-2.5);
    return style.line**(-penalty);
  }
  function profileMove(g,states,logits){
    const choices=policy(logits,g.n,states),top=choices[0];
    if(choices.slice(0,5).some(c=>c.p===-1))return top.p;
    const legal=choices.filter(c=>c.p>=0 && c.prob>0);
    const pass=choices.find(c=>c.p===-1).prob;
    const id=g.level,style=styles[id],area=g.n*g.n,last=g.moves.at(-1);
    const rank=style?null:Number(id.slice(4));
    const afterPass=Boolean(style?.deviation && last===-1);
    const override=afterPass ? 0.9 : (style?.override ?? .8*(1-.5*(area-legal.length)/area));
    const topTwo=style?1:.85+Math.max(0,.02*(rank-8));
    if(top.prob>override || top.prob+choices[1].prob>topTwo)return top.p;
    let count=1;
    const weighted=id==='weighted' || afterPass;
    const endgame=style && g.moves.length>style.endgame*area;
    if(!weighted){
      count=style?Math.floor(style.fraction*legal.length+style.count):rankSample(rank,legal.length,area);
      if(endgame)count=Math.max(count,Math.floor(legal.length/2));
    }
    const samples=[];
    for(const c of legal){
      let weight=1,score=c.prob;
      if(weighted){
        if(score<=(afterPass ? .02 : .001))continue;
        weight=score**(afterPass?1:1/1.25);
      }else if(style && !endgame){
        weight=styleWeight(id,style,c.p,g.n,last);
        if(style.line)score*=weight;
      }
      if(weight>0)samples.push({p:c.p,score,key:-Math.log(1-Math.random())/weight});
    }
    samples.sort((a,b)=>a.key-b.key);
    let best=null;
    for(const c of samples.slice(0,count)){if(!best || c.score>best.score)best=c}
    return best && (weighted || best.score>=pass)?best.p:top.p;
  }

  let worker=null, pending=null, failed=false, timer, sequence=0;
  function stop(){
    clearTimeout(timer);pending=null;failed=false;
    worker?.terminate();worker=null;
  }
  function run(g){
    if(pending || failed)return;
    const ply=g.moves.length,states=makeStates(g).states,id=++sequence;
    const current=()=>pending===id && game===g && !reviewing && g.moves.length===ply && !ended(g);
    function fail(){
      if(!current())return;
      stop();failed=true;drawGame();
    }
    pending=id;
    try{
      const gnu=g.level==='gnugo',search=g.level==='katago';
      const url=gnu?'bots/gnugo-worker.js':'katago/analysis-worker.js?policy=1';
      worker??=new Worker(new URL(url,document.baseURI),{name:name(g.level)});
      worker.onerror=worker.onmessageerror=fail;
      worker.onmessage=({data})=>{
        if(!current() || data.id!==id)return;
        try{
          let move;
          if(gnu){if(data.error)throw Error('GNU Go');move=data.move}
          else{
            if(!data.ok)throw Error('KataGo');
            if(search){
              if(data.type!=='katago:analyze_result')return;
              const a=data.analysis;
              const candidate=a.moves.find(m=>m.x===-1 || Go.play(states.at(-1),m.y*g.n+m.x,2,g.n,states));
              move=candidate?(candidate.x===-1?-1:candidate.y*g.n+candidate.x):LocalAnalysis.policyMove(a.policy,states.at(-1),g.n,2,states);
            }else{
              if(data.type!=='katago:eval_result')return;
              move=profileMove(g,states,data.eval.policyLogits);
            }
          }
          if(move!==-1 && !Go.play(states.at(-1),move,2,g.n,states)){
            // GNU Go can suggest a repetition that GobanUp's positional superko forbids.
            if(gnu && Number.isInteger(move) && move>=0 && move<g.n*g.n)move=-1;
            else throw Error('illegal');
          }
          clearTimeout(timer);pending=null;
          if(gnu){worker.terminate();worker=null}
          recordLocalMove(move);position=g.moves.length;saveGame();drawGame();
        }catch{fail()}
      };
      timer=setTimeout(fail,90000);
      if(gnu){
        // GNU Go serializes its reply to SGF. Bound the record size even in long games.
        const start=Math.max(0,ply-65);
        worker.postMessage({id,n:g.n,komi:g.komi??6.5,board:states[start],moves:g.moves.slice(start)});
      }
      else{
        const input=LocalAnalysis.positionInputs(g,states)(ply);
        worker.postMessage(search?{...input,id,type:'katago:analyze',analysisGroup:'opponent',visits:32,maxTimeMs:1800,topK:3,analysisPvLen:1,ownershipMode:'none',wideRootNoise:0}:
          {...input,id,type:'katago:eval',includePolicy:true});
      }
    }catch{fail()}
  }
  return {name,options,external,run,stop,get failed(){return failed}};
})();
