/* Infernal cutouts share the approved painted limbs. Authored, textured costumes
 * attach to the original joints. No production, timing or collision writes. */
(function(root){
 'use strict';
 const M=root.WZMinerRig||require('./MinerRig'),rotate=M.rotate,solve=M.solve;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);},mix=(a,b,q)=>a+(b-a)*q;
 const specs={
  8:{key:'corpse',name:'Rift chisel worker',body:[46,56],head:[54,54],headY:51,shoulder:18,shoulderY:43,arm:[34,35],armWidth:[15,10.5],leg:[24,25],legWidth:[17,22],hand:[13,15],hip:9,feet:17,scale:.94},
  9:{key:'corpse',name:'Bone claw worker',body:[47,55],head:[53,54],headY:50,shoulder:19,shoulderY:42,arm:[34,35],armWidth:[16,12],leg:[24,25],legWidth:[17,22],hand:[14,16],hip:10,feet:20,scale:.94},
  10:{key:'screamer',name:'Crowned bone horn king',body:[43,63],head:[52,64],headY:57,shoulder:17,shoulderY:47,arm:[32,33],armWidth:[14,10],leg:[26,27],legWidth:[16,21],hand:[13,15],hip:9,feet:18,scale:.94},
  11:{key:'brute',name:'Obsidian stomp worker',body:[77,68],head:[66,60],headY:61,shoulder:30,shoulderY:49,arm:[43,44],armWidth:[32,25],leg:[28,29],legWidth:[30,35],hand:[24,25],hip:17,feet:27,scale:.94}
 };
 function pose(kind,work,time,rest,hit){
  const s=specs[kind];if(!s)throw new Error('Unsupported infernal worker '+kind);
  work=work||{phase:'idle'};time=Number.isFinite(time)?time:0;
  const p=clamp(work.progress||0,0,1),idle=work.phase==='idle',r=clamp(rest||0,0,1),tired=idle?r:smooth((p-.8)/.14),dig=work.phase==='dig';
  const load=idle?0:smooth((p-.32)/.11)*(1-smooth((p-.78)/.13)),stroke=dig?smooth((p-.48)/.13):0,recover=dig?smooth((p-.67)/.12):0,press=stroke*(1-recover);
  const walking=!!work.walking,step=walking?Math.sin(work.step||0):0,breath=Math.sin(time*2.3)*.35;
  const out={kind,hipX:load*(kind===9?3:1),hipY:(kind===10?50:kind===11?52:45)+breath-tired*2-load*(kind===9?7:2),lean:-5-tired*6-load*(kind===9?10:4)+(hit||0)*3,headAngle:work.phase==='startled'?6:-3-tired*5+load*3,walking,step,working:dig,press,voice:kind===10&&dig?Math.sin(clamp((p-.43)/.37,0,1)*Math.PI):0,face:work.phase==='startled'?'startled':work.phase==='finish'||idle&&r>.1?'tired':work.phase==='start'||dig?'effort':'idle'};
  const lift=10*(1-load)-tired*2;
  if(kind===8){
   out.toolX=34;out.toolY=88+lift-press*10;out.toolAngle=0;
   out.hands=[{x:28,y:out.toolY-12},{x:40,y:out.toolY-37}];out.contact={x:34,y:out.toolY-78};
  }else if(kind===9){
   const rake=stroke*(1-recover),reach=load*(1-recover);
   out.hands=[{x:mix(-13,24,reach)-rake*12,y:mix(68,35,reach)-rake*17},{x:mix(27,52,reach)-rake*15,y:mix(65,35,reach)-rake*17}];
   out.toolX=out.hands[1].x;out.toolY=out.hands[1].y;out.toolAngle=0;out.contact={x:out.hands[1].x+4,y:Math.max(0,out.hands[1].y-18)};
  }else if(kind===10){
   // Raise the horn to the moving mouth; both hands stay on its solid handle.
   const mouth=rotate(19,s.headY+20,out.lean);
   out.toolX=mix(26,out.hipX+mouth.x,load);out.toolY=mix(66-tired*6,out.hipY+mouth.y,load);out.toolAngle=mix(-40,-7,load);
   out.hands=[[-9,-4],[-3,-20]].map(v=>{const d=rotate(v[0],v[1],out.toolAngle);return{x:out.toolX+d.x,y:out.toolY+d.y};});
   const tip=rotate(43,5,out.toolAngle);out.contact={x:out.toolX+tip.x,y:out.toolY+tip.y};
  }else{
   out.toolX=29;out.toolY=86+lift;out.toolAngle=0;out.hands=[{x:11,y:out.toolY-10},{x:47,y:out.toolY-14}];out.contact={x:26,y:0};
  }
  out.arms=[-1,1].map((sign,i)=>{const d=rotate(sign*s.shoulder,s.shoulderY,out.lean),start={x:out.hipX+d.x,y:out.hipY+d.y},end=out.hands[i];return{start,end,ik:solve(start,end,...s.arm,sign)};});
  out.legs=[-1,1].map(sign=>{const start={x:out.hipX+sign*s.hip,y:out.hipY+3},stomp=kind===11&&sign===1&&dig?(1-smooth((p-.50)/.12))*Math.sin(clamp((p-.43)/.19,0,1)*Math.PI)*15:0,end={x:sign*s.feet-sign*step*12,y:4+(walking?Math.max(0,-sign*step)*8:stomp)};return{start,end,ik:solve(start,end,...s.leg,sign)};});
  return out;
 }
 const palette={ink:'#1c302f',stone:'#50655a',dark:'#2f433e',edge:'#839380',bone:'#c5c9a2',light:'#e0e1b7',soul:'#8fe2a1',gold:'#c5c18b'};
 function color(hex,a){const n=parseInt(hex.slice(1),16);return new cc.Color(n>>16&255,n>>8&255,n&255,a===undefined?255:a);}
 function poly(g,pts,fill,line,width){g.fillColor=color(fill);g.moveTo(...pts[0]);pts.slice(1).forEach(p=>g.lineTo(...p));g.close();g.fill();if(line){g.strokeColor=color(line);g.lineWidth=width||1.8;g.stroke();}}
 function line(g,pts,c,w,a){g.strokeColor=color(c,a);g.lineWidth=w||1.5;g.moveTo(...pts[0]);pts.slice(1).forEach(p=>g.lineTo(...p));g.stroke();}
 function makeInk(parent,name,z){const n=new cc.Node(name);parent.addChild(n);n.zIndex=z||0;return n.addComponent(cc.Graphics);}
 function armour(g,kind,awake){
  const c=palette,w=kind===11?35:22;g.clear();
  poly(g,[[-w,48],[-w-7,37],[-w+3,15],[-12,5],[0,13],[13,6],[w-1,18],[w+7,38],[w,48],[9,40],[-9,40]],c.dark,c.ink,2.2);
  for(const sign of[-1,1]){
   poly(g,[[sign*9,38],[sign*(w-1),45],[sign*(w+3),34],[sign*12,29]],c.stone,c.ink,1.7);
   line(g,[[sign*10,27],[sign*20,31],[sign*19,22],[sign*10,18]],c.bone,2.2);
   poly(g,[[sign*w,47],[sign*(w+10),60],[sign*(w+18),41],[sign*(w+10),31],[sign*(w-1),34]],c.stone,c.ink,2);
   line(g,[[sign*(w+8),49],[sign*(w+7),39]],c.edge,1.5);
  }
  line(g,[[0,39],[5,31],[-2,23],[3,15]],awake?c.light:c.soul,awake?3:2);
  if(awake)for(const sign of[-1,1])poly(g,[[sign*(w+2),48],[sign*(w+7),67],[sign*(w+12),47]],c.bone,c.ink,1.5);
 }
 function headdress(g,kind,awake){
  const c=palette;g.clear();
  if(kind===10){
   poly(g,[[-25,48],[-29,69],[-15,60],[0,77],[15,60],[29,69],[25,48]],c.gold,c.ink,2);
   line(g,[[-22,51],[22,51]],c.light,2);poly(g,[[0,55],[-5,61],[0,67],[5,61]],c.soul,c.ink,1);
  }else if(kind===9){
   for(const sign of[-1,1])poly(g,[[sign*17,42],[sign*29,48],[sign*31,34],[sign*25,28],[sign*26,40]],c.bone,c.ink,1.6);
   line(g,[[-17,43],[-8,47],[2,43],[15,47],[22,42]],c.edge,2.5);
  }else{
   for(const sign of[-1,1])poly(g,[[sign*18,42],[sign*24,58],[sign*35,67],[sign*29,48],[sign*23,37]],c.stone,c.ink,2);
   poly(g,[[-22,47],[-11,56],[0,51],[12,55],[23,46],[12,43],[0,47],[-12,43]],c.bone,c.ink,1.5);
  }
  if(awake){line(g,[[-24,55],[-32,63],[-34,76]],c.soul,2);line(g,[[24,55],[32,63],[34,76]],c.soul,2);}
 }
 function toolArt(g,kind){
  const c=palette;g.clear();
  if(kind===8){
   poly(g,[[-4,4],[5,4],[5,-58],[10,-66],[0,-78],[-10,-66],[-4,-58]],c.bone,c.ink,2);
   for(const y of[-7,-18,-29])line(g,[[-6,y],[6,y-2]],c.dark,2);
   poly(g,[[-12,-52],[0,-46],[13,-53],[12,-66],[0,-78],[-12,-66]],c.stone,c.ink,2);
   line(g,[[0,-51],[3,-61],[0,-73]],c.soul,2.2);
  }else if(kind===10){
   poly(g,[[-13,7],[-10,-23],[-2,-25],[0,-3],[11,-2],[30,-9],[49,-4],[49,15],[30,22],[12,17]],c.bone,c.ink,2);
   poly(g,[[27,-6],[39,0],[48,-1],[49,12],[38,13],[29,20]],c.dark,c.ink,1.5);
   for(const y of[1,7,13])line(g,[[33,y],[46,y+2]],c.bone,2);
   line(g,[[8,4],[19,9],[23,6]],c.soul,2);
  }else if(kind===11){
   poly(g,[[-9,4],[10,4],[9,-45],[20,-54],[23,-78],[10,-86],[-18,-84],[-24,-65],[-20,-52],[-10,-44]],c.stone,c.ink,2.5);
   line(g,[[0,-49],[6,-60],[-3,-68],[2,-80]],c.soul,2.5);line(g,[[-16,-56],[-18,-71],[-10,-77]],c.edge,2);
   for(const y of[-5,-15,-25])line(g,[[-11,y],[11,y]],c.bone,2.5);
  }
 }
 function clawArt(g,heavy){
  const c=palette;g.clear();const w=heavy?18:11;
  poly(g,[[-w,9],[w+1,7],[w+6,-5],[w-1,-12],[-w-2,-9],[-w-6,0]],c.stone,c.ink,2);
  if(!heavy)for(let i=0;i<3;i++){const x=-7+i*7;poly(g,[[x-3,-5],[x+4,-6],[x+6,-18],[x+1,-23],[x,-13]],c.bone,c.ink,1.4);}
  else line(g,[[-10,4],[-1,-1],[8,2],[12,-6]],c.soul,2);
 }
 function create(parent,texture,data,kind,awake,costume){
  const s=specs[kind];if(!s)throw new Error('Unsupported infernal worker '+kind);
  const node=new cc.Node(s.name+' cutout rig');parent.addChild(node);node.scale=s.scale;const parts={},frames={};
  function frame(key){if(!frames[key]){const r=data.frames[key];frames[key]=new cc.SpriteFrame(texture,cc.rect(r.x,r.y,r.w,r.h));}return frames[key];}
  function part(name,key,w,h,z,ay,owner){const n=new cc.Node(name);(owner||node).addChild(n);n.zIndex=z;n.anchorY=ay;n.anchorX=.5;n.setContentSize(w,h);const sprite=n.addComponent(cc.Sprite);sprite.sizeMode=cc.Sprite.SizeMode.CUSTOM;sprite.spriteFrame=frame(key);parts[name]={node:n,sprite};return n;}
  function limb(name,upper,lower,widths,z){const n=new cc.Node(name+' joint');node.addChild(n);n.zIndex=z;const u=part(name+' upper',upper,widths[0],30,0,1,n),joint=new cc.Node(name+' elbow');n.addChild(joint);const l=part(name+' lower',lower,widths[1],30,0,1,joint);return{node:n,upper:u,joint,lower:l};}
  const lr=limb('Rear leg','thighRear','shinRear',s.legWidth,0),ar=limb('Rear arm','upperRear','foreRear',s.armWidth,1),lf=limb('Front leg','thighFront','shinFront',s.legWidth,2);
  const body=part('Body','torso',...s.body,3,0),head=part('Head','idle',...s.head,1,0,body);head.setPosition(1,s.headY);
  const af=limb('Front arm','upperFront','foreFront',s.armWidth,4),tool=makeInk(node,'Infernal occupation tool',5),hr=part('Rear hand','handRear',...s.hand,6,.5),hf=part('Front hand','handFront',...s.hand,7,.5);
  const plates=makeInk(body,'Bone and obsidian work armour',3),crest=makeInk(head,'Crown or horned bone mask',1),claws=[hr,hf].map(h=>makeInk(h,'Connected gauntlet',1)),fx=makeInk(node,'Local soul work marks',8);
  const costumeParts=[];
  function costumePart(owner,key,z){
   const f=costume&&costume.data.frames[key];if(!f)return null;
   const n=new cc.Node('Painted '+key);owner.addChild(n);n.zIndex=z||0;n.anchorX=n.anchorY=0;n.setPosition(f.left,f.bottom);n.setContentSize(f.width,f.height);
   const sprite=n.addComponent(cc.Sprite);sprite.sizeMode=cc.Sprite.SizeMode.CUSTOM;sprite.spriteFrame=new cc.SpriteFrame(costume.texture,cc.rect(f.x,f.y,f.w,f.h));costumeParts.push({node:n,sprite,key});return n;
  }
  if(costume){
   costumePart(plates.node,kind+'_body');costumePart(crest.node,kind+'_head');
   if(kind!==9)costumePart(tool.node,kind+'_tool');
   claws.forEach(g=>{if(kind===9||kind===11)costumePart(g.node,kind+(kind===9?'_claw':'_gauntlet'));});
   if(awake)for(const sign of[-1,1]){const n=costumePart(body,'awake_shard',4),f=costume.data.frames.awake_shard;n.setPosition(sign*((kind===11?38:27)+f.left),43+f.bottom);n.scaleX=sign;}
  }else{
   armour(plates,kind,awake);headdress(crest,kind,awake);toolArt(tool,kind);claws.forEach(g=>{if(kind===9||kind===11)clawArt(g,kind===11);});
  }
  function moveLimb(r,p){r.node.setPosition(p.start.x,p.start.y);r.node.angle=p.ik.a;r.upper.height=p.ik.l1+4;r.joint.setPosition(0,-p.ik.l1);r.joint.angle=p.ik.b-p.ik.a;r.lower.height=p.ik.l2+4;}
  const rig={node,parts,costumeParts,costumed:!!costume,kind,awake:!!awake,face:null,contact:null,pose:null,update(work,time,rest,hit,tint){
   const p=pose(kind,work,time,rest,hit);this.pose=p;body.setPosition(p.hipX,p.hipY);body.angle=p.lean;head.angle=p.headAngle;
   if(this.face!==p.face){parts.Head.sprite.spriteFrame=frame(p.face);this.face=p.face;}
   moveLimb(ar,p.arms[0]);moveLimb(af,p.arms[1]);moveLimb(lr,p.legs[0]);moveLimb(lf,p.legs[1]);
   [hr,hf].forEach((h,i)=>{h.setPosition(p.hands[i].x,p.hands[i].y);h.angle=kind===9?0:p.arms[i].ik.b;});
   tool.node.setPosition(p.toolX,p.toolY);tool.node.angle=p.toolAngle;tool.node.active=kind!==9;
   Object.values(parts).forEach(v=>{v.node.color=tint||color('#c6d5be');});this.contact={x:p.contact.x*s.scale,y:p.contact.y*s.scale};
   fx.clear();if(p.voice>.05){for(let i=0;i<3;i++){const x=p.contact.x+9+i*9;line(fx,[[x,p.contact.y-8-i*3],[x+4,p.contact.y],[x,p.contact.y+8+i*3]],palette.bone,1.5,Math.round(p.voice*180));}}
   if(this.awake){const power=150+Math.sin(time*3)*30;for(const sign of[-1,1])line(fx,[[sign*31,10],[sign*36,18],[sign*32,26]],palette.soul,1.6,power);}
   return p;
  }};
  rig.update({phase:'idle'},0,0,0);return rig;
 }
 const api={specs,pose,create,palette};if(typeof module!=='undefined')module.exports=api;root.WZInfernalWorkerRig=api;
})(typeof globalThis!=='undefined'?globalThis:this);
