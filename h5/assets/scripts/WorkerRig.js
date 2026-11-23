/* First-chapter cutout actors. Pure poses use the approved miner's connected limb solver. */
(function(root){
 'use strict';
 const MathRig=root.WZMinerRig||require('./MinerRig'),rotate=MathRig.rotate,solve=MathRig.solve;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
 const specs={
  0:{key:'corpse',name:'Shovel worker',scale:.94,body:[46,56],head:[54,54],headY:51,shoulder:18,shoulderY:43,arm:[28,29],armWidth:[15,10.5],leg:[23,24],hip:9,feet:16,legWidth:[17,22],hand:[13,15],tool:[32,82],toolAnchor:.5,grips:[[0,12],[0,30]],contact:[0,80],keys:[
   [0,0,44,-8,-18,59,-105,-4],[.055,-2,45,2,-18,64,-92,5],[.13,0,44,-8,-18,61,-105,-3],
   [.43,2,41,-12,-13,68,-135,-4],[.50,4,40,-12,-3.886,65.532,-145,5],
   [.62,-4,34,6,-28.636,37.558,-118,5],[.70,-6,42,20,-57.282,70,-120,-2],
   [.78,-2,42,-6,-23,55,-105,-4],[.88,0,42,-12,-20,53,-110,-5],[1,0,42,-12,-20,53,-110,-5]]},
  2:{key:'screamer',name:'Megaphone worker',scale:.94,body:[39,63],head:[49,68],headY:59,shoulder:16,shoulderY:47,arm:[31,32],armWidth:[13,9],leg:[26,27],hip:8,feet:15,legWidth:[15,20],hand:[12,14],tool:[34,49],toolAnchor:.22,grips:[[2,10],[15,14]],contact:[15,41],keys:[
   [0,0,49,-7,-10,60,-65,-4],[.055,-2,50,2,-10,65,-61,6],[.13,0,49,-7,-10,62,-65,-3],
   [.43,0,49,-4,25,126,-110,-2],[.55,1,49,-3,25,126,-110,0],[.76,1,49,-4,25,126,-112,1],
   [.80,1,48,-6,25,126,-112,2],[.94,0,46,-12,-13,55,-74,-8],[1,0,46,-12,-13,55,-74,-8]]},
  3:{key:'brute',name:'Tamper worker',scale:.94,body:[72,65],head:[65,59],headY:60,shoulder:30,shoulderY:49,arm:[33,34],armWidth:[31,24],leg:[25,26],hip:16,feet:23,legWidth:[28,34],hand:[23,24],tool:[82,100],toolAnchor:.5,grips:[[0,12],[0,37]],contact:[0,100],keys:[
   [0,0,47,-3,20,100,-180,-3],[.055,-2,48,4,20,100,-180,3],[.13,0,47,-3,20,100,-180,-3],
   [.43,-2,48,5,-2,99,-10,-2],[.54,-3,49,8,-2,104,-4,-5],[.625,5,42,-14,20,100,-180,9],
   [.68,5,42,-14,20,100,-180,9],[.86,1,44,-7,20,100,-180,-6],[1,1,44,-7,20,100,-180,-6]]}
 };
 function pose(kind,work,time,rest,hit){
  const s=specs[kind],keys=s.keys,p=work.progress||0;let a=keys[0],b=a,q=0;
  if(work.phase==='idle'){b=keys[keys.length-1];q=clamp(rest||0,0,1);}
  else{for(let i=1;i<keys.length;i++)if(p<=keys[i][0]){a=keys[i-1];b=keys[i];q=(p-a[0])/(b[0]-a[0]);break;}q=kind===3&&p>.54&&p<.625?q*q:smooth(q);}
  const v=a.map((x,i)=>x+(b[i]-x)*q),breath=Math.sin(time*2.6)*.45;
  const out={kind,hipX:v[1],hipY:v[2]+breath,lean:v[3]+(hit||0)*4,toolX:v[4],toolY:v[5]+breath,toolAngle:v[6],headAngle:v[7],walking:!!work.walking,step:work.walking?Math.sin(work.step):0,face:work.phase==='startled'?'startled':work.phase==='finish'||(work.phase==='idle'&&rest>.1)?'tired':work.phase==='dig'||work.phase==='start'?'effort':'idle'};
  if(kind===2&&work.phase!=='idle'){
   const jaw=rotate(17,23,out.headAngle),mouth=rotate(1+jaw.x,s.headY+jaw.y,out.lean),blend=Math.min(smooth((p-.30)/.13),1-smooth((p-.80)/.12));out.toolX+=(out.hipX+mouth.x-out.toolX)*blend;out.toolY+=(out.hipY+mouth.y-out.toolY)*blend;
  }
  // Keep the blade planted while the handle lowers: a lever/pry, not an overhead impact.
  if(kind===0&&work.phase==='dig'&&p>=.50&&p<=.62){const tip=rotate(...s.contact,out.toolAngle);out.toolX=42-tip.x;out.toolY=-tip.y;}
  out.soil=kind===0&&work.phase==='dig'&&p>.62&&p<.76?Math.sin((p-.62)/.14*Math.PI):0;
  const toolPoint=xy=>{const r=rotate(xy[0],xy[1],out.toolAngle);return {x:out.toolX+r.x,y:out.toolY+r.y};};
  out.hands=s.grips.map(toolPoint);out.contact=toolPoint(s.contact);
  out.arms=[-1,1].map((sign,i)=>{const shoulder=rotate(sign*s.shoulder,s.shoulderY,out.lean),start={x:out.hipX+shoulder.x,y:out.hipY+shoulder.y},end=out.hands[i];return {start,end,ik:solve(start,end,...s.arm,sign)};});
  out.legs=[-1,1].map(sign=>{const start={x:out.hipX+sign*s.hip,y:out.hipY+3},end={x:sign*s.feet-sign*out.step*13,y:4+(out.walking?Math.max(0,-sign*out.step)*8:0)};return {start,end,ik:solve(start,end,...s.leg,sign)};});
  out.voice=kind===2&&work.phase==='dig'?Math.sin(clamp((p-.49)/.29,0,1)*Math.PI):0;
  return out;
 }
 function create(parent,texture,data,kind){
  const s=specs[kind],node=new cc.Node(s.name+' cutout rig');parent.addChild(node);node.scale=s.scale;
  const cache={},parts={};
  function frame(key){if(!cache[key]){const r=data.frames[key];cache[key]=new cc.SpriteFrame(texture,cc.rect(r.x,r.y,r.w,r.h));}return cache[key];}
  function part(name,key,w,h,z,ay,parentNode,ax){const n=new cc.Node(name);(parentNode||node).addChild(n);n.anchorX=ax===undefined?.5:ax;n.anchorY=ay;n.zIndex=z;n.setContentSize(w,h);const sprite=n.addComponent(cc.Sprite);sprite.sizeMode=cc.Sprite.SizeMode.CUSTOM;sprite.spriteFrame=frame(key);parts[name]={node:n,sprite};return n;}
  function limb(name,upper,lower,widths,z){const n=new cc.Node(name+' joint');node.addChild(n);n.zIndex=z;const u=part(name+' upper',upper,widths[0],30,0,1,n),joint=new cc.Node(name+' elbow');n.addChild(joint);const l=part(name+' lower',lower,widths[1],30,0,1,joint);return {node:n,upper:u,joint,lower:l};}
  const legRear=limb('Rear leg','thighRear','shinRear',s.legWidth,0),armRear=limb('Rear arm','upperRear','foreRear',s.armWidth,1),legFront=limb('Front leg','thighFront','shinFront',s.legWidth,2);
  const torso=part('Body','torso',...s.body,3,0),head=part('Head','idle',...s.head,1,0,torso);head.setPosition(1,s.headY);
  const armFront=limb('Front arm','upperFront','foreFront',s.armWidth,4),tool=part('Tool','tool',...s.tool,5,0,null,s.toolAnchor),handRear=part('Rear hand','handRear',...s.hand,6,.5),handFront=part('Front hand','handFront',...s.hand,7,.5);
  const voiceNode=new cc.Node('Local megaphone sound marks');node.addChild(voiceNode);voiceNode.zIndex=8;const voice=voiceNode.addComponent(cc.Graphics);
  const soilNode=new cc.Node('Soil on shovel');node.addChild(soilNode);soilNode.zIndex=8;const soil=soilNode.addComponent(cc.Graphics);
  function moveLimb(r,p){r.node.setPosition(p.start.x,p.start.y);r.node.angle=p.ik.a;r.upper.height=p.ik.l1+4;r.joint.setPosition(0,-p.ik.l1);r.joint.angle=p.ik.b-p.ik.a;r.lower.height=p.ik.l2+4;}
  return {node,kind,parts,face:null,pose:null,contact:null,update(work,time,rest,hit,tint){
   const p=pose(kind,work,time,rest,hit);this.pose=p;torso.setPosition(p.hipX,p.hipY);torso.angle=p.lean;head.angle=p.headAngle;
   if(this.face!==p.face){parts.Head.sprite.spriteFrame=frame(p.face);this.face=p.face;}
   tool.setPosition(p.toolX,p.toolY);tool.angle=p.toolAngle;
   moveLimb(armRear,p.arms[0]);moveLimb(armFront,p.arms[1]);moveLimb(legRear,p.legs[0]);moveLimb(legFront,p.legs[1]);
   for(const [i,h]of[[0,handRear],[1,handFront]]){h.setPosition(p.hands[i].x,p.hands[i].y);h.angle=p.arms[i].ik.b;}
   this.contact={x:p.contact.x*s.scale,y:p.contact.y*s.scale};Object.values(parts).forEach(part=>part.node.color=tint);
   soil.clear();if(p.soil>0){soil.fillColor=new cc.Color(123,143,86,Math.round(p.soil*240));soil.ellipse(p.contact.x-2,p.contact.y+2,7,3.4);soil.fill();soil.ellipse(p.contact.x+6,p.contact.y+4,3,2);soil.fill();}
   voice.clear();if(p.voice>.05){const d=rotate(...s.contact,p.toolAngle),angle=Math.atan2(d.y,d.x);voice.strokeColor=new cc.Color(196,231,139,Math.round(p.voice*160));voice.lineWidth=1.6;for(let i=0;i<2;i++){const r=7+i*8+p.voice*4;for(let j=0;j<=10;j++){const a=angle-.55+j*.11,x=p.contact.x+Math.cos(a)*r,y=p.contact.y+Math.sin(a)*r;if(j===0)voice.moveTo(x,y);else voice.lineTo(x,y);}voice.stroke();}}
  }};
 }
 const api={specs,pose,create};if(typeof module!=='undefined')module.exports=api;root.WZWorkerRig=api;
})(typeof globalThis!=='undefined'?globalThis:this);
