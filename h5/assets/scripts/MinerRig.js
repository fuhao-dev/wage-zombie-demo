/* Cocos cutout rig: stable body pieces, two-bone limbs and a rigid pickaxe. */
(function(root){
 'use strict';
 const rad=Math.PI/180,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
 const keys=[
  [0,0,44,-7,-15,64,-92,-3],
  [.055,-2,45,3,-17,69,-81,4],
  [.13,0,44,-7,-15,66,-88,-2],
  [.45,-2,44,3,12,91,30,-3],
  [.53,-3,45,5,12,94,34,-4],
  [.61,8,38,-24,10,52,-115,8],
  [.66,8,38,-24,10,52,-115,8],
  [.84,1,42,-11,-16,57,-98,-4],
  [1,1,42,-11,-16,57,-98,-4]
 ];
 function pose(work,time,rest,hit){
  const p=work.progress||0;let a=keys[0],b=a,q=0;
  if(work.phase==='idle'){
   const r=clamp(rest||0,0,1);a=keys[0];b=keys[keys.length-1];q=r;
  }else{
   for(let i=1;i<keys.length;i++)if(p<=keys[i][0]){a=keys[i-1];b=keys[i];q=(p-a[0])/(b[0]-a[0]);break;}
   q=p>.53&&p<.61?q*q:smooth(q);
  }
  const v=a.map((x,i)=>x+(b[i]-x)*q),breath=Math.sin(time*2.6)*.45;
  const out={hipX:v[1],hipY:v[2]+breath,lean:v[3]+(hit||0)*5,toolX:v[4],toolY:v[5]+breath,toolAngle:v[6],headAngle:v[7],face:work.phase==='startled'?'startled':work.phase==='finish'||(work.phase==='idle'&&rest>.1)?'tired':work.phase==='dig'||work.phase==='start'?'effort':'idle',step:work.walking?Math.sin(work.step):0,walking:work.walking};
  const tip=rotate(29,61,out.toolAngle);out.contact={x:out.toolX+tip.x,y:out.toolY+tip.y};
  return out;
 }
 function rotate(x,y,angle){const c=Math.cos(angle*rad),s=Math.sin(angle*rad);return {x:x*c-y*s,y:x*s+y*c};}
 function solve(start,end,l1,l2,bend){
  const dx=end.x-start.x,dy=end.y-start.y,d=Math.max(.001,Math.hypot(dx,dy)),stretch=Math.max(1,(d+.001)/(l1+l2));l1*=stretch;l2*=stretch;
  const k=clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1),theta=Math.atan2(dy,dx)+bend*Math.acos(k);
  const elbow={x:start.x+Math.cos(theta)*l1,y:start.y+Math.sin(theta)*l1};
  return {elbow,l1,l2,stretch,a:Math.atan2(elbow.x-start.x,start.y-elbow.y)/rad,b:Math.atan2(end.x-elbow.x,elbow.y-end.y)/rad};
 }
 function create(parent,texture,data){
  const rootNode=new cc.Node('Miner cutout rig');parent.addChild(rootNode);rootNode.scale=.94;
  const cache={},parts={};
  function frame(name){if(!cache[name]){const f=data.frames[name];cache[name]=new cc.SpriteFrame(texture,cc.rect(f.x,f.y,f.w,f.h));}return cache[name];}
  function part(name,key,w,h,z,anchorY,parentNode){const n=new cc.Node(name);(parentNode||rootNode).addChild(n);n.anchorX=.5;n.anchorY=anchorY===undefined?1:anchorY;n.zIndex=z;n.setContentSize(w,h);const s=n.addComponent(cc.Sprite);s.sizeMode=cc.Sprite.SizeMode.CUSTOM;s.spriteFrame=frame(key);parts[name]={node:n,sprite:s,w,h};return n;}
  function limb(name,upper,lower,w1,w2,z){
   const n=new cc.Node(name+' joint');rootNode.addChild(n);n.zIndex=z;
   const u=part(name+' upper',upper,w1,30,0,1,n),joint=new cc.Node(name+' elbow');n.addChild(joint);
   const l=part(name+' lower',lower,w2,32,0,1,joint);return {node:n,upper:u,joint,lower:l};
  }
  const legRear=limb('Rear leg','thighRear','shinRear',17,23,0),armRear=limb('Rear arm','upperRear','foreRear',15,10,1),legFront=limb('Front leg','thighFront','shinFront',18,22,2);
  const torso=part('Body','torso',49,57,3,0),head=part('Head','idle',55,55,1,0,torso);head.setPosition(1,53);
  const armFront=limb('Front arm','upperFront','foreFront',16,10.5,4),tool=part('Pickaxe','pickaxe',64,82,5,0);
  const handRear=part('Rear glove','handRear',12.5,15,6,.5),handFront=part('Front glove','handFront',13.5,15,7,.5);
  function moveLimb(r,start,end,l1,l2,bend,boot){const ik=solve(start,end,l1,l2,bend);r.node.setPosition(start.x,start.y);r.node.angle=ik.a;r.upper.height=ik.l1+4;r.joint.setPosition(0,-ik.l1);r.joint.angle=ik.b-ik.a;r.lower.height=ik.l2+(boot?4:3);return ik;}
  const rig={node:rootNode,parts,face:null,pose:null,contact:null,update(work,time,rest,hit,tint){
   const p=pose(work,time,rest,hit);this.pose=p;
   torso.setPosition(p.hipX,p.hipY);torso.angle=p.lean;head.angle=p.headAngle;
   if(this.face!==p.face){parts.Head.sprite.spriteFrame=frame(p.face);this.face=p.face;}
   tool.setPosition(p.toolX,p.toolY);tool.angle=p.toolAngle;
   const hip={x:p.hipX,y:p.hipY+3},leftHip={x:hip.x-9,y:hip.y},rightHip={x:hip.x+10,y:hip.y};
   const stride=p.walking?p.step*14:0,liftL=p.walking?Math.max(0,p.step)*9:0,liftR=p.walking?Math.max(0,-p.step)*9:0;
   moveLimb(legRear,leftHip,{x:-14+stride,y:4+liftL},23,24,-1,true);moveLimb(legFront,rightHip,{x:17-stride,y:4+liftR},23,24,1,true);
   const rear=rotate(-19,43,p.lean),front=rotate(19,43,p.lean);
   const axis=rotate(0,1,p.toolAngle),gripRear={x:p.toolX+axis.x*12,y:p.toolY+axis.y*12},gripFront={x:p.toolX+axis.x*30,y:p.toolY+axis.y*30};
   const ikRear=moveLimb(armRear,{x:p.hipX+rear.x,y:p.hipY+rear.y},gripRear,28,29,-1,false),ikFront=moveLimb(armFront,{x:p.hipX+front.x,y:p.hipY+front.y},gripFront,28,29,1,false);
   handRear.setPosition(gripRear.x,gripRear.y);handFront.setPosition(gripFront.x,gripFront.y);handRear.angle=ikRear.b;handFront.angle=ikFront.b;
   this.contact={x:p.contact.x*.94,y:p.contact.y*.94};
   Object.values(parts).forEach(r=>{r.node.color=tint;});
  }};return rig;
 }
 const api={create,pose,solve,rotate};if(typeof module!=='undefined')module.exports=api;root.WZMinerRig=api;
})(typeof globalThis!=='undefined'?globalThis:this);
