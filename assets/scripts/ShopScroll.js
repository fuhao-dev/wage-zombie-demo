/* Shop viewport gestures only. No purchases or simulation state live here. */
(function(root){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 class ShopScroll{
  constructor(){this.offset=0;this.max=0;this.velocity=0;this.gesture=null;}
  configure(contentHeight,viewHeight,offset){this.max=Math.max(0,contentHeight-viewHeight);this.offset=clamp(offset||0,0,this.max);this.stop();}
  stop(){this.velocity=0;this.gesture=null;}
  begin(p,time){const settling=Math.abs(this.velocity)>25;this.velocity=0;this.gesture={x:p.x,y:p.y,offset:this.offset,lastY:p.y,lastTime:time,dragged:settling};return settling;}
  move(p,time){
   const g=this.gesture;if(!g)return false;
   if(Math.hypot(p.x-g.x,p.y-g.y)>14)g.dragged=true;
   if(g.dragged){
    const next=clamp(g.offset+g.y-p.y,0,this.max),dt=time-g.lastTime;
    if(dt>0)this.velocity=clamp((next-this.offset)/dt,-1800,1800);
    this.offset=next;
   }
   g.lastY=p.y;g.lastTime=time;return g.dragged;
  }
  end(time){const g=this.gesture;this.gesture=null;if(!g)return false;if(!g.dragged||time-g.lastTime>.12)this.velocity=0;return g.dragged;}
  wheel(delta){this.stop();this.offset=clamp(this.offset+delta,0,this.max);}
  step(dt){
   if(this.gesture||Math.abs(this.velocity)<8){if(!this.gesture)this.velocity=0;return false;}
   dt=clamp(dt,0,.1);const old=this.offset,decay=Math.exp(-10*dt);
   this.offset=clamp(old+this.velocity*(1-decay)/10,0,this.max);this.velocity*=decay;
   if(this.offset===0||this.offset===this.max)this.velocity=0;return this.offset!==old;
  }
 }
 const api={ShopScroll};if(typeof module!=='undefined')module.exports=api;root.WZShopScroll=api;
})(typeof globalThis!=='undefined'?globalThis:this);
