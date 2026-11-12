/* Two infernal evolutions. Reuse the painted blue/violet bodies; no factory gear,
 * immunity, extra workers or economy changes are conferred by the decoration. */
(function(root){
 'use strict';
 const Buddy=root.WZBuddyRig||require('./BuddyRig');
 const C={ink:'#202f3c',blue:'#52698b',deep:'#30394f',violet:'#66627b',bone:'#d6d4ae',gold:'#c4be91',soul:'#a2cfe0'};
 function color(hex,a){const n=parseInt(hex.slice(1),16);return new cc.Color(n>>16&255,n>>8&255,n&255,a===undefined?255:a);}
 function line(g,ps,c,w,a){g.strokeColor=color(c,a);g.lineWidth=w||1.5;g.moveTo(...ps[0]);ps.slice(1).forEach(p=>g.lineTo(...p));g.stroke();}
 function poly(g,ps,c,stroke){g.fillColor=color(c);g.moveTo(...ps[0]);ps.slice(1).forEach(p=>g.lineTo(...p));g.close();g.fill();if(stroke){g.strokeColor=color(stroke);g.lineWidth=1.6;g.stroke();}}
 function ink(parent,name,z){const n=new cc.Node(name);parent.addChild(n);n.zIndex=z||0;return n.addComponent(cc.Graphics);}
 function formFor(p){return p.form===2?3:2;}
 function create(parent,texture,data,p){
  const form=formFor(p),superForm=p.form===2,type=p.type,base=Buddy.create(parent,texture,data,type,form,null),pieces=base.pieces;
  base.node.name=type==='ji'?'Infernal attendance judge':'Obsidian devouring sarcophagus';
  const aura=ink(base.node,'Infernal partner back seal',-1),effect=ink(base.node,'Duty marks',9);
  const ornaments=[];
  if(type==='ji'){
   const hat=ink(pieces.Head.node,'Bone judge coronet',1);hat.node.y=-9;ornaments.push(hat.node);
   poly(hat,[[-23,39],[-25,54],[-13,50],[-8,62],[0,55],[8,62],[13,50],[25,54],[23,39]],C.deep,C.ink);
   line(hat,[[-22,42],[22,42]],C.bone,2.5);
   for(const sign of[-1,1]){poly(hat,[[sign*16,48],[sign*(superForm?42:32),53],[sign*(superForm?43:32),48],[sign*18,43]],C.bone,C.ink);}
   const robe=ink(pieces.Body.node,'Bone office shoulder mantle',2);ornaments.push(robe.node);
   for(const sign of[-1,1]){poly(robe,[[sign*10,35],[sign*27,42],[sign*34,31],[sign*22,18],[sign*13,20]],C.deep,C.ink);line(robe,[[sign*16,33],[sign*25,34],[sign*23,23]],C.gold,1.7);}
   poly(robe,[[-5,34],[4,34],[6,14],[-4,10]],C.bone,C.ink);line(robe,[[0,30],[0,17]],C.blue,2);
   const whip=ink(pieces.Whip.node,'Bone chained attendance lash',1);ornaments.push(whip.node);
   line(whip,[[0,-3],[3,-12],[0,-23],[-7,-31],[-5,-42]],C.bone,2.3);
   if(superForm){const board=ink(pieces['Time board'].node,'Infernal attendance tablets',1);poly(board,[[-10,-15],[10,-15],[10,15],[-10,15]],C.deep,C.ink);for(const y of[-8,0,8])line(board,[[-6,y],[6,y]],C.bone,1.2);ornaments.push(board.node);}
  }else{
   const lid=pieces.Lid.node.parent,crest=ink(lid,'Hinged sarcophagus bone crown',0);ornaments.push(crest.node);
   // Same non-rendering hinge as the fixed factory helmet; teeth and eyes stay in front.
   const w=84,x=w*.43;
   poly(crest,[[x-40,3],[x-40,14],[x-22,23],[x-9,17],[x+9,17],[x+24,24],[x+40,13],[x+42,3]],C.deep,C.ink);
   for(const sign of[-1,1]){const xx=x+sign*27;poly(crest,[[xx-5,13],[xx+sign*3,superForm?37:28],[xx+sign*13,superForm?43:32],[xx+sign*7,17],[xx+3,9]],C.bone,C.ink);}
   line(crest,[[x-32,8],[x-15,12],[x,6],[x+17,12],[x+32,8]],C.gold,2);
   const armour=ink(pieces.Body.node,'Stone sarcophagus ribs',1);ornaments.push(armour.node);
   for(const x of[-29,-13,13,29]){poly(armour,[[x-3,-10],[x-5,5],[x,9],[x+5,5],[x+3,-10]],C.deep,C.ink);line(armour,[[x,-6],[x,4]],C.bone,1.8);}
   if(superForm)for(const side of['Side base 0','Side base 1']){const g=ink(pieces[side].node,'Side-mouth bone armour',1);line(g,[[-10,-4],[-13,5],[-4,9],[6,5],[12,9]],C.bone,2);ornaments.push(g.node);}
  }
  Object.values(pieces).forEach(v=>v.node.color=color(type==='ji'?'#bfcce8':'#cbc4db'));
  const updateBase=base.update.bind(base);
  base.infernal={superForm,ornaments,phase:'idle'};
  base.update=function(p,time,action,moving,upgrade,focus){
   const s=updateBase(p,time,action,moving,upgrade,focus);this.infernal.phase=s.phase;
   aura.clear();effect.clear();const stunned=s.phase==='stunned',active=s.phase==='urging'||s.phase==='working';
   if(superForm){
    const cx=0,cy=type==='ji'?80:37,rx=type==='ji'?44:64,ry=type==='ji'?35:27;
    aura.strokeColor=color(C.soul,stunned?40:95);aura.lineWidth=1.5;aura.ellipse(cx,cy,rx,ry);aura.stroke();
    for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.sin(time*.8)*.05,x=cx+Math.cos(a)*rx,y=cy+Math.sin(a)*ry;poly(aura,[[x-3,y],[x,y+5],[x+3,y],[x,y-5]],C.bone,C.ink);}
   }
   if(active&&!stunned){
    const cy=type==='ji'?75:40;
    for(const sign of[-1,1])line(effect,[[sign*35,cy-8],[sign*40,cy],[sign*35,cy+8]],C.soul,1.4,140);
   }
   return s;
  };
  return base;
 }
 const api={create,formFor,palette:C};if(typeof module!=='undefined')module.exports=api;root.WZInfernalPartners=api;
})(typeof globalThis!=='undefined'?globalThis:this);
