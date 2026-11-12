/* Presentation-only attribution and stable ground depth. No navigation or rewards. */
(function(root){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function depthOrder(items){return items.slice().sort((a,b)=>(a.y-b.y)||(a.id<b.id?-1:a.id>b.id?1:0));}
 class Feedback{
  constructor(){this.actions=new Map();this.owners=new Map();this.finishes=[];}
  accept(e,time){
   if(e.type==='petWork'&&e.partnerType==='ji'&&e.targets&&e.targets.length){this.actions.set(e.id,{id:e.id,targets:e.targets.slice(),primary:e.targetId,since:time});}
   if(e.type==='oreBreak'&&e.processors&&e.processors.length){const previous=this.owners.get(e.id),owner=e.processors.includes(previous)?previous:e.processors[0];this.finishes.push({id:e.id,owner,x:e.x,y:e.y,since:time});if(this.finishes.length>8)this.finishes.shift();}
  }
  sample(model,time){
   const pets=new Map(model.pets.map(p=>[p.id,p])),units=new Map(model.units.map(u=>[u.id,u])),ores=new Map(model.ores.map(o=>[o.id,o])),ghosts=[],coffins=[],owners=new Map();
   this.actions.forEach((a,id)=>{const pet=pets.get(id),age=time-a.since,targets=a.targets.filter(id=>units.has(id));if(!pet||pet.type!=='ji'||pet.stun>0||age>=.5||age<0||!targets.length){this.actions.delete(id);return;}ghosts.push({id,targets,primary:targets.includes(a.primary)?a.primary:targets[0],age,action:.5-age});});
   const groups=new Map();for(const p of model.processing||[]){const pet=pets.get(p.partnerId);if(!pet||pet.type!=='zhu'||pet.stun>0||!pet.working||!ores.has(p.oreId))continue;if(!groups.has(p.oreId))groups.set(p.oreId,[]);const ids=groups.get(p.oreId);if(!ids.includes(p.partnerId))ids.push(p.partnerId);}
   groups.forEach((ids,oreId)=>{const previous=this.owners.get(oreId),owner=ids.includes(previous)?previous:ids[0];owners.set(oreId,owner);let c=coffins.find(c=>c.id===owner);if(!c){c={id:owner,targets:[]};coffins.push(c);}c.targets.push(oreId);});this.owners=owners;
   this.finishes=this.finishes.filter(f=>pets.has(f.owner)&&pets.get(f.owner).stun<=0&&time-f.since<.32&&time>=f.since);
   return{ghosts,coffins,finishes:this.finishes.slice()};
  }
 }
 function draw(g,A,view,anchors,time){
  g.clear();let lines=0,marks=0,streams=0;
  const blue='#99d9ed',violet='#b9a4d2',green='#a2be89';
  function stroke(points,color,width,alpha){g.strokeColor=A.color(color,Math.round(255*clamp(alpha,0,1)));g.lineWidth=width;g.moveTo(points[0][0],-points[0][1]);for(let i=1;i<points.length;i++)g.lineTo(points[i][0],-points[i][1]);g.stroke();}
  function badge(p,color,alpha){if(!p||marks>=12)return;marks++;g.fillColor=A.color('#17292e',Math.round(205*alpha));g.roundRect(p.x-14,-p.y-12,28,24,4);g.fill();stroke([[p.x-14,p.y-12],[p.x+14,p.y-12],[p.x+14,p.y+12],[p.x-14,p.y+12],[p.x-14,p.y-12]],color,2.8,alpha);stroke([[p.x-6,p.y],[p.x-1,p.y+5],[p.x+7,p.y-5]],color,3,alpha);}
  for(const action of view.ghosts){const from=anchors.pet(action.id,'whip'),head=anchors.pet(action.id,'badge'),fade=Math.min(1,(.5-action.age)*5);badge(head,blue,fade);
   for(const id of action.targets){const target=anchors.unit(id);badge(target,blue,fade);if(from&&target&&id===action.primary&&action.age<.22&&lines<3){lines++;const progress=clamp(action.age/.11,0,1),end={x:from.x+(target.x-from.x)*progress,y:from.y+(target.y-from.y)*progress};stroke([[from.x,from.y],[(from.x+end.x)*.5,(from.y+end.y)*.5-7],[end.x,end.y]],blue,3.3,1-action.age/.22);}}
  }
  for(const work of view.coffins){const mouth=anchors.pet(work.id,'mouth');if(!mouth)continue;const x=mouth.x-25,y=mouth.y-45;stroke([[x-11,y-8],[x-11,y+4],[x-6,y+9],[x-2,y+4],[x+3,y+9],[x+8,y+4],[x+11,y+4],[x+11,y-8]],violet,3,.85);
   for(const id of work.targets){const ore=anchors.ore(id);if(!ore)continue;const beat=.5+.5*Math.sin(time*11);stroke([[ore.x-31,ore.y-32],[ore.x-38,ore.y-19],[ore.x-31,ore.y-5]],violet,3.3,.65+beat*.3);stroke([[ore.x+31,ore.y-32],[ore.x+38,ore.y-19],[ore.x+31,ore.y-5]],violet,3.3,.65+beat*.3);
    if(streams>=8)continue;streams++;for(let i=0;i<3;i++){const q=(time*2.6+i/3)%1,x=ore.x+(mouth.x-ore.x)*q,y=ore.y-21+(mouth.y-ore.y+21)*q-Math.sin(q*Math.PI)*9;g.fillColor=A.color(green,Math.round(220*Math.sin(q*Math.PI)));g.moveTo(x-3,-y);g.lineTo(x,-y+4);g.lineTo(x+4,-y);g.lineTo(x,-y-3);g.close();g.fill();}
   }
  }
  for(const finish of view.finishes){const p=anchors.pet(finish.owner,'mouth');if(!p)continue;const q=clamp((time-finish.since)/.32,0,1);stroke([[p.x-15-q*9,p.y-6],[p.x-20-q*9,p.y-12]],violet,2.3,1-q);stroke([[p.x+15+q*9,p.y-6],[p.x+20+q*9,p.y-12]],violet,2.3,1-q);}
 }
 const api={Feedback,depthOrder,draw};if(typeof module!=='undefined')module.exports=api;root.WZPartnerFeedback=api;
})(typeof globalThis!=='undefined'?globalThis:this);
