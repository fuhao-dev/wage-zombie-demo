/* Cemetery -> factory presentation only. The caller owns all economy and chapter changes.
 * Coordinates are local to the supplied parent, with native Cocos Y (down is negative).
 * depart() keeps its final dark cover and hidden actors until cancel()/destroy().
 * arrive() restores actor parents/depth/transforms before invoking its completion callback.
 * Freeze regular actor rendering while active; prepare tired poses before passing nodes.
 */
(function(root){
 'use strict';
 const TIMES=Object.freeze({enter:.55,settle:.16,hold:.1,stagger:.035,load:.4,drop:1,land:.12,leave:.5});
 const ENTRY=TIMES.enter+TIMES.settle*2+TIMES.hold;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
 const lerp=(a,b,t)=>a+(b-a)*t;
 const countOf=n=>Number.isFinite(Number(n))?Math.max(0,Math.floor(Number(n))):0;
 function checkMode(mode){if(mode!=='depart'&&mode!=='arrive')throw new Error('Unknown chapter transition: '+mode);}
 function transportEnd(mode,count){return ENTRY+(count?TIMES.stagger*(count-1)+(mode==='depart'?TIMES.load:TIMES.drop+TIMES.land):0);}
 function duration(mode,count){checkMode(mode);return transportEnd(mode,countOf(count))+TIMES.leave;}
 function sample(mode,time,count){
  checkMode(mode);count=countOf(count);const total=duration(mode,count),t=clamp(Number.isFinite(time)?time:0,0,total),end=transportEnd(mode,count);
  let phase=t<TIMES.enter?'enter':t<TIMES.enter+TIMES.settle*2?'settle':t<ENTRY?'ready':t<end?'transport':t<total?'leave':'done';
  const entry=smooth(t/TIMES.enter),leave=smooth((t-end)/TIMES.leave),settle=t>=TIMES.enter&&t<TIMES.enter+TIMES.settle*2?Math.sin((t-TIMES.enter)/TIMES.settle*Math.PI)*3.5:0;
  const actors=[];
  for(let i=0;i<count;i++){
   const age=t-ENTRY-i*TIMES.stagger;
   if(mode==='depart'){
    const progress=clamp(age/TIMES.load,0,1),edge=smooth((progress-.72)/.28);
    actors.push({index:i,progress,opacity:1-edge,scale:1-.16*edge,tilt:Math.sin(progress*Math.PI)*-5,land:0,visible:age<TIMES.load});
   }else{
    const progress=clamp(age/TIMES.drop,0,1),land=clamp((age-TIMES.drop)/TIMES.land,0,1);
    actors.push({index:i,progress,opacity:age<0?0:smooth(progress/.12),scale:.94+.06*smooth(progress),tilt:Math.sin(progress*Math.PI)*4,land,visible:age>=0});
   }
  }
  return {mode,time:t,total,phase,entry,settle,leave,transportEnd:end,complete:t>=total,open:t>=TIMES.enter&&t<end,cover:mode==='depart'?.18+.82*leave:.18*(1-leave),actors};
 }
 class Timeline{
  constructor(mode,count,onDone){checkMode(mode);this.mode=mode;this.count=countOf(count);this.time=0;this.total=duration(mode,this.count);this.finished=false;this.onDone=onDone||null;}
  update(dt){
   this.time=Math.min(this.total,this.time+(Number.isFinite(dt)?Math.max(0,dt):0));
   const view=sample(this.mode,this.time,this.count);
   if(view.complete&&!this.finished){this.finished=true;const done=this.onDone;this.onDone=null;if(done)done(view);}
   return view;
  }
  cancel(){this.finished=true;this.onDone=null;}
 }
 function color(hex,alpha){const n=parseInt(hex.slice(1),16);return new cc.Color((n>>16)&255,(n>>8)&255,n&255,alpha===undefined?255:Math.round(alpha));}
 function valid(node){return !!node&&(!cc.isValid||cc.isValid(node,true));}
 function point(x,y){return cc.v2?cc.v2(x,y):{x,y};}
 function localPoint(parent,node,x,y){return parent.convertToNodeSpaceAR(node.convertToWorldSpaceAR(point(x||0,y||0)));}
 function sibling(node){return node.getSiblingIndex?node.getSiblingIndex():node.parent?node.parent.children.indexOf(node):0;}
 function add(parent,name){const n=new cc.Node(name);parent.addChild(n);return n;}
 function graphics(parent,name){return add(parent,name).addComponent(cc.Graphics);}
 function rect(g,x,y,w,h,hex,alpha){g.fillColor=color(hex,alpha);g.rect(x,y,w,h);g.fill();}
 function line(g,points,hex,width,alpha){g.strokeColor=color(hex,alpha);g.lineWidth=width;g.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)g.lineTo(points[i][0],points[i][1]);g.stroke();}
 function label(parent,text,x,y,size,width){
  const n=add(parent,'Sign '+text);n.setPosition(x,y);n.setContentSize(width,size*1.5);
  const l=n.addComponent(cc.Label);l.string=text;l.fontFamily='Microsoft YaHei';l.fontSize=size;l.lineHeight=Math.ceil(size*1.3);l.horizontalAlign=cc.Label.HorizontalAlign.CENTER;l.verticalAlign=cc.Label.VerticalAlign.CENTER;l.overflow=cc.Label.Overflow.SHRINK;l.enableWrapText=false;n.color=color('#dbe4bd');return n;
 }
 class TransitionView{
  constructor(parent,options){
   this.parent=parent;this.options=Object.assign({width:1080,height:1920},options||{});this.node=add(parent,'Cemetery factory transition');
   this.records=[];this.timeline=null;this.running=false;this.holding=false;this.destroyed=false;this.mode=null;this.onDone=null;this.phase=null;
  }
  _capture(actors){
   const seen=new Set();this.records=[];
   (actors||[]).forEach(a=>{
    const d=a&&a.node?a:{node:a},n=d.node;if(!valid(n)||seen.has(n))return;seen.add(n);
    const p=localPoint(this.node,n,0,0),px=localPoint(this.node,n,1,0),py=localPoint(this.node,n,0,1),dx=px.x-p.x,dy=px.y-p.y;
    const sign=n.scaleX<0?-1:1,sx=Math.hypot(dx,dy)*sign,sy=sx?(dx*(py.y-p.y)-dy*(py.x-p.x))/sx:n.scaleY;
    this.records.push({node:n,parent:n.parent,sibling:sibling(n),zIndex:n.zIndex,x:n.x,y:n.y,scaleX:n.scaleX,scaleY:n.scaleY,angle:n.angle,opacity:n.opacity,active:n.active,
     flightX:Number.isFinite(d.x)?d.x:p.x,flightY:Number.isFinite(d.y)?d.y:p.y,flightScaleX:sx,flightScaleY:sy,flightAngle:Math.atan2(dy*sign,dx*sign)*180/Math.PI});
   });
  }
  _restore(){
   const records=this.records;this.records=[];
   records.forEach(r=>{const n=r.node;if(!valid(n)||!valid(r.parent))return;n.parent=r.parent;n.setPosition(r.x,r.y);n.scaleX=r.scaleX;n.scaleY=r.scaleY;n.angle=r.angle;n.opacity=r.opacity;n.active=r.active;n.zIndex=r.zIndex;});
   records.slice().sort((a,b)=>a.sibling-b.sibling).forEach(r=>{if(valid(r.node)&&r.node.parent===r.parent&&r.node.setSiblingIndex)r.node.setSiblingIndex(r.sibling);});
  }
  _clear(){if(valid(this.node))this.node.children.slice().forEach(n=>n.destroy());this.back=null;this.fx=null;this.prop=null;this.props=null;this.actorsLayer=null;}
  _build(){
   const o=this.options;this.back=graphics(this.node,'Quiet chapter cover');this.prop=add(this.node,'Transport prop');this.props={};
   const keys=this.mode==='depart'?['truckOpen','truckClosed']:['hatchOpen','hatchClosed'],data=o.data||{},frames=data.frames||{},cellW=(data.width||1254)/2,cellH=(data.height||1254)/2;
   keys.forEach((key,index)=>{
    const f=frames[key];if(!o.texture||!f)return;const n=add(this.prop,key);n.anchorX=0;n.anchorY=1;n.setPosition(f.x-index*cellW-cellW/2,cellH/2-(f.y-(this.mode==='arrive'?cellH:0)));n.setContentSize(f.w,f.h);
    const sprite=n.addComponent(cc.Sprite);sprite.sizeMode=cc.Sprite.SizeMode.CUSTOM;sprite.spriteFrame=new cc.SpriteFrame(o.texture,cc.rect(f.x,f.y,f.w,f.h));this.props[key]=n;
   });
   this.actorsLayer=add(this.node,'Transported original team');this.fx=graphics(this.node,'Transport rings and dust');
   this.sign=label(this.prop,this.mode==='depart'?'员工专用':'到岗 → 开工',this.mode==='depart'?72:0,this.mode==='depart'?53:-267,this.mode==='depart'?22:25,240);
   this.notice=label(this.prop,'全员转岗',91,-113,20,180);this.notice.angle=-6;
   this.records.forEach(r=>{if(valid(r.node))r.node.parent=this.actorsLayer;});
  }
  _start(mode,actors,onDone){
   if(this.destroyed||this.running||(this.holding&&mode==='depart'))return false;
   if(this.holding)this.cancel();this.mode=mode;this.onDone=onDone||null;this._capture(actors);this._build();
   this.timeline=new Timeline(mode,this.records.length);this.running=true;this.holding=false;this.phase='enter';this._render(sample(mode,0,this.records.length));return true;
  }
  depart(actors,onDone){return this._start('depart',actors,onDone);}
  arrive(actors,onDone){return this._start('arrive',actors,onDone);}
  _render(view){
   const o=this.options,w=o.width,h=o.height,depart=view.mode==='depart',propScale=depart?w/1080*1.38:w/1080*1.05;
   const center={x:w*(depart?.602:.5),y:-h*(depart?.417:.318)};
   this.prop.scaleX=this.prop.scaleY=propScale;
   this.prop.x=depart?lerp(-w*.65,center.x,view.entry)+w*1.45*view.leave:center.x;
   this.prop.y=center.y+view.settle+(depart?0:h*.55*view.leave);
   this.prop.angle=depart?view.settle*.12:0;
   const openKey=depart?'truckOpen':'hatchOpen',closedKey=depart?'truckClosed':'hatchClosed';
   if(this.props[openKey])this.props[openKey].active=view.open;
   if(this.props[closedKey])this.props[closedKey].active=!view.open;
   this.prop.active=!view.complete;this.notice.active=depart&&view.phase==='leave';this.sign.opacity=255;
   this.back.clear();rect(this.back,0,-h,w,h,'#101e22',view.cover*255);
   const g=this.fx;g.clear();
   const mouth={x:center.x-w*.2,y:center.y-h*.077},spawn={x:center.x,y:center.y-h*.068};
   this.records.forEach((r,i)=>{
    const n=r.node;if(!valid(n))return;const a=view.actors[i],p=smooth(a.progress);let x,y;
    if(depart){
     x=lerp(r.flightX,mouth.x,p);y=lerp(r.flightY,mouth.y,p)+Math.sin(p*Math.PI)*h*.025;
    }else{
     x=lerp(spawn.x,r.flightX,p);y=lerp(spawn.y,r.flightY,p)+Math.sin(p*Math.PI)*h*.04;
     if(a.progress>=1)y+=Math.sin(a.land*Math.PI)*3;
    }
    n.setPosition(x,y);n.scaleX=r.flightScaleX*a.scale;n.scaleY=r.flightScaleY*a.scale;n.angle=r.flightAngle+a.tilt;n.opacity=Math.round(r.opacity*a.opacity);n.active=r.active&&a.visible;
    if(a.progress>0&&a.progress<1&&i%Math.max(1,Math.ceil(this.records.length/18))===0){
     const strength=Math.sin(a.progress*Math.PI),radius=24+9*Math.sin(a.progress*5),points=[];
     for(let j=0;j<=15;j++){const angle=j/15*Math.PI*2+view.time*9;points.push([x+Math.cos(angle)*radius,y+51+Math.sin(angle)*radius*.42]);}
     line(g,points,'#a0e7c7',3,180*strength);
     line(g,[[x-8,y+45],[x-20,y+35],[x-14,y+25]],'#d2e4b5',2,100*strength);
    }
   });
   // A shallow threshold hides the final edge of loading without distorting bodies.
   if(depart&&view.phase==='transport'){
    const a=150+Math.sin(view.time*8)*22;rect(g,mouth.x-15,mouth.y-5,41,102,'#23322e',a);
    line(g,[[mouth.x-14,mouth.y-5],[mouth.x-14,mouth.y+95]],'#687c66',4,180);
   }
   if(view.phase==='settle'||view.phase==='leave'){
    const power=view.phase==='leave'?Math.sin(view.leave*Math.PI):.5;
    for(let i=0;i<7;i++){
     const x=this.prop.x+(i-3)*31*propScale-(depart?70:0),y=depart?center.y-h*.15:center.y-h*.17;
     g.fillColor=color('#9bab8d',power*80);g.ellipse(x,y+Math.sin(i*1.9+view.time*5)*6,15+i*2,7+i);g.fill();
    }
   }
  }
  update(dt){
   if(!this.running)return null;const view=this.timeline.update(dt);this.phase=view.phase;this._render(view);
   if(view.complete){
    this.running=false;this.holding=this.mode==='depart';const done=this.onDone;this.onDone=null;
    if(!this.holding){this._restore();this._clear();this.mode=null;}
    if(done)done();
   }
   return view;
  }
  cancel(){if(this.timeline)this.timeline.cancel();this.onDone=null;this.running=false;this.holding=false;this._restore();this._clear();this.timeline=null;this.mode=null;this.phase=null;}
  destroy(){if(this.destroyed)return;this.cancel();if(valid(this.node))this.node.destroy();this.destroyed=true;}
  get active(){return this.running||this.holding;}
  get elapsed(){return this.timeline?this.timeline.time:0;}
 }
 function create(parent,options){return new TransitionView(parent,options);}
 const api={TIMES,ENTRY,duration,sample,Timeline,create};if(typeof module!=='undefined')module.exports=api;root.WZChapterTransition=api;
})(typeof globalThis!=='undefined'?globalThis:this);
