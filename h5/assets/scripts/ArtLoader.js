/* Bounded, deduplicated asset loading. Independent from simulation and Cocos. */
(function(root){
 'use strict';
 function create(options){
  const request=options.request,delay=options.setTimeout||setTimeout,clear=options.clearTimeout||clearTimeout;
  const concurrency=options.concurrency||2,maxAttempts=options.maxAttempts||3,timeout=options.timeout||45000;
  const entries=new Map(),queue=[],batches=new Set();let running=0,pumping=false;
  function snapshot(names){
   const rows=names.map(name=>entries.get(name)),loaded=rows.filter(row=>row.state==='ready').length;
   return {loaded,total:names.length,progress:names.length?loaded/names.length:1,
    failed:rows.filter(row=>row.state==='failed').map(row=>row.name),
    retrying:rows.some(row=>row.state==='retrying'||row.attempt>1&&row.state==='loading'),
    attempt:Math.max(1,...rows.map(row=>row.attempt)),maxAttempts};
  }
  function notify(){
   for(const batch of Array.from(batches)){
    if(!batch.active)continue;
    const state=snapshot(batch.names);
    if(batch.progress)batch.progress(state);
    if(!batch.active)continue;
    if(batch.names.every(name=>['ready','failed'].includes(entries.get(name).state))){
     batch.active=false;batches.delete(batch);
     const error=state.failed.length?new Error('Art assets unavailable: '+state.failed.join(', ')):null;
     if(error)error.assets=state.failed;
     if(batch.done)batch.done(error,state);
    }
   }
  }
  function pump(){
   if(pumping)return;pumping=true;
   while(running<concurrency&&queue.length){
    const row=queue.shift();if(row.state!=='queued')continue;
    row.state='loading';row.attempt++;running++;
    let finished=false;
    const finish=(error,data)=>{
     if(finished)return;finished=true;clear(timer);running--;
     if(!error){row.state='ready';row.data=data;if(options.loaded)options.loaded(row.name,data);}
     else if(row.attempt<maxAttempts){
      row.state='retrying';row.error=error;
      delay(()=>{row.state='queued';queue.push(row);pump();notify();},(options.retryDelay||1000)*Math.pow(2,row.attempt-1));
     }else{row.state='failed';row.error=error;}
     notify();pump();
    };
    const timer=delay(()=>finish(new Error('Art request timed out: '+row.name)),timeout);
    try{request(row.name,finish,row.attempt);}catch(error){finish(error);}
   }
   pumping=false;
  }
  function ensure(names,done,progress){
   names=Array.from(new Set(names));
   for(const name of names){
    let row=entries.get(name);
    if(!row){row={name,state:'queued',attempt:0};entries.set(name,row);queue.push(row);}
    else if(row.state==='failed'){row.state='queued';row.attempt=0;queue.push(row);}
   }
   const batch={names,done,progress,active:true};batches.add(batch);notify();pump();
   return {cancel(){batch.active=false;batches.delete(batch);}};
  }
  return {ensure,ready:names=>names.every(name=>entries.get(name)&&entries.get(name).state==='ready')};
 }
 const api={create};if(typeof module!=='undefined')module.exports=api;root.WZArtLoader=api;
})(typeof globalThis!=='undefined'?globalThis:this);
