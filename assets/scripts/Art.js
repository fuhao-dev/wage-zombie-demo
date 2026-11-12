/* Original vector art. Fluid, slime and infernal fire use green exclusively. */
(function(root,factory){const api=factory();if(typeof module!=='undefined')module.exports=api;root.WZArt=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
    'use strict';
    const P={ink:'#0d1d20',bg:'#101c22',panel:'#17292e',edge:'#2c4245',text:'#e0eacc',muted:'#839e95',green:'#c4e78b',mint:'#82d6a2',cyan:'#75e3de',gold:'#e4ce8a',fluid:'#92e35b',blue:'#8eaedb',white:'#eaf1d9'};
    const themes=[
        {accent:P.green,ground:'#253b32',tile:'#2c4236',seam:'#374b3b',prop:'#56715c',dark:'#1a2e29',light:'#9ebc78'},
        {accent:P.cyan,ground:'#1a333c',tile:'#203e47',seam:'#35515b',prop:'#567b86',dark:'#102832',light:'#77bcbc'},
        {accent:'#9eeaa7',ground:'#213732',tile:'#29443b',seam:'#42674d',prop:'#71866b',dark:'#152b28',light:'#9ae4a0'}
    ];
    const cache={};
    function color(hex,alpha){const k=hex+(alpha===undefined?'':alpha);if(cache[k])return cache[k];const s=hex.replace('#','');return cache[k]=new cc.Color(parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16),alpha===undefined?255:alpha);}
    function fill(g,c,stroke,width){g.fillColor=color(c);g.fill();if(stroke){g.strokeColor=color(stroke);g.lineWidth=width||3;g.stroke();}}
    function rect(g,x,y,w,h,r,c,stroke,width){g.roundRect(x,-y-h,w,h,Math.min(r||0,w/2,h/2));fill(g,c,stroke,width);}
    function ellipse(g,x,y,rx,ry,c,stroke,width){g.ellipse(x,-y,rx,ry);fill(g,c,stroke,width);}
    function circle(g,x,y,r,c,stroke,width){g.circle(x,-y,r);fill(g,c,stroke,width);}
    function line(g,pts,c,width,close){g.strokeColor=color(c);g.lineWidth=width||3;g.moveTo(pts[0][0],-pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],-pts[i][1]);if(close)g.close();g.stroke();}
    function poly(g,pts,c,stroke,width){g.moveTo(pts[0][0],-pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],-pts[i][1]);g.close();fill(g,c,stroke,width);}
    function curve(g,a,b,c,d,stroke,width){g.strokeColor=color(stroke);g.lineWidth=width;g.moveTo(a[0],-a[1]);g.bezierCurveTo(b[0],-b[1],c[0],-c[1],d[0],-d[1]);g.stroke();}
    function ring(g,x,y,r,c,width){g.circle(x,-y,r);g.strokeColor=color(c);g.lineWidth=width||3;g.stroke();}
    function bone(g,x,y,s,c){line(g,[[x-s,y-s*.35],[x+s,y+s*.35]],c,5*s/18);for(const p of [[-1,-.35],[1,.35]]){circle(g,x+p[0]*s,y+p[1]*s,4*s/18,c);}}
    function coin(g,x,y,s){circle(g,x,y,s,P.ink);circle(g,x,y,s-3,P.gold);ring(g,x,y,s-8,'#9ba56c',2);line(g,[[x-4,y-8],[x-4,y+8],[x+4,y+8],[x+4,y-8]],P.ink,3);}
    function gem(g,x,y,s,c){poly(g,[[x,y-s],[x+s*.72,y-s*.25],[x+s*.5,y+s*.7],[x-s*.5,y+s*.7],[x-s*.72,y-s*.25]],c,P.ink,3);line(g,[[x,y-s+4],[x-s*.2,y],[x+s*.3,y+s*.5]],P.white,2);}
    function tomb(g,x,y,w,h,map){const t=themes[map];ellipse(g,x,y+3,w*.75,9,t.dark);rect(g,x-w/2,y-h,w,h,Math.min(w/2,18),t.prop,P.ink,4);rect(g,x-w/2+6,y-h+7,w-12,h-10,12,t.seam);line(g,[[x,y-h+15],[x,y-h+36]],t.light,4);line(g,[[x-9,y-h+23],[x+9,y-h+23]],t.light,4);line(g,[[x-9,y-13],[x+10,y-13]],t.prop,3);}
    function grass(g,x,y,map){const t=themes[map];line(g,[[x-12,y],[x-17,y-17],[x-6,y-9],[x,y-27],[x+5,y-6],[x+17,y-18],[x+11,y]],t.prop,3);}
    function background(g,map){
        const t=themes[map];rect(g,0,0,1080,1920,0,P.bg);
        circle(g,1050,60,240,t.dark);circle(g,-100,1180,380,t.dark);
        line(g,[[58,190],[1022,190]],P.edge,2);
        // The field is a small stage: scenery surrounds the unchanged play space.
        rect(g,38,436,1004,840,38,P.ink);
        rect(g,44,430,992,832,34,t.ground,t.seam,3);
        for(let row=0;row<9;row++)for(let col=0;col<6;col++){
            const x=88+col*151,y=478+row*80;
            rect(g,x,y,144,74,map===1?6:18,(row+col)%3===0?t.tile:t.ground);
            if(map===1){circle(g,x+9,y+8,2,t.prop);circle(g,x+132,y+66,2,t.prop);line(g,[[x+20,y+71],[x+65,y+71]],t.seam,1);}
            if(map===0&&(row*6+col)%5===0){line(g,[[x+25,y+30],[x+44,y+29],[x+55,y+35]],t.seam,3);}
        }
        if(map===0){
            // Crooked fence, gravestones and a pale green moon, all away from targets.
            circle(g,907,510,34,'#a7c48e');circle(g,895,500,32,t.ground);
            for(let i=0;i<8;i++){const y=560+i*78;line(g,[[75,y+33],[67,y-28],[86,y-44],[94,y+35]],P.ink,6);}
            for(let i=0;i<8;i++){const y=565+i*77;line(g,[[996,y+25],[1004,y-22],[989,y-38],[982,y+28]],P.ink,6);}
            tomb(g,142,547,56,68,map);tomb(g,957,647,45,58,map);tomb(g,142,1135,42,61,map);tomb(g,911,1229,65,68,map);
            for(const [x,y] of [[120,704],[946,888],[115,992],[862,1200],[228,1219]])grass(g,x,y,map);
            curve(g,[900,575],[861,560],[876,528],[850,510],P.ink,9);line(g,[[873,544],[842,536],[829,514]],P.ink,6);
        }else if(map===1){
            for(const x of [81,959]){rect(g,x,510,40,644,12,t.dark,P.ink,3);for(let i=0;i<7;i++)rect(g,x+10,540+i*86,20,14,3,i%2?t.prop:t.accent);}
            for(const [x,y] of [[143,545],[928,545],[144,1199],[926,1199]]){rect(g,x-30,y-48,60,73,14,P.ink,t.prop,4);rect(g,x-21,y-38,42,42,15,'#386a65');ellipse(g,x,y-17,13,22,'#7bd8b0');line(g,[[x-22,y+13],[x+21,y+13]],t.accent,3);}
            line(g,[[226,489],[336,489],[358,509],[443,509]],t.prop,4);circle(g,448,509,6,t.accent);
        }else{
            // Infernal lava is green, including every crack and splash.
            for(const pts of [[[91,518],[124,588],[105,699],[130,799],[98,908],[120,1050],[95,1183]],[[978,535],[950,650],[978,744],[947,831],[972,943],[950,1080],[976,1178]],[[180,1224],[280,1195],[364,1233],[467,1210],[568,1230],[686,1199],[823,1224]]]){
                line(g,pts,P.ink,22);line(g,pts,'#58bb84',10);line(g,pts,'#b6ef96',3);
            }
            for(const [x,y] of [[150,562],[930,595],[153,1163],[926,1168]]){rect(g,x-19,y-60,38,68,9,t.prop,P.ink,4);bone(g,x,y-42,11,P.white);poly(g,[[x-31,y-68],[x-24,y-91],[x-5,y-77],[x+11,y-96],[x+30,y-68]],t.prop,P.ink,3);}
            for(const x of [250,826]){line(g,[[x,454],[x+10,470],[x,486],[x+10,502]],t.prop,6);}
        }
        // Bottom conveyor reads as scenery until the workshop is unlocked.
        rect(g,330,1219,420,24,12,t.dark,P.ink,3);for(let x=344;x<740;x+=27)line(g,[[x,1226],[x+10,1237]],t.prop,2);
    }
    function zombie(g,kind,map,gold,awake){
        const heavy=[3,7,11].includes(kind),screamer=[2,6,10].includes(kind),mech=kind>=4&&kind<=7,infernal=kind>=8;
        const skin=infernal?'#86b89b':mech?'#94bdb1':'#a2c785',shade=infernal?'#4e7f70':'#6e997b';
        const shirt=gold?P.gold:infernal?'#35584f':mech?'#547783':'#637b6b',w=heavy?72:48;
        ellipse(g,0,4,heavy?48:37,10,'#152a26');
        // Boots and short trousers.
        rect(g,-w/2+4,-22,20,25,6,'#2b4546',P.ink,3);rect(g,w/2-24,-22,20,25,6,'#2b4546',P.ink,3);
        rect(g,-w/2-1,-1,27,10,4,P.ink);rect(g,w/2-23,-1,29,10,4,P.ink);
        poly(g,[[-w/2,-66],[-w/2-3,-23],[-10,-17],[0,-25],[11,-16],[w/2+4,-23],[w/2,-66]],shirt,P.ink,4);
        line(g,[[-7,-63],[-5,-35],[3,-28]],shade,3);circle(g,9,-47,3,P.gold);
        const armW=heavy?18:12;
        line(g,[[-w/2,-62],[-w/2-16,-43],[-w/2-24,-53]],P.ink,armW+6);
        line(g,[[-w/2,-62],[-w/2-16,-43],[-w/2-24,-53]],skin,armW);
        line(g,[[w/2,-62],[w/2+17,-45],[w/2+24,-59]],P.ink,armW+6);
        line(g,[[w/2,-62],[w/2+17,-45],[w/2+24,-59]],skin,armW);
        circle(g,-w/2-25,-54,heavy?11:8,skin,P.ink,3);circle(g,w/2+25,-60,heavy?11:8,skin,P.ink,3);
        // Ears and an asymmetric, comic face.
        ellipse(g,-29,-91,8,12,shade,P.ink,3);ellipse(g,29,-91,8,11,shade,P.ink,3);
        rect(g,-30,-125,60,65,17,skin,P.ink,4);
        poly(g,[[-25,-120],[-19,-135],[-10,-124],[-3,-135],[4,-123],[16,-132],[25,-121]],shade,P.ink,2);
        if(screamer){ellipse(g,0,-79,17,18,P.ink);ellipse(g,0,-73,9,7,shade);rect(g,-9,-94,16,7,1,P.white);}
        else{line(g,[[-14,-76],[1,-72],[18,-79]],P.ink,4);rect(g,1,-76,7,8,1,P.white);}
        ellipse(g,-13,-101,10,12,P.white,P.ink,2);ellipse(g,14,-100,10,10,P.white,P.ink,2);
        circle(g,-10,-99,4,P.ink);circle(g,12,-98,4,P.ink);
        line(g,[[-21,-113],[-9,-115]],P.ink,4);line(g,[[8,-114],[23,-109]],P.ink,4);
        line(g,[[-24,-88],[-16,-85]],shade,2);line(g,[[19,-89],[25,-85]],shade,2);
        // Stitches and ooze are green. No red injury pixels exist in this art.
        line(g,[[-25,-103],[-24,-89]],'#47744d',2);line(g,[[-28,-99],[-21,-97]],'#47744d',2);line(g,[[-28,-93],[-20,-91]],'#47744d',2);
        if(kind===1){ellipse(g,0,-124,35,13,P.gold,P.ink,3);rect(g,-25,-143,50,20,10,'#879d73',P.ink,3);circle(g,2,-133,9,P.gold,P.ink,2);circle(g,2,-133,4,P.white);}
        if(mech){
            rect(g,-35,-109,70,17,5,'#2a4855',P.ink,3);rect(g,-26,-105,20,8,2,P.cyan);rect(g,7,-105,20,8,2,P.cyan);
            rect(g,-w/2-12,-64,20,25,5,'#8aa3a4',P.ink,3);line(g,[[-w/2-6,-58],[-w/2+3,-45]],P.cyan,3);
        }
        if(kind===5){poly(g,[[w/2+10,-65],[w/2+54,-77],[w/2+49,-63],[w/2+66,-62],[w/2+49,-51],[w/2+57,-43],[w/2+15,-45]],'#9daeb0',P.ink,3);line(g,[[w/2+31,-67],[w/2+38,-51]],P.cyan,3);}
        if(kind===4){circle(g,w/2+24,-57,20,'#9baead',P.ink,3);circle(g,w/2+24,-57,10,'#42626a');for(let i=0;i<8;i++){const a=i*Math.PI/4;line(g,[[w/2+24+Math.cos(a)*14,-57+Math.sin(a)*14],[w/2+24+Math.cos(a)*23,-57+Math.sin(a)*23]],P.ink,4);}}
        if(kind===6){rect(g,-34,-143,68,27,7,'#607f87',P.ink,4);for(const x of [-20,20]){circle(g,x,-130,9,P.ink);circle(g,x,-130,5,P.cyan);}line(g,[[25,-141],[35,-161]],P.ink,4);circle(g,36,-164,5,P.cyan);}
        if(kind===7){rect(g,-w/2-32,-72,30,35,5,'#9aa9a7',P.ink,4);rect(g,w/2+5,-73,30,35,5,'#9aa9a7',P.ink,4);line(g,[[-w/2-24,-62],[-w/2-6,-62]],P.cyan,3);}
        if(infernal){
            poly(g,[[-29,-117],[-44,-140],[-21,-133],[-12,-146],[-3,-129],[14,-145],[22,-129],[40,-138],[29,-113]],'#436b5c',P.ink,3);
            line(g,[[-20,-124],[-10,-116],[-16,-108]],P.fluid,3);line(g,[[17,-124],[12,-115],[22,-108]],P.fluid,3);
            poly(g,[[-w/2-2,-66],[-w/2-12,-81],[-11,-72],[0,-56],[w/2+6,-75],[w/2+7,-35],[12,-37],[0,-48],[-15,-32],[-w/2-3,-40]],'#38574f',P.ink,3);
            line(g,[[-12,-60],[-4,-50],[-8,-39]],P.fluid,3);line(g,[[19,-59],[11,-50],[20,-43]],P.fluid,3);
        }
        if(kind===9){for(const sign of [-1,1])for(let i=0;i<3;i++)poly(g,[[sign*(w/2+20+i*4),-62],[sign*(w/2+37+i*5),-86-i*3],[sign*(w/2+30+i*4),-50]],P.white,P.ink,2);}
        if(kind===10){poly(g,[[-31,-130],[-35,-158],[-18,-147],[0,-166],[17,-147],[35,-158],[30,-129]],P.gold,P.ink,3);gem(g,0,-140,7,P.fluid);}
        if(kind===11){for(const sign of [-1,1]){poly(g,[[sign*23,-73],[sign*42,-88],[sign*62,-62],[sign*47,-42],[sign*25,-52]],'#667d6e',P.ink,4);line(g,[[sign*42,-78],[sign*40,-59],[sign*50,-52]],P.fluid,3);}}
        if(gold){line(g,[[-w/2,-65],[w/2,-65]],P.gold,6);circle(g,-13,-101,3,P.gold);}
        if(awake){ring(g,0,-90,43,P.fluid,2);circle(g,-38,-107,4,P.fluid);circle(g,34,-73,3,P.fluid);}
    }
    function pet(g,p,map){
        const enhanced=p.enhanced,skin=p.type==='ji'?(enhanced?'#6da398':'#a1b28a'):(enhanced?'#78a994':'#9dbd9b');
        ellipse(g,0,2,31,8,'#152a26');
        if(p.type==='ji'){
            rect(g,-20,-30,40,24,11,skin,P.ink,3);line(g,[[-16,-10],[-19,0]],P.ink,7);line(g,[[13,-10],[17,0]],P.ink,7);
            poly(g,[[-21,-27],[-37,-38],[-34,-15],[-24,-16]],skin,P.ink,3);
            rect(g,7,-48,32,30,8,skin,P.ink,3);poly(g,[[11,-42],[8,-63],[24,-48]],skin,P.ink,3);poly(g,[[27,-44],[35,-59],[39,-37]],skin,P.ink,3);
            rect(g,29,-34,20,15,5,skin,P.ink,3);circle(g,44,-28,4,P.ink);circle(g,27,-40,4,P.ink);
            line(g,[[10,-23],[29,-21]],enhanced?P.fluid:P.gold,5);if(p.form>=2)circle(g,18,-18,6,P.gold,P.ink,2);
        }else{
            ellipse(g,0,-23,29,23,skin,P.ink,3);for(const x of [-18,12])rect(g,x,-10,10,14,3,P.ink);
            circle(g,22,-25,22,skin,P.ink,3);poly(g,[[13,-39],[7,-60],[28,-43]],skin,P.ink,3);ellipse(g,39,-20,17,12,skin,P.ink,3);
            circle(g,39,-20,3,P.ink);circle(g,49,-20,3,P.ink);circle(g,27,-32,4,P.ink);
            if(p.form>=2){poly(g,[[32,-12],[35,-27],[41,-11]],P.white,P.ink,2);rect(g,-17,-45,29,12,3,'#526e70',P.ink,3);}
            curve(g,[-27,-30],[-43,-47],[-49,-22],[-34,-22],skin,5);
        }
        if(p.form>=3){rect(g,-19,-41,30,14,4,'#6c8581',P.ink,2);line(g,[[-15,-38],[6,-38]],themes[map].accent,3);}
        if(enhanced){for(const x of [-10,6])poly(g,[[x,-40],[x-8,-63],[x+6,-54],[x+9,-75],[x+18,-44]],'#9be3a0',P.ink,2);}
    }
    function ore(g,level,map){const c=[themes[map].prop,themes[map].light,themes[map].accent][level];poly(g,[[-24,5],[-32,-12],[-16,-38],[5,-47],[27,-27],[30,-6],[15,12]],c,P.ink,4);line(g,[[-16,-30],[-4,-15],[-10,1]],themes[map].dark,4);gem(g,5,-18,12,map===0?P.white:themes[map].accent);}
    function whip(g,x,y,map,time,range,feedback){
        const f=feedback||{},m=f.motion,active=!!f.active,pulse=f.pulse||0,r=m?m.radius:range,accent=map===1?P.cyan:P.green;
        // Every glow stroke shares the exact hit radius; brightness never changes its size.
        g.circle(x,-y,r);g.fillColor=color(accent,active?26:6);g.fill();
        for(const [width,alpha]of[[19,active?30:7],[12,active?65:14],[7,active?130:35]]){
            g.circle(x,-y,r);g.lineWidth=width;g.strokeColor=color(accent,alpha);g.stroke();
        }
        const pts=m?m.points:Array.from({length:65},(_,i)=>[x+Math.cos(i*Math.PI/32)*r,y+Math.sin(i*Math.PI/32)*r]);
        const shade=map===0?'#7d815e':map===1?'#5b929b':'#72877a';
        line(g,pts,P.ink,map===2?10:8);line(g,pts,shade,map===2?6:5);line(g,pts,accent,1.6,true);
        // Wrapped grip stays on the closed loop; it is decoration, with no grab requirement.
        const grip=pts.slice(13,20);line(g,grip,P.ink,13);line(g,grip,map===1?'#a7c7bc':'#b9bc94',8);
        for(const i of[14,16,18]){const a=i*Math.PI/32,ux=Math.cos(a),uy=Math.sin(a);line(g,[[x+ux*(r-4),y+uy*(r-4)],[x+ux*(r+4),y+uy*(r+4)]],P.ink,1.7);}
        if(map===2){for(let i=0;i<64;i+=4){const p=pts[i];ellipse(g,p[0],p[1],3,2,'#273a33','#a4b7a3',1);}}
        g.circle(x,-y,r);g.lineWidth=active?3:2;g.strokeColor=color(accent,Math.min(255,(active?245:85)+Math.round(pulse*60)));g.stroke();
        if(active){circle(g,x,y,2.5,accent);line(g,[[x-7,y],[x-4,y]],accent,1);line(g,[[x+4,y],[x+7,y]],accent,1);}
    }
    function icon(g,type,x,y,s,c){
        if(type==='coin')return coin(g,x,y,s);
        if(type==='gem')return gem(g,x,y,s,c||P.green);
        if(type==='whip'){curve(g,[x-s*.5,y+s*.5],[x-s*1.4,y-s],[x+s,y+s],[x+s*.4,y-s*.7],c||P.green,4);line(g,[[x-s*.5,y+s*.5],[x-s*.1,y+s]],P.gold,6);return;}
        if(type==='box'){rect(g,x-s,y-s*.6,s*2,s*1.4,6,c||P.green,P.ink,3);rect(g,x-s,y-s*.6,s*2,s*.5,6,'#567565',P.ink,2);rect(g,x-4,y-s*.25,8,s*.6,2,P.gold);return;}
        if(type==='sound'){poly(g,[[x-s,y-s*.3],[x-s*.5,y-s*.3],[x+s*.1,y-s],[x+s*.1,y+s],[x-s*.5,y+s*.3],[x-s,y+s*.3]],c||P.green);curve(g,[x+s*.4,y-s*.6],[x+s,y-s*.4],[x+s,y+s*.4],[x+s*.4,y+s*.6],c||P.green,3);return;}
        if(type==='flask'){rect(g,x-s*.25,y-s,s*.5,s*.7,2,c||P.green);poly(g,[[x-s*.25,y-s*.3],[x-s*.8,y+s*.7],[x-s*.6,y+s],[x+s*.6,y+s],[x+s*.8,y+s*.7],[x+s*.25,y-s*.3]],c||P.green,P.ink,3);line(g,[[x-s*.45,y+s*.45],[x+s*.45,y+s*.45]],P.ink,3);return;}
        if(type==='arrow'){line(g,[[x-s*.4,y-s*.6],[x+s*.3,y],[x-s*.4,y+s*.6]],c||P.green,4);return;}
        if(type==='close'){line(g,[[x-s*.5,y-s*.5],[x+s*.5,y+s*.5]],c||P.text,4);line(g,[[x+s*.5,y-s*.5],[x-s*.5,y+s*.5]],c||P.text,4);return;}
        if(type==='bone')return bone(g,x,y,s,c||P.text);
        ring(g,x,y,s,c||P.green,3);line(g,[[x-s*.4,y],[x+s*.4,y]],c||P.green,3);line(g,[[x,y-s*.4],[x,y+s*.4]],c||P.green,3);
    }
    return {P,themes,color,rect,ellipse,circle,line,poly,curve,ring,bone,coin,gem,background,zombie,pet,ore,whip,icon};
});
