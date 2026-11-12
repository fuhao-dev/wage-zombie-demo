/* Factory cutout workers. Presentation only: a planted tool, connected hands and tired faces. */
(function(root){
 'use strict';
 const MathRig=root.WZMinerRig||require('./MinerRig'),rotate=MathRig.rotate,solve=MathRig.solve;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
 const specs={
  4:{key:'cutter',name:'Circular saw worker',scale:.94,body:[46,56],head:[55,55],headY:51,shoulder:18,shoulderY:43,arm:[29,30],armWidth:[15,10.5],leg:[23,24],hip:9,feet:17,legWidth:[17,22],hand:[13,15],tool:[37,49],toolHead:[43,49],backpack:[35,38],shoulderSize:[22,19],workX:40,overlap:5,cycles:3,grips:[[-10,-8],[10,-9]]},
  5:{key:'drill',name:'Drill worker',scale:.94,body:[46,56],head:[54,57],headY:51,shoulder:18,shoulderY:43,arm:[29,30],armWidth:[15,10.5],leg:[23,24],hip:9,feet:17,legWidth:[17,22],hand:[13,15],tool:[36,48],toolHead:[23,40],backpack:[34,41],shoulderSize:[23,21],workX:40,overlap:7,cycles:4,grips:[[-10,-8],[10,-9]]},
  6:{key:'broadcast',name:'Broadcast probe worker',scale:.94,body:[40,62],head:[57,63],headY:57,shoulder:16,shoulderY:47,arm:[31,32],armWidth:[13,9],leg:[26,27],hip:8,feet:16,legWidth:[15,20],hand:[12,14],tool:[27,47],toolHead:[35,34],backpack:[47,45],shoulderSize:[23,25],workX:36,overlap:7,cycles:3,grips:[[-8,-7],[8,-9]]},
  7:{key:'hydraulic',name:'Hydraulic tamper worker',scale:.94,body:[72,65],head:[63,61],headY:60,shoulder:30,shoulderY:49,arm:[34,35],armWidth:[30,23],leg:[25,26],hip:16,feet:25,legWidth:[28,34],hand:[22,23],tool:[61,59],toolHead:[61,37],backpack:[48,48],shoulderSize:[31,24],workX:45,overlap:8,cycles:3,grips:[[-23,-12],[23,-12]]}
 };
 function pose(kind,work,time,rest,hit){
  const s=specs[kind];if(!s)throw new Error('Unsupported factory worker kind: '+kind);
  work=work||{phase:'idle'};time=Number.isFinite(time)?time:0;
  const p=clamp(work.progress||0,0,1),idle=work.phase==='idle',r=clamp(rest||0,0,1);
  const settle=idle?0:smooth((p-.32)/.11),release=idle?1:smooth((p-.8)/.15),working=work.phase==='dig';
  const cycle=clamp((p-.43)/.37,0,1)*s.cycles,beat=cycle%1;
  // A short downstroke followed by a longer recovery; the working end remains on the ground.
  const press=working?Math.pow(Math.sin(beat*Math.PI),2):0;
  const load=idle?0:smooth((p-.37)/.08)*(1-smooth((p-.76)/.08)),breath=Math.sin(time*2.4)*.38;
  const tired=idle?r:release,walk=!!work.walking,step=walk?Math.sin(work.step||0):0;
  const out={kind,hipX:(kind===7?2:1)*load,hipY:(kind===6?49:kind===7?47:44)+breath-tired*2-press*(kind===7?3.5:1.2),lean:-5-tired*6-load*(kind===7?3:5)+(hit||0)*3,headAngle:idle?-3-tired*4:work.phase==='startled'?5:work.phase==='finish'?-7:working?2:-3,walking:walk,step,face:work.phase==='startled'?'startled':work.phase==='finish'||(idle&&r>.1)?'tired':working||work.phase==='start'?'effort':'idle',working,press,cycle};
  const carryLift=idle?10-r*2:(1-settle)*10+release*8,walkBob=walk?Math.abs(step)*2:0;
  out.toolX=idle?s.workX-5+r*2:s.workX-(1-settle)*5-release*3;
  out.toolY=s.tool[1]+s.toolHead[1]-s.overlap+carryLift+walkBob;
  out.toolAngle=0;
  out.headToolX=out.toolX;out.headToolY=s.toolHead[1]+carryLift+walkBob;
  out.headToolAngle=0;out.headToolScaleX=1;out.headToolScaleY=1;
  // The upper cylinder compresses; the independent plate never bounces through the floor.
  if(kind===7)out.toolY-=press*7;
  if(kind===5){out.toolX+=working?Math.sin(time*90)*.55:0;out.headToolX=out.toolX;out.toolY-=press*1.5;out.headToolScaleX=1-load*.22*(1-Math.cos(time*44));}
  if(kind===4){out.toolX+=working?Math.sin(time*72)*.32:0;out.headToolX=out.toolX;out.headToolAngle=working?-time*1100:0;}
  if(kind===6){out.voice=working?.35+.65*Math.pow(Math.sin(time*15),2):0;out.speakerShake=working?Math.sin(time*55)*.65:0;}
  else{out.voice=0;out.speakerShake=0;}
  out.backpackShake=working?Math.sin(time*(kind===6?55:35))*(kind===6?.65:.2):0;
  out.contact={x:out.headToolX,y:out.headToolY-s.toolHead[1]};
  out.hands=s.grips.map(xy=>({x:out.toolX+xy[0],y:out.toolY+xy[1]}));
  out.arms=[-1,1].map((sign,i)=>{const shoulder=rotate(sign*s.shoulder,s.shoulderY,out.lean),start={x:out.hipX+shoulder.x,y:out.hipY+shoulder.y},end=out.hands[i];return {start,end,ik:solve(start,end,...s.arm,sign)};});
  out.legs=[-1,1].map(sign=>{const start={x:out.hipX+sign*s.hip,y:out.hipY+3},end={x:sign*s.feet-sign*step*12,y:4+(walk?Math.max(0,-sign*step)*8:0)};return {start,end,ik:solve(start,end,...s.leg,sign)};});
  return out;
 }
 function create(parent,texture,data,kind){
  const s=specs[kind];if(!s)throw new Error('Unsupported factory worker kind: '+kind);
  const node=new cc.Node(s.name+' cutout rig');parent.addChild(node);node.scale=s.scale;
  const cache={},parts={};
  function frame(key){if(!cache[key]){const f=data.frames[key];if(!f)throw new Error(s.key+' atlas is missing '+key);cache[key]=new cc.SpriteFrame(texture,cc.rect(f.x,f.y,f.w,f.h));}return cache[key];}
  function part(name,key,w,h,z,ay,parentNode){const n=new cc.Node(name);(parentNode||node).addChild(n);n.anchorX=.5;n.anchorY=ay;n.zIndex=z;n.setContentSize(w,h);const sprite=n.addComponent(cc.Sprite);sprite.sizeMode=cc.Sprite.SizeMode.CUSTOM;sprite.spriteFrame=frame(key);parts[name]={node:n,sprite};return n;}
  function limb(name,upper,lower,widths,z){const n=new cc.Node(name+' joint');node.addChild(n);n.zIndex=z;const u=part(name+' upper',upper,widths[0],30,0,1,n),joint=new cc.Node(name+' elbow');n.addChild(joint);const l=part(name+' lower',lower,widths[1],30,0,1,joint);return {node:n,upper:u,joint,lower:l};}
  const backpack=part('Backpack','backpack',...s.backpack,-1,0);
  const legRear=limb('Rear leg','thighRear','shinRear',s.legWidth,0),armRear=limb('Rear arm','upperRear','foreRear',s.armWidth,1),legFront=limb('Front leg','thighFront','shinFront',s.legWidth,2);
  const torso=part('Body','torso',...s.body,3,0),head=part('Head','idle',...s.head,1,0,torso);head.setPosition(1,s.headY);
  const shoulderRear=part('Rear shoulder','shoulderRear',...s.shoulderSize,0,.65,torso),shoulderFront=part('Front shoulder','shoulderFront',...s.shoulderSize,2,.65,torso);
  shoulderRear.setPosition(-s.shoulder,s.shoulderY);shoulderFront.setPosition(s.shoulder,s.shoulderY);
  const armFront=limb('Front arm','upperFront','foreFront',s.armWidth,4),toolHead=part('Tool head','toolHead',...s.toolHead,5,1),tool=part('Tool','tool',...s.tool,6,1);
  const handRear=part('Rear hand','handRear',...s.hand,7,.5),handFront=part('Front hand','handFront',...s.hand,8,.5);
  const fxNode=new cc.Node('Local machine motion');node.addChild(fxNode);fxNode.zIndex=9;const fx=fxNode.addComponent(cc.Graphics);
  function moveLimb(r,p){r.node.setPosition(p.start.x,p.start.y);r.node.angle=p.ik.a;r.upper.height=p.ik.l1+4;r.joint.setPosition(0,-p.ik.l1);r.joint.angle=p.ik.b-p.ik.a;r.lower.height=p.ik.l2+4;}
  let bladeTime=null,bladeAngle=0;
  const rig={node,kind,parts,face:null,pose:null,contact:null,update(work,time,rest,hit,tint){
   const p=pose(kind,work,time,rest,hit);this.pose=p;
   torso.setPosition(p.hipX,p.hipY);torso.angle=p.lean;head.angle=p.headAngle;
   if(this.face!==p.face){parts.Head.sprite.spriteFrame=frame(p.face);this.face=p.face;}
   backpack.setPosition(p.hipX-s.body[0]*.29+p.backpackShake,p.hipY+10);backpack.angle=p.lean-3;
   tool.setPosition(p.toolX,p.toolY);tool.angle=p.toolAngle;
   toolHead.setPosition(p.headToolX,p.headToolY);toolHead.scaleX=p.headToolScaleX;toolHead.scaleY=p.headToolScaleY;
   // Keep the guard/connector upright. The isolated saw blade is installed below.
   toolHead.angle=0;
   moveLimb(armRear,p.arms[0]);moveLimb(armFront,p.arms[1]);moveLimb(legRear,p.legs[0]);moveLimb(legFront,p.legs[1]);
   for(const [i,h]of[[0,handRear],[1,handFront]]){h.setPosition(p.hands[i].x,p.hands[i].y);h.angle=p.arms[i].ik.b;}
   if(kind===6){shoulderRear.scaleX=1+p.voice*.025;shoulderFront.scaleX=1+p.voice*.025;head.x=1+p.speakerShake;}
   this.contact={x:p.contact.x*s.scale,y:p.contact.y*s.scale};Object.values(parts).forEach(part=>{if(tint)part.node.color=tint;});
   fx.clear();
   if(kind===6&&p.voice>.05){fx.strokeColor=new cc.Color(163,226,214,Math.round(p.voice*170));fx.lineWidth=1.3;for(let i=0;i<2;i++){const r=9+i*8+p.voice*3;fx.ellipse(p.contact.x,p.contact.y+1,r,r*.23);fx.stroke();}}
   if(kind===7&&p.working){fx.strokeColor=new cc.Color(196,213,201,210);fx.lineWidth=4;fx.moveTo(p.toolX,p.toolY-s.tool[1]+3);fx.lineTo(p.headToolX,p.headToolY-7);fx.stroke();}
   if(this.sawBlade){const dt=bladeTime===null?0:clamp(time-bladeTime,0,.1);bladeTime=time;if(p.working)bladeAngle=(bladeAngle-dt*1100)%360;this.sawBlade.angle=bladeAngle;}
  }};
  // Source art includes the static guard. Mask a circular copy so only its lower blade rotates.
  if(kind===4&&cc.Mask){
   const maskNode=new cc.Node('Rotating saw blade mask');toolHead.addChild(maskNode);maskNode.setPosition(0,-s.toolHead[1]*.66);const d=s.toolHead[0]*.78;maskNode.setContentSize(d,d);maskNode.anchorX=.5;maskNode.anchorY=.5;const mask=maskNode.addComponent(cc.Mask);mask.type=cc.Mask.Type.ELLIPSE;mask.segments=48;
   const pivot=new cc.Node('Saw blade pivot');maskNode.addChild(pivot);rig.sawBlade=pivot;
   const blade=part('Rotating blade','toolHead',...s.toolHead,1,1,pivot);blade.setPosition(0,s.toolHead[1]*.66);
  }
  rig.update({phase:'idle',progress:0},0,0,0);
  return rig;
 }
 const api={specs,pose,create};if(typeof module!=='undefined')module.exports=api;root.WZFactoryWorkerRig=api;
})(typeof globalThis!=='undefined'?globalThis:this);
