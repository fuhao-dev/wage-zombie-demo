/* Touch-centred closed whip loop. Its visible radius is the hit-test radius. */
(function(root){
 'use strict';
 class WhipMotion{
  constructor(){this.reset();}
  reset(){this.last=null;this.vx=0;this.vy=0;this.speed=0;this.age=1;}
  strike(){this.age=0;}
  update(x,y,dt,active,radius){
   dt=Math.max(0,Math.min(.1,dt));this.age+=dt;
   if(this.last&&dt>0){this.vx=(x-this.last.x)/dt;this.vy=(y-this.last.y)/dt;}else this.vx=this.vy=0;
   this.speed=Math.hypot(this.vx,this.vy);this.last={x,y};
   const points=[];for(let i=0;i<=64;i++){const angle=i*Math.PI/32;points.push([x+Math.cos(angle)*radius,y+Math.sin(angle)*radius]);}
   return {kind:'circle',center:{x,y},radius,points,active:!!active,pulse:Math.exp(-this.age*19)};
  }
 }
 const api={WhipMotion};if(typeof module!=='undefined')module.exports=api;root.WZWhipMotion=api;
})(typeof globalThis!=='undefined'?globalThis:this);
