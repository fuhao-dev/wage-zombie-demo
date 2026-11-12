/* Factory equipment is cosmetic and belongs to an individual partner. */
(function(root){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const frameKeys=['ghostHelmet','coffinHelmet','hoverDisk','trackRear','armUpper','armFore','stamp','trackFront','timeMachine','suspension','lamp','exhaust'];
 function sample(p,time,action,moving,base){
  const gear=p.gear||{},phase=base?base.phase:p.stun>0?'stunned':p.working?'working':action>0?'urging':moving?'moving':'idle';
  const stamp=phase==='urging'?Math.sin((1-clamp(action/.5,0,1))*Math.PI):0;
  return{helmet:!!gear.helmet,vehicle:!!gear.vehicle,phase,moving:phase==='moving',hover:Math.sin(time*2.4)*1.1,tilt:Math.sin(time*1.7)*1.3,stamp,lamp:phase==='stunned'?135:210+Math.sin(time*4)*35};
 }
 // Coordinates are attached to the existing head/lid hinge, never to world space.
 function create(owner,type,anchors,resources){
  if(!resources||!resources.texture||!resources.data||!resources.data.frames||!frameKeys.every(k=>resources.data.frames[k]))return null;
  const pieces={},cache={},data=resources.data,texture=resources.texture;
  function group(name,parent,z){const n=new cc.Node(name);parent.addChild(n);n.zIndex=z||0;return n;}
  function part(name,key,parent,w,h,x,y,z,ax,ay){
   const n=group(name,parent,z),r=data.frames[key];n.setContentSize(w,h);n.setPosition(x,y);n.anchorX=ax===undefined?.5:ax;n.anchorY=ay===undefined?.5:ay;
   if(!cache[key])cache[key]=new cc.SpriteFrame(texture,cc.rect(r.x,r.y,r.w,r.h));
   const sprite=n.addComponent(cc.Sprite);sprite.sizeMode=cc.Sprite.SizeMode.CUSTOM;sprite.spriteFrame=cache[key];pieces[name]={node:n,sprite};return n;
  }
  let helmet,faceOverlay,faceSprite,vehicle,front,upper,elbow,stamp,lamp,exhaust,trackRear,trackFront,trackInk=[],feet=anchors.feet||[],feetActive=feet.map(n=>n.active),faceFrames={};
  if(type==='ji'){
   // Replace only the cap pixels while equipped; draw the original face in front
   // of the hollow helmet so the eye acting and blue skin are always readable.
   helmet=part('Factory ghost helmet','ghostHelmet',anchors.head,61,44,0,27,-1);
   // Creator renders child sprites after the parent sprite, even with negative z.
   // This final child repeats the same original face above the helmet lining.
   faceOverlay=group('Ghost face over helmet',anchors.head,1);faceOverlay.setContentSize(49,46*.55);faceOverlay.anchorX=.5;faceOverlay.anchorY=0;faceSprite=faceOverlay.addComponent(cc.Sprite);faceSprite.sizeMode=cc.Sprite.SizeMode.CUSTOM;faceOverlay.active=false;pieces['Original ghost face']={node:faceOverlay,sprite:faceSprite};
   vehicle=group('Ghost inspection disk',owner,4);vehicle.setPosition(0,42);
   part('Hover disk','hoverDisk',vehicle,106,30,0,0,0);
   exhaust=part('Hover exhaust','exhaust',vehicle,17,14,-34,-9,-1);
   part('Attendance machine','timeMachine',vehicle,23,30,-43,18,2);
   lamp=part('Disk work lamp','lamp',vehicle,12,14,-47,37,3);
   front=group('Mechanical stamp arm',owner,5);front.setPosition(39,54);
   upper=part('Mechanical upper arm','armUpper',front,20,28,0,0,0,.5,.05);
   elbow=group('Mechanical elbow',upper,1);elbow.setPosition(-5.8,21);
   part('Mechanical forearm','armFore',elbow,23,16,0,0,0,.18,.26);
   stamp=part('Mechanical seal','stamp',elbow,19,17,15.64,7.68,1,.5,1);
  }else{
   const width=anchors.width||84;
   // Eyes remain a higher-z sibling. The main lid and its large shell open as one piece.
   helmet=part('Factory coffin helmet','coffinHelmet',anchors.lid,width+17,38,width*.43,33,0);
   vehicle=group('Coffin rear chassis',owner,0);
   trackRear=part('Rear caterpillar','trackRear',vehicle,43,20,-32,2,0);
   const rearRight=part('Rear caterpillar right','trackRear',vehicle,43,20,23,2,0);
   part('Track suspension','suspension',vehicle,width+2,14,0,17,1);
   front=group('Coffin front chassis',owner,7);
   trackFront=part('Front caterpillar','trackFront',front,45,28.5,-28,-3,0);
   const frontRight=part('Front caterpillar right','trackFront',front,45,28.5,28,-3,0);
   lamp=part('Chassis work lamp','lamp',front,10,10,width*.49,11,1);
   // Raster belts retain their painted outline. Only the inset tread plates and
   // wheel spokes are drawn here, so motion is visible without a second atlas.
   for(const track of[trackRear,rearRight,trackFront,frontRight]){
    const n=group('Moving tread plates',track,1),g=n.addComponent(cc.Graphics);n.opacity=135;trackInk.push({g,width:track.width,front:track===trackFront||track===frontRight});
   }
  }
  helmet.active=vehicle.active=front.active=false;
  let previousTime=null,travel=0,paintedTravel=null;
  function belt(g,width,offset,isFront){
   g.clear();g.lineWidth=1.15;g.strokeColor=new cc.Color(173,183,154);
   const half=width*.31,r=isFront?7:6,total=half*4+Math.PI*r*2,yOffset=isFront?-4:0;
   function point(d){
    d=((d%total)+total)%total;
    if(d<half*2)return{x:-half+d,y:r,dx:1,dy:0};d-=half*2;
    if(d<Math.PI*r){const a=Math.PI/2-d/r;return{x:half+Math.cos(a)*r,y:Math.sin(a)*r,dx:Math.sin(a),dy:-Math.cos(a)};}d-=Math.PI*r;
    if(d<half*2)return{x:half-d,y:-r,dx:-1,dy:0};d-=half*2;
    const a=-Math.PI/2-d/r;return{x:-half+Math.cos(a)*r,y:Math.sin(a)*r,dx:Math.sin(a),dy:-Math.cos(a)};
   }
   for(let i=0;i<13;i++){const p=point(offset+i*total/13),nx=-p.dy*1.2,ny=p.dx*1.2;g.moveTo(p.x-nx,p.y-ny+yOffset);g.lineTo(p.x+nx,p.y+ny+yOffset);}
   const wheels=isFront?2:4;for(let i=0;i<wheels;i++){const x=(i-(wheels-1)/2)*width*(isFront?.36:.19),a=offset*.23+i*.6,dx=Math.cos(a)*3.3,dy=Math.sin(a)*3.3;g.moveTo(x-dx,-dy+yOffset);g.lineTo(x+dx,dy+yOffset);g.moveTo(x+dy,-dx+yOffset);g.lineTo(x-dy,dx+yOffset);}
   g.stroke();
  }
  return{pieces,helmet,vehicle,front,state:null,update(p,time,action,moving,base){
   const s=sample(p,time,action,moving,base),dt=previousTime===null?0:clamp(time-previousTime,0,.1);previousTime=time;
   helmet.active=s.helmet;vehicle.active=front.active=s.vehicle;
   feet.forEach((n,i)=>{n.active=s.vehicle?false:feetActive[i];});
   if(type==='ji'){
    anchors.head.setContentSize(49,s.helmet?46*.55:46);
    faceOverlay.active=s.helmet;
    if(s.helmet){const key=base&&base.face||'idle',r=anchors.headFrames[key],cut=Math.round(r.h*.45);if(!faceFrames[key])faceFrames[key]=new cc.SpriteFrame(anchors.headTexture,cc.rect(r.x,r.y+cut,r.w,r.h-cut));anchors.headSprite.spriteFrame=faceSprite.spriteFrame=faceFrames[key];}
   }
   if(s.vehicle){
    lamp.opacity=s.lamp;
    if(type==='ji'){
     vehicle.y=42+s.hover;vehicle.angle=s.tilt;front.y=54+s.hover;front.angle=s.tilt;
     upper.angle=s.tilt*.25;elbow.angle=-5-s.stamp*25;stamp.angle=-upper.angle-elbow.angle;
     exhaust.scaleY=1+Math.sin(time*5)*.06;
    }else{
     if(s.moving)travel+=dt*43;
     owner.y=16+(s.moving?Math.sin(time*20)*.35:0);
     if(paintedTravel!==travel){trackInk.forEach(v=>belt(v.g,v.width,travel,v.front));paintedTravel=travel;}
    }
   }
   this.state=s;return s;
  }};
 }
 const api={sample,create,frameKeys};if(typeof module!=='undefined')module.exports=api;root.WZPartnerEquipment=api;
})(typeof globalThis!=='undefined'?globalThis:this);
