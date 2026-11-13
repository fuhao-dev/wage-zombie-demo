/* Runtime sprite art, animation poses and chapter dressing. No simulation changes. */
(function(root){
 'use strict';
 const A=root.WZArt||require('./Art'),D=root.WZVisualData||require('./VisualData'),Rig=root.WZMinerRig||require('./MinerRig'),Workers=root.WZWorkerRig||require('./WorkerRig'),P=A.P;
 const Buddies=root.WZBuddyRig||require('./BuddyRig'),Factory=root.WZFactoryWorkerRig||require('./FactoryWorkerRig');
 const Infernal=root.WZInfernalWorkerRig||require('./InfernalWorkerRig'),InfernalBuddies=root.WZInfernalPartners||require('./InfernalPartners');
 const chapterAtlases=['miner','corpse','screamer','brute','ghost1','ghost2','ghost3','coffin1','coffin2','coffin3'];
 const factoryAtlases=['drill','cutter','broadcast','hydraulic','equipment','transition'];
 const infernalAtlases=Object.values(Infernal.specs).map(spec=>spec.key).concat(['infernalGhost','infernalCoffin']);
 const atlasNames=['workers','worlds'].concat(chapterAtlases,factoryAtlases,infernalAtlases);
 const textures={},frames={},requests={};let activeMap=0,revision=0;
 const lineage=[0,1,2,3,0,0,2,3,0,0,2,3];
 function bundleName(name){
  if(infernalAtlases.includes(name))return 'infernal';
  if(factoryAtlases.includes(name))return 'factory';
  return chapterAtlases.includes(name)?'cemetery':'sharedart';
 }
 function needed(map){return ['workers','worlds'].concat(chapterAtlases,map>0?factoryAtlases:[],map===2?infernalAtlases:[]);}
 function load(name,done){
  if(textures[name]){done();return;}if(requests[name]){requests[name].push(done);return;}requests[name]=[done];
  const complete=(err,tex)=>{if(!err){textures[name]=tex;revision++;}else console.warn('美术资源加载失败: '+name,err.message||err);const callbacks=requests[name];delete requests[name];callbacks.forEach(fn=>fn(err));};
  if(typeof window!=='undefined'&&window.WZ_WEB_DEMO)cc.assetManager.loadRemote(new URL('assets/bundles/'+bundleName(name)+'/'+D[name].file+'.png',location.href).href,{ext:'.png'},complete);
  else cc.assetManager.loadBundle(bundleName(name),(err,bundle)=>{if(err)complete(err);else bundle.load(D[name].file,cc.Texture2D,complete);});
 }
 function preload(done,map){map=map===undefined?activeMap:map;activeMap=map;const names=needed(map);let left=names.length,failed=null;names.forEach(name=>load(name,err=>{failed=failed||err;if(--left===0&&done)done(failed);}));}
 function resource(name){return textures[name]?{texture:textures[name],data:D[name]}:null;}
 function partner(g,p,icon){
  const form=p.enhanced?(p.form===2?3:2):p.form,normalKey=(p.type==='ji'?'ghost':'coffin')+form;
  const infernal=p.enhanced&&resource(InfernalBuddies.atlasFor(p.type));
  const key=infernal?InfernalBuddies.atlasFor(p.type):normalKey;
  if(!textures[key])return false;
  const id=[key,form,!!p.enhanced,!!icon,!!textures.equipment].join(':');
  if(g._buddy&&g._buddy.id!==id){g._buddy.node.destroy();g._buddy=null;}
  if(!g._buddy){
   g._buddy=infernal?InfernalBuddies.create(g.node,infernal.texture,infernal.data,p)
    :Buddies.create(g.node,textures[key],D[key],p.type,form,p.enhanced?null:resource('equipment'));
   g._buddy.id=id;
   if(icon){
    g._buddy.update(p,0,0,false,0);
    if(infernal)fitPortrait(g._buddy);
    else{
     g._buddy.node.scale*=p.type==='ji'?.64:.84;
     g._buddy.node.y=p.type==='ji'?-30:-12;
    }
   }
  }
  g.clear();if(!icon)A.ellipse(g,0,2,p.type==='ji'?24:form===3?53:35,6,'#26352e');return true;
 }
 function animatePartner(g,p,time,action,moving,upgrade,focus){return g._buddy?g._buddy.update(p,time,action,moving,upgrade,focus):null;}
 function sprite(parent,name,tex,rect){
  const node=new cc.Node(name);parent.addChild(node);const s=node.addComponent(cc.Sprite);s.sizeMode=cc.Sprite.SizeMode.CUSTOM;s.spriteFrame=new cc.SpriteFrame(tex,cc.rect(rect.x,rect.y,rect.w,rect.h));return {node,s};
 }
 function frame(column,pose,portrait){
  const key=column+':'+pose+':'+!!portrait;if(frames[key])return frames[key];
  const f=Object.assign({},D.workers.frames[pose*4+column]);
  if(portrait){f.h=Math.floor(f.h*(column===3?.48:.44));f.foot=.5;}
  return frames[key]={data:f,sprite:new cc.SpriteFrame(textures.workers,cc.rect(f.x,f.y,f.w,f.h))};
 }
 // Fit the idle rig or painted head (including tools and headgear) around the card icon centre.
 function fitPortrait(rig){
  const n=rig.node,parent=n.parent;n.scale=1;n.setPosition(0,0);
  const b=n.getBoundingBoxToWorld(),lo=parent.convertToNodeSpaceAR(cc.v2(b.x,b.y)),hi=parent.convertToNodeSpaceAR(cc.v2(b.x+b.width,b.y+b.height));
  const scale=Math.min(86/Math.max(1,hi.x-lo.x),90/Math.max(1,hi.y-lo.y));
  n.scale=scale;n.setPosition(-(lo.x+hi.x)*.5*scale,-(lo.y+hi.y)*.5*scale);
 }
 function worker(g,kind,map,gold,awake,pose,portrait){
  if(!textures.workers)return false;
  const infernal=Infernal.specs[kind];
  if(infernal&&textures[infernal.key]){
   for(const key of['_worker','_cutout','_miner','_factory'])if(g[key]){g[key].node.destroy();if(g[key].gear)g[key].gear.node.destroy();g[key]=null;}
   if(g._infernal&&(g._infernal.kind!==kind||g._infernal.awake!==!!awake)){g._infernal.node.destroy();g._infernal=null;}
   if(!g._infernal)g._infernal=Infernal.create(g.node,textures[infernal.key],D[infernal.key],kind,awake);
   if(portrait)fitPortrait(g._infernal);
   g.clear();if(!portrait)A.ellipse(g,0,2,kind===11?48:32,7,'#26352e');return true;
  }
  if(g._infernal){g._infernal.node.destroy();g._infernal=null;}
  const factory=Factory.specs[kind];
  if(factory&&textures[factory.key]){
   if(g._worker){g._worker.node.destroy();g._worker.gear.node.destroy();g._worker=null;}
   if(g._cutout){g._cutout.node.destroy();g._cutout=null;}
   if(g._miner){g._miner.node.destroy();g._miner=null;}
   if(!g._factory)g._factory=Factory.create(g.node,textures[factory.key],D[factory.key],kind);
   if(portrait)fitPortrait(g._factory);
   g.clear();if(!portrait)A.ellipse(g,0,2,kind===7?46:30,7,'#26352e');return true;
  }
  if(g._factory){g._factory.node.destroy();g._factory=null;}
  const spec=Workers.specs[kind];
  if(spec&&!portrait&&textures[spec.key]){
   if(g._worker){g._worker.node.destroy();g._worker.gear.node.destroy();g._worker=null;}
   if(!g._cutout)g._cutout=Workers.create(g.node,textures[spec.key],D[spec.key],kind);
   g.clear();A.ellipse(g,0,2,kind===3?46:30,7,'#26352e');dress(g,kind,map,false,gold,awake);return true;
  }
  if(g._cutout){g._cutout.node.destroy();g._cutout=null;}
  if(kind===1&&!portrait&&textures.miner){
   if(g._worker){g._worker.node.destroy();g._worker.gear.node.destroy();g._worker=null;}
   if(!g._miner)g._miner=Rig.create(g.node,textures.miner,D.miner);
   g.clear();A.ellipse(g,0,2,31,7,'#26352e');dress(g,kind,map,false,gold,awake);return true;
  }
  if(g._miner){g._miner.node.destroy();g._miner=null;}
  const column=lineage[kind],f=frame(column,pose||0,portrait),h=[141,145,151,148][column];
  let r=g._worker;
  if(!r||!cc.isValid(r.node)){
   const node=new cc.Node('Hand-drawn worker');g.node.addChild(node);const s=node.addComponent(cc.Sprite);s.sizeMode=cc.Sprite.SizeMode.CUSTOM;
   const gear=new cc.Node('Chapter equipment');g.node.addChild(gear);const gg=gear.addComponent(cc.Graphics);gg.lineJoin=cc.Graphics.LineJoin.ROUND;gg.lineCap=cc.Graphics.LineCap.ROUND;
   r=g._worker={node,s,gear:gg};
  }
  r.s.spriteFrame=f.sprite;r.node.anchorX=portrait?.5:f.data.foot;r.node.anchorY=0;
  const scale=portrait?86/Math.max(f.data.w,f.data.h):h/D.workers.heights[column];
  r.node.setContentSize(f.data.w*scale,f.data.h*scale);r.node.setPosition(0,0);
  // Cool chapter light keeps workwear shadows olive and the miner's lamp pale yellow.
  r.node.color=A.color(gold?'#d2e4ad':map===1?'#d1e8df':'#d1edcf');
  g.clear();if(!portrait)A.ellipse(g,0,2,column===3?48:31,8,'#26352e');
  r.gear.clear();dress(r.gear,kind,map,portrait,gold,awake);
  if(portrait)fitPortrait(r);
  return true;
 }
 function animate(g,kind,map,gold,work,clock,rest,hit){
  const tint=A.color(hit>.38?'#e9ffde':gold?'#d2e4ad':map===1?'#d1e8df':'#d1edcf');
  if(g._infernal){g._infernal.update(work,clock,rest,hit,tint);return g._infernal.contact;}
  if(g._factory){g._factory.update(work,clock,rest,hit,tint);return g._factory.contact;}
  if(kind===1&&g._miner){g._miner.update(work,clock,rest,hit,tint);return g._miner.contact;}
  if(g._cutout){g._cutout.update(work,clock,rest,hit,tint);return g._cutout.contact;}
  if(g._worker)g._worker.node.color=tint;
  return null;
 }
 function dress(g,kind,map,portrait,gold,awake){
  const heavy=[3,7,11].includes(kind),metal='#748c91',dark='#263e49',light='#c1d0c8';
  if(portrait){
   if(kind>=4&&kind<=7){A.rect(g,24,-27,15,21,4,dark,P.ink,2);A.circle(g,31,-16,3,P.cyan);}
   if(kind>=8){A.poly(g,[[-33,-72],[-39,-84],[-17,-78],[-3,-87],[14,-76],[33,-83],[27,-65]],'#536a58',P.ink,2);if(kind===10)A.poly(g,[[-28,-77],[-31,-99],[-13,-88],[0,-105],[13,-89],[31,-99],[28,-76]],P.gold,P.ink,2);}
   return;
  }
  if(kind>=4&&kind<=7){
   A.poly(g,[[-24,-93],[-37,-88],[-34,-63],[-17,-59],[-5,-75]],metal,P.ink,3);A.line(g,[[-29,-84],[-25,-70]],P.cyan,3);
   A.rect(g,-9,-74,29,18,4,dark,P.ink,2);A.circle(g,7,-66,4,P.cyan);
   if(kind===5){A.poly(g,[[21,-74],[36,-80],[65,-55],[37,-55],[21,-62]],light,P.ink,3);for(let i=0;i<3;i++)A.line(g,[[35+i*7,-72+i*5],[33+i*7,-60+i*3]],dark,2);}
   if(kind===4){A.circle(g,36,-58,21,light,P.ink,3);A.circle(g,36,-58,9,dark);for(let i=0;i<10;i++){const a=i*Math.PI/5;A.line(g,[[36+Math.cos(a)*16,-58+Math.sin(a)*16],[36+Math.cos(a)*24,-58+Math.sin(a)*24]],P.ink,3);}A.circle(g,36,-58,4,P.cyan);}
   if(kind===6){A.rect(g,-21,-157,47,23,5,dark,P.ink,3);for(const x of [-8,15]){A.circle(g,x,-145,7,P.ink);A.circle(g,x,-145,3,P.cyan);}A.line(g,[[19,-158],[28,-175]],metal,3);A.circle(g,29,-176,3,P.cyan);}
   if(kind===7){for(const sign of [-1,1]){A.rect(g,sign<0?-64:30,-82,35,35,5,metal,P.ink,3);A.line(g,[[sign*35,-72],[sign*55,-72]],P.cyan,3);A.line(g,[[sign*35,-64],[sign*55,-64]],dark,3);}}
  }
  if(kind>=8){
   for(const sign of [-1,1])A.poly(g,[[sign*15,-103],[sign*32,-115],[sign*(heavy?52:42),-94],[sign*30,-79]],'#5f7165',P.ink,3);
   A.poly(g,[[-22,-80],[-4,-88],[22,-77],[19,-49],[0,-39],[-20,-52]],'#354b44',P.ink,3);A.line(g,[[-3,-82],[4,-65],[-4,-53],[1,-44]],P.fluid,3);
   if(kind===8){A.poly(g,[[23,-63],[40,-69],[54,-49],[38,-39],[23,-46]],'#697a65',P.ink,3);A.line(g,[[35,-61],[39,-51],[34,-44]],P.fluid,3);}
   if(kind===9){for(const sign of [-1,1])for(let i=0;i<3;i++)A.poly(g,[[sign*(31+i*6),-66],[sign*(41+i*7),-96-i*3],[sign*(42+i*6),-59]],'#c9e4b6',P.ink,2);}
   if(kind===10){A.poly(g,[[-25,-147],[-29,-170],[-12,-160],[2,-178],[16,-160],[33,-170],[29,-146]],P.gold,P.ink,3);A.gem(g,3,-158,6,P.fluid);}
   if(kind===11){for(const sign of [-1,1]){A.poly(g,[[sign*29,-95],[sign*48,-106],[sign*68,-83],[sign*61,-53],[sign*34,-52]],'#687c68',P.ink,3);A.line(g,[[sign*48,-98],[sign*43,-81],[sign*53,-69]],P.fluid,3);}}
  }
  if(gold){A.ring(g,0,-79,43,P.gold,1.5);A.circle(g,-35,-103,3,P.gold);}
  if(awake){A.ring(g,0,-78,48,P.fluid,2);A.circle(g,40,-96,4,P.fluid);A.circle(g,-37,-56,3,P.fluid);}
 }
 function world(parent,map){
  if(!textures.worlds)return null;
  const tw=D.worlds.width/3,r={x:Math.round(map*tw)+2,y:1,w:Math.round(tw)-4,h:D.worlds.height-2};
  const s=sprite(parent,'Illustrated '+map,textures.worlds,r);s.node.setPosition(540,-846);s.node.setContentSize(992,832);return s.node;
 }
 function chrome(g,map){
  const t=A.themes[map];
  A.rect(g,73,449,330,48,13,P.panel,P.edge,2);
  A.rect(g,330,1219,420,24,10,'#172a2b',P.ink,3);
  for(let x=344;x<741;x+=29){A.line(g,[[x,1225],[x+11,1237]],map===1?'#698993':'#70866b',2);}
  A.circle(g,337,1231,11,t.prop,P.ink,2);A.circle(g,746,1231,11,t.prop,P.ink,2);
  // Distinct trims use the same interface and hit regions.
  if(map===0){for(const [x,y]of[[45,1306],[1034,1306],[45,1883],[1034,1883]]){A.line(g,[[x-8,y-7],[x+8,y+7]],'#899578',4);A.circle(g,x,y,3,P.ink);}}
  else if(map===1){for(const x of[39,1036]){A.rect(g,x,1325,5,80,2,P.cyan);A.rect(g,x,1796,5,60,2,P.cyan);}for(let i=0;i<5;i++)A.line(g,[[410+i*23,1302],[422+i*23,1315]],P.gold,5);}
  else{for(const x of[47,1033]){A.poly(g,[[x-8,1324],[x,1305],[x+9,1323],[x+4,1345],[x-5,1346]],'#a2bf9c',P.ink,2);A.line(g,[[x,1353],[x+3,1391],[x-2,1410]],P.fluid,2);}}
 }
 const api={preload,resource,worker,animate,partner,animatePartner,world,chrome,lineage,bundleName,needed,get revision(){return revision;},get ready(){return needed(activeMap).every(k=>!!textures[k]);},get status(){return Object.assign({ready:api.ready,version:D.version,map:activeMap},Object.fromEntries(atlasNames.map(k=>[k,!!textures[k]])));}};
 if(typeof module!=='undefined')module.exports=api;root.WZVisuals=api;
})(typeof globalThis!=='undefined'?globalThis:this);
