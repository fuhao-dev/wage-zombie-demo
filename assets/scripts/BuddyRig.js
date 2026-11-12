/* Blue ghost foremen and violet chewing coffins; all timing here is cosmetic. */
(function(root){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function pose(p,time,action,moving,upgrade){
  const phase=p.stun>0?'stunned':p.working?'working':action>0?'urging':moving?'moving':'idle';
  const power=clamp(action/.5,0,1),beat=Math.sin(time*(p.working?17:4)),walk=Math.sin(time*12);
  return{phase,face:phase==='stunned'?'dazed':phase==='urging'||phase==='working'?'active':'idle',float:Math.sin(time*2.8+(p.form||1))*2.5,tail:Math.sin(time*3.5)*7,lean:phase==='moving'?5:phase==='urging'?-5+Math.sin((1-power)*Math.PI*2)*5:Math.sin(time*1.7),arm:phase==='urging'?Math.sin((1-power)*Math.PI)*42:phase==='moving'?walk*6:Math.sin(time*2)*2,step:phase==='moving'?walk:0,jaw:p.working?12+(1+beat)*9:phase==='moving'?6+Math.abs(walk)*3:7+Math.sin(time*2)*2,roller:p.working?time*270:0,pulse:upgrade>0?Math.sin(clamp(upgrade,0,1)*Math.PI)*.06:0,power};
 }
 function create(parent,texture,data,type,form,equipmentResources){
  const node=new cc.Node(type==='ji'?'Ghost foreman cutout':'Living coffin cutout');parent.addChild(node);const pieces={},cache={};
  function frame(key){if(!cache[key]){const r=data.frames[key];cache[key]=new cc.SpriteFrame(texture,cc.rect(r.x,r.y,r.w,r.h));}return cache[key];}
  function part(name,key,w,h,x,y,z,ax,ay,owner){const n=new cc.Node(name);(owner||node).addChild(n);n.setContentSize(w,h);n.setPosition(x,y);n.anchorX=ax===undefined?.5:ax;n.anchorY=ay===undefined?.5:ay;n.zIndex=z||0;const s=n.addComponent(cc.Sprite);s.sizeMode=cc.Sprite.SizeMode.CUSTOM;s.spriteFrame=frame(key);pieces[name]={node:n,sprite:s};return n;}
  const size=form===1?.9:form===2?1:1.08;node.scale=size;
  let update,facing=1,anchors;
  if(type==='ji'){
   const body=part('Body','torso',form===3?52:38,43,0,46,3,.5,0),tail=part('Tail','tail',form===3?45:29,36,0,49,0,.5,1),head=part('Head','idle',49,46,0,39,1,.5,0,body);
   anchors={head,body,tail,headSprite:pieces.Head.sprite,headFrames:data.frames,headTexture:texture};
   function arm(name,x,z){const upper=part(name+' upper',name==='Rear'?'upperRear':'upperFront',13,22,x,80,z,.5,1),joint=new cc.Node(name+' elbow');upper.addChild(joint);joint.setPosition(0,-20);const fore=part(name+' fore',name==='Rear'?'foreRear':'foreFront',11,22,0,0,0,.5,1,joint),hand=part(name+' hand',name==='Rear'?'handRear':'handFront',14,16,0,-18,1,.5,.75,fore);return{upper,joint,fore,hand};}
   const rear=arm('Rear',-15,2),front=arm('Front',15,4),whip=part('Whip','whip',22,42,2,-5,1,.5,1,front.hand);
   const ledger=part('Attendance','ledger',form===1?13:24,form===1?18:28,-3,-3,1,.5,.5,rear.hand);
   let extra,stamp,board;if(form===3){ledger.active=false;board=part('Time board','board',24,33,0,-4,2,.5,.5,rear.hand);extra=part('Third arm','extraArm',39,27,-16,83,1,.9,.65);stamp=part('Stamp','stamp',17,25,-30,-4,1,.5,.6,extra);}
   update=(p,t,a,m,u)=>{const s=pose(p,t,a,m,u);body.y=46+s.float;body.angle=s.lean;tail.y=49+s.float;tail.angle=s.tail;head.angle=-s.lean*.4;pieces.Head.sprite.spriteFrame=frame(s.face);front.upper.y=80+s.float;rear.upper.y=80+s.float;front.upper.angle=18-s.arm;front.joint.angle=-28+s.arm*.6;rear.upper.angle=-26-s.arm*.2;rear.joint.angle=28+s.arm*.25;whip.angle=-14-s.arm*.8;if(extra){extra.y=83+s.float;extra.angle=s.phase==='urging'?s.arm*.45:Math.sin(t*2)*3;stamp.angle=-extra.angle;}node.scale=size*(1+s.pulse);return s;};
  }else{
   const width=form===1?70:84,feet=[];let jaw=7,lastTime=null;for(const [i,key]of['footRearL','footRearR','footFrontL','footFrontR'].entries()){feet.push(part('Foot '+i,key,13,16,(i%2?1:-1)*width*(i<2?.28:.35),i<2?11:7,i<2?0:6,.5,.5));}
   const body=part('Body','body',width,32,0,24,3,.5,.5),mouth=new cc.Node('Mouth interior');node.addChild(mouth);mouth.zIndex=1;const mouthG=mouth.addComponent(cc.Graphics);mouthG.fillColor=new cc.Color(41,35,51);mouthG.roundRect(-width*.45,25,width*.9,22,5);mouthG.fill();
   const lid=part('Lid','lid',width+2,27,-width*.43,40,5,.07,.3),eyes=part('Eyes','eyesIdle',34,16,width*.61,10,1,.5,.5,lid);
   anchors={lid,body,eyes,feet,width};
   const mineral=part('Mineral','mineral',25,19,17,36,2),roller=part('Rollers','roller',width*.73,18,0,36,2),crank=part('Crank','crank',23,25,-width*.29,23,6);roller.active=crank.active=form>=2;
   const pillow=part('Pillow','pillow',21,15,-width*.27,35,2);pillow.active=form===1;
   const sides=[];if(form===3)for(const [i,sign]of[-1,1].entries()){const side=part('Side base '+i,i?'sideBaseR':'sideBaseL',34,23,sign*51,22,i?4:0),sl=part('Side lid '+i,i?'sideLidR':'sideLidL',35,19,sign*51-15,35,i?5:1,.07,.3);sides.push({side,lid:sl});}
   update=(p,t,a,m,u)=>{const s=pose(p,t,a,m,u),dt=lastTime===null?.04:clamp(t-lastTime,0,.1);lastTime=t;jaw+=(s.jaw-jaw)*(1-Math.exp(-dt*24));node.y=s.phase==='moving'?Math.abs(s.step)*1.3:0;body.angle=p.working?Math.sin(t*17)*1:0;lid.angle=jaw;eyes.angle=-jaw*.18;pieces.Eyes.sprite.spriteFrame=frame(p.working?'eyesWork':'eyesIdle');mineral.active=!!p.working;mineral.y=42+(p.working?Math.sin(t*17)*2:0);roller.angle=p.working?Math.sin(t*17)*2:0;crank.angle=s.roller;feet.forEach((f,i)=>{f.angle=s.step*(i%2?1:-1)*13;f.y=(i<2?11:7)+Math.max(0,s.step*(i%2?1:-1))*2;});sides.forEach((v,i)=>{v.lid.angle=p.working?jaw+Math.sin(t*17+i*1.7)*4:jaw;});node.scale=size*(1+s.pulse);return s;};
  }
  const Equipment=equipmentResources&&(root.WZPartnerEquipment||(typeof require==='function'?require('./PartnerEquipment'):null));
  const equipment=Equipment&&typeof Equipment.create==='function'?Equipment.create(node,type,anchors,equipmentResources):null;
  return{node,pieces,type,form,equipment,pose:null,update(p,time,action,moving,upgrade,focus){this.pose=update(p,time,action,moving,upgrade);if(equipment)equipment.update(p,time,action,moving,this.pose);if(focus&&Math.abs(focus.x-p.x)>10)facing=focus.x<p.x?-1:1;node.scaleX=Math.abs(node.scaleX)*facing;node.angle=p.stun>0?Math.sin(time*10)*7:0;return this.pose;}};
 }
 const api={pose,create};if(typeof module!=='undefined')module.exports=api;root.WZBuddyRig=api;
})(typeof globalThis!=='undefined'?globalThis:this);
