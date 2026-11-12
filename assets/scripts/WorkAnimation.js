/* Pure presentation sampling. Reads the original busy timer; never changes production. */
(function(root){
 'use strict';
 function sample(u,clock){
  if(u.kind===1)return miner(u,clock);
  if(u.kind===0||u.kind===2||u.kind===3){
   const work=miner(u,clock),p=work.progress;
   work.strike=work.phase==='dig'&&(u.kind===0?p>=.50&&p<.62:u.kind===3?p>=.625&&p<.69:false)?0:-1;
   if(work.phase==='dig')work.pose=u.kind===0?(p<.54?3:4):u.kind===3?(p<.625?3:4):(p<.55?3:4);
   return work;
  }
  if(u.kind>=4&&u.kind<=7){
   const work=miner(u,clock),p=work.progress,cycles=u.kind===5?4:3;
   const cycle=Math.max(0,Math.min(1,(p-.43)/.37))*cycles,beat=cycle%1;
   work.strike=work.phase==='dig'&&beat>=.42&&beat<.62?Math.floor(cycle):-1;
   if(work.phase==='dig')work.pose=beat<.42?3:4;
   return work;
  }
  if(!(u.busy>0&&u.duration>0))return {phase:'idle',pose:0,x:u.x,y:u.y,lift:Math.sin(clock*2+u.x)*1.2,angle:Math.sin(clock*.9+u.x)*.7,scaleY:1,strike:-1};
  const p=Math.max(0,Math.min(1,1-u.busy/u.duration));
  let phase,pose,lift=0,angle=0,scaleY=1,strike=-1;
  if(p<.10){phase='startled';pose=1;scaleY=1-Math.sin(p/.10*Math.PI)*.05;}
  else if(p<.24){phase='start';pose=2;angle=-Math.sin((p-.10)/.14*Math.PI)*2;}
  else if(p<.80){
   phase='dig';const cycles=(p-.24)/.56*3,beat=cycles%1,down=beat>=.42;
   pose=down?4:3;strike=down?Math.floor(cycles):-1;
   angle=down?1.5:-1.5;scaleY=down?.97:1;
  }else{phase='finish';pose=5;scaleY=.98+Math.sin((p-.80)/.20*Math.PI*2)*.006;}
  // Mining stays planted. The original destination is reached before the original timer ends.
  const q=Math.max(0,Math.min(1,(p-.80)/.20)),move=q*q*(3-2*q);
  const x=u.fromX+(u.toX-u.fromX)*move,y=u.fromY+(u.toY-u.fromY)*move;
  if(q>0)lift=Math.sin(q*Math.PI)*20;
  return {phase,pose,x,y,lift,angle,scaleY,strike};
 }
 function miner(u,clock){
  const active=u.busy>0&&u.duration>0,p=active?Math.max(0,Math.min(1,1-u.busy/u.duration)):0;
  const phase=!active?'idle':p<.10?'startled':p<.43?'start':p<.80?'dig':'finish';
  const pose=phase==='idle'?0:phase==='startled'?1:phase==='start'?2:phase==='finish'?5:p<.61?3:4;
  // Walk to the work point during the windup; feet plant before the pick hits.
  const q=active?Math.max(0,Math.min(1,(p-.10)/.33)):1,move=q*q*(3-2*q);
  return {phase,pose,progress:p,x:active?u.fromX+(u.toX-u.fromX)*move:u.x,y:active?u.fromY+(u.toY-u.fromY)*move:u.y,lift:0,angle:0,scaleY:1,strike:active&&p>=.61&&p<.68?0:-1,walking:active&&p>.10&&p<.43,step:q*Math.PI*4};
 }
 const api={sample};if(typeof module!=='undefined')module.exports=api;root.WZWorkAnimation=api;
})(typeof globalThis!=='undefined'?globalThis:this);
