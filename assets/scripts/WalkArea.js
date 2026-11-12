/* Convex foot-placement polygons, registered to the illustrated worlds at (44,430), 992x832. */
(function(root){
 'use strict';
 const polygons=[
  [[300,725],[855,725],[915,835],[915,1135],[300,1135]],
  [[230,750],[850,750],[900,840],[900,1135],[200,1135],[200,850]],
  [[285,735],[800,735],[870,850],[870,1135],[235,1135],[235,860]]
 ];
 const polygon=map=>polygons[Math.max(0,Math.min(2,map|0))];
 function contains(point,map){if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return false;const p=polygon(map);return p.every((a,i)=>{const b=p[(i+1)%p.length];return(b[0]-a[0])*(point.y-a[1])-(b[1]-a[1])*(point.x-a[0])>=-1e-6;});}
 function center(map){const p=polygon(map);return{x:p.reduce((s,a)=>s+a[0],0)/p.length,y:p.reduce((s,a)=>s+a[1],0)/p.length};}
 function project(point,map){
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return center(map);if(contains(point,map))return{x:point.x,y:point.y};
  const p=polygon(map);let best=null,d=Infinity;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point.x-a[0])*dx+(point.y-a[1])*dy)/(dx*dx+dy*dy))),q={x:a[0]+dx*t,y:a[1]+dy*t},dd=(q.x-point.x)**2+(q.y-point.y)**2;if(dd<d){d=dd;best=q;}}return best;
 }
 function randomPoint(random,map){const p=polygon(map),xs=p.map(a=>a[0]),ys=p.map(a=>a[1]),x0=Math.min(...xs),y0=Math.min(...ys),w=Math.max(...xs)-x0,h=Math.max(...ys)-y0;for(let i=0;i<12;i++){const q={x:x0+random()*w,y:y0+random()*h};if(contains(q,map))return q;}return center(map);}
 function destination(point,angle,distance,map){const start=project(point,map);for(const offset of[0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI*3/4,-Math.PI*3/4,Math.PI]){const p={x:start.x+Math.cos(angle+offset)*distance,y:start.y+Math.sin(angle+offset)*distance};if(contains(p,map))return p;}return project({x:start.x+Math.cos(angle)*distance,y:start.y+Math.sin(angle)*distance},map);}
 const api={polygons,polygon,contains,center,project,randomPoint,destination};if(typeof module!=='undefined')module.exports=api;root.WZWalkArea=api;
})(typeof globalThis!=='undefined'?globalThis:this);
