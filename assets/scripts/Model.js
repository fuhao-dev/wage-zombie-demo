/* Engine-independent simulation. Cocos Game component consumes its events. */
(function(root,factory){
    var api=factory(root.WZData||(typeof require==='function'?require('./Data'):null),root.WZWalkArea||(typeof require==='function'?require('./WalkArea'):null));
    if(typeof module!=='undefined')module.exports=api;
    root.WZModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Data,Walk){
    'use strict';
    const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
    const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const KIND_NAMES=['普通腐尸','矿工僵尸','尖叫僵尸','大块头僵尸','切割改造尸','钻头改造尸','广播改造尸','液压重锤尸','熔岩掘地尸','炼狱裂爪尸','咆哮尸王','岩甲巨尸'];
    const CHAPTERS=[
        {name:'荒野墓园',short:'墓园',subtitle:'旧墓里，也有新生意',rare:'骨晶',exit:'escape_earth',goal:2e9,newKinds:[],accent:'#c4e78b'},
        {name:'赛博尸厂',short:'尸厂',subtitle:'接通电源，全员开工',rare:'电核',exit:'escape_moon',goal:5e14,newKinds:[4,5,6,7],accent:'#75e3de'},
        {name:'熔岩冥界',short:'冥界',subtitle:'幽绿魂火，生意不灭',rare:'魂晶',exit:'escape_sun',goal:2e21,newKinds:[8,9,10,11],accent:'#9eeaa7'}
    ];
    function fresh(){return {version:1,map:0,coins:0,rare:[0,0,0],buys:{},gifts:{},units:[],pets:[],ores:[],transports:[],collects:[],boxes:[0,0,0,0],skills:{4:{charge:0,time:0},5:{charge:0,time:0}},buffs:{double:0,circle:0,frenzy:0,doubleTool:0},hits:0,activeTime:0,lastSeen:Date.now(),offlineReward:0,offlineSeconds:0,completed:false,pendingChapter:false,settings:{sound:true}};}
    class GameModel{
        constructor(saved,random){
            this.random=random||Math.random;this.events=[];this.serial=0;this.time=0;this.oreCd=0;this.saveTimer=0;this.sandbox=false;this.cursor=null;this.skillActive=null;this.ores=[];this.transports=[];this.pendingDig=[];this.specialBox=null;
            this.processing=[];this.state=fresh();
            if(saved&&saved.version===1){
                this.state=Object.assign(fresh(),JSON.parse(JSON.stringify(saved)));
                this.state.map=clamp(Math.floor(+this.state.map||0),0,2);
                this.state.coins=Number.isFinite(+this.state.coins)?Math.max(0,+this.state.coins):0;
                this.state.rare=[0,1,2].map(i=>Number.isFinite(+this.state.rare[i])?Math.max(0,+this.state.rare[i]):0);
                this.state.buys=this.state.buys||{};this.state.gifts=this.state.gifts||{};
                this.state.collects=Array.from(new Set(this.state.collects||[])).filter(id=>Data.collects.some(c=>c.id===id));
                this.state.pets=Array.isArray(this.state.pets)?this.state.pets:[];
                this.state.buffs=Object.assign(fresh().buffs,this.state.buffs||{});
                this.state.skills=Object.assign(fresh().skills,this.state.skills||{});
            }
            this.units=[];
            (this.state.units||[]).forEach(u=>{if(u.kind>=0&&u.kind<=11)this.units.push(this.makeUnit(u.kind,u.x,u.y));});
            this.pets=this.state.pets.map(p=>this.makePet(p.type,p.form,p.enhanced,p.x,p.y));
            this.ores=(Array.isArray(this.state.ores)?this.state.ores:[]).map(o=>Object.assign({},o,Walk.project(o,this.state.map),{progress:0,pressing:false,id:'o'+(++this.serial)}));
            this.transports=(Array.isArray(this.state.transports)?this.state.transports:[]).filter(t=>Number.isFinite(t.value)&&t.value>=0&&t.time>0).map(t=>Object.assign({},t,{id:'t'+(++this.serial)}));
            this.syncUnits();
            if(!saved&&this.units.length===1){this.units[0].x=540;this.units[0].y=840;}
            if(saved)this.addOffline(Math.max(0,(Date.now()-(+saved.lastSeen||Date.now()))/1000));
        }
        get chapter(){return CHAPTERS[this.state.map];}
        get shop(){return Data.shops[this.state.map];}
        buyCount(id){return Math.max(0,Math.floor(+this.state.buys[id]||0));}
        item(id){return this.shop.find(x=>x.id===id);}
        effect(key){return this.shop.reduce((sum,x)=>sum+(x.type===4&&x.effect===key?(x.add||0)*this.buyCount(x.id):0),0);}
        collect(key){return Data.collects.reduce((sum,x)=>sum+(x.effect===key&&this.state.collects.includes(x.id)?x.add:0),0);}
        cost(item){return Math.ceil(item.baseCost*Math.pow(item.costGrow,this.buyCount(item.id)));}
        maxCount(item){let extra=0;if(item.type===0){if(!this.chapter.newKinds.includes(item.kind))extra+=this.effect('toolMaxAdd');extra+=this.effect('toolMaxAdd'+item.kind);}return item.maxCount+extra;}
        prerequisite(item){if(!item.pre)return null;const a=item.pre.split(':');return {id:a[0],count:+a[1]||1};}
        canBuy(item){
            if(!item)return {ok:false,reason:'商品不存在'};
            if(this.buyCount(item.id)>=this.maxCount(item))return {ok:false,reason:'已满级',full:true};
            const pre=this.prerequisite(item);
            if(pre&&this.buyCount(pre.id)<pre.count){const x=this.item(pre.id);return {ok:false,reason:(x?x.name:pre.id)+' '+pre.count+'次解锁',locked:true};}
            if(item.type===3&&!this.pets.some(p=>p.type===(item.fruitPetId==='pet_ji'?'ji':'zhu')&&p.form===item.upLvFrom&&!p.enhanced))return {ok:false,reason:'暂无可进化伙伴',locked:true};
            const balance=item.costType===0?this.state.coins:this.state.rare[this.state.map];
            if(balance<this.cost(item))return {ok:false,reason:'还差 '+format(this.cost(item)-balance),poor:true};
            return {ok:true,reason:''};
        }
        buy(id){
            const item=this.item(id),check=this.canBuy(item);if(!check.ok)return check;
            const price=this.cost(item);if(item.costType===0)this.state.coins-=price;else this.state.rare[this.state.map]-=price;
            this.state.buys[id]=this.buyCount(id)+1;
            if(item.type===0){this.syncUnits();if((item.kind===4||item.kind===5)&&this.buyCount(id)===1)this.state.skills[item.kind].charge=Math.min(this.chargeMax(item.kind),this.state.skills[item.kind].charge+1);}
            if(item.type===2){
                const type=id==='pet_ji'||id==='sun_pet_jinwu'?'ji':'zhu';const enhanced=id.startsWith('sun_');
                const p=enhanced&&this.pets.find(p=>p.type===type&&!p.enhanced);
                if(p){p.enhanced=true;p.form=1;}else this.pets.push(this.makePet(type,1,enhanced));
            }
            if(item.type===3){const p=this.pets.find(p=>p.type===(item.fruitPetId==='pet_ji'?'ji':'zhu')&&p.form===item.upLvFrom&&!p.enhanced);if(p)p.form++;}
            if(id==='sun_jinwu_evolve'||id==='sun_taotie_evolve'){const type=id==='sun_jinwu_evolve'?'ji':'zhu';const p=this.pets.find(p=>p.type===type&&p.enhanced&&p.form===1);if(p)p.form=2;}
            if(item.effect==='skillMaxRake'||item.effect==='skillMaxStaff'){const k=item.effect==='skillMaxRake'?4:5;this.state.skills[k].charge=Math.min(this.chargeMax(k),this.state.skills[k].charge+1);}
            if(item.effect==='unlockBox'&&this.buyCount(id)===1)this.state.boxes[0]+=10;
            if(item.effect&&item.effect.startsWith('boxTier'))this.emit('tier',{tier:this.boxTier()});
            this.emit('buy',{item,price});
            if(id===this.chapter.exit){this.state.pendingChapter=true;this.emit('chapterEnd',{map:this.state.map});}
            return {ok:true,item};
        }
        makeUnit(kind,x,y){const p=Number.isFinite(x)&&Number.isFinite(y)?Walk.project({x,y},this.state.map):Walk.randomPoint(this.random,this.state.map);return {id:'z'+(++this.serial),kind,x:p.x,y:p.y,fromX:p.x,fromY:p.y,toX:p.x,toY:p.y,busy:0,duration:1,cd:0,trigger:'manual',shock:false,mult:1};}
        makePet(type,form,enhanced,x,y){const p=Number.isFinite(x)&&Number.isFinite(y)?Walk.project({x,y},this.state.map):Walk.randomPoint(this.random,this.state.map);return {id:'p'+(++this.serial),type,form:clamp(form||1,1,enhanced?2:3),enhanced:!!enhanced,x:p.x,y:p.y,wait:0,target:null,stun:0};}
        fitWalkArea(){this.units.forEach(u=>{Object.assign(u,Walk.project(u,this.state.map));u.fromX=u.toX=u.x;u.fromY=u.toY=u.y;u.busy=0;});this.pets.concat(this.ores).forEach(p=>Object.assign(p,Walk.project(p,this.state.map)));}
        syncUnits(){
            const items=this.shop.filter(x=>x.type===0),counts={};
            items.forEach(x=>counts[x.id]=this.buyCount(x.id)+(+this.state.gifts[x.id]||0)+(x.id==='spoon'?1:0));
            items.forEach(x=>{if(x.evolveFrom)counts[x.evolveFrom]=Math.max(0,(counts[x.evolveFrom]||0)-(counts[x.id]||0));});
            const old=this.units,next=[];
            items.forEach(x=>{const existing=old.filter(u=>u.kind===x.kind);for(let i=0;i<(counts[x.id]||0);i++)next.push(existing[i]||this.makeUnit(x.kind));});
            this.units=next;this.emit('units');
        }
        radius(){let r=30+this.effect('hitRange');if(this.state.buffs.circle>0)r=Math.max(r,r>=130?156:130);return r*(this.state.map===0?1:.7);}
        income(kind){const item=this.shop.find(x=>x.type===0&&x.kind===kind);if(!item)return 0;let mult=1;this.shop.forEach(x=>{if(x.type===4&&(x.effect==='goldTool'+kind||x.effect==='skillAwaken'+kind)&&this.buyCount(x.id)>0)mult*=1+(x.add||0);});return Math.floor(((item.dirtAdd||0)+this.effect('dirtIncome'+kind))*mult*(1+this.collect('collectDirtIncome')));}
        moveDuration(){return (this.state.map===1?1.5:1)/(1+this.effect('beltFlipSpeed')+this.collect('collectFlipSpeed'));}
        hitTest(u,p,r){const dx=Math.max(0,Math.abs(u.x-p.x)-34),dy=Math.max(0,Math.abs((u.y-35)-p.y)-44);return dx*dx+dy*dy<=r*r;}
        setCursor(x,y){this.cursor={x:clamp(x,60,1020),y:clamp(y,480,1235)};}
        clearWhip(){this.cursor=null;}
        dig(u,source,mult,shock,contact){
            if(!u||u.busy>0||((source==='manual'||source==='pet')&&u.cd>0))return false;
            Object.assign(u,Walk.project(u,this.state.map));
            if(source==='manual'||source==='pet')u.cd=1;u.busy=u.duration=this.moveDuration();u.fromX=u.x;u.fromY=u.y;u.mult=mult||1;u.shock=!!shock;u.trigger=source||'manual';
            const angle=this.random()*Math.PI*2,range=150+this.random()*100;
            const landing=Walk.destination(u,angle,range,this.state.map);u.toX=landing.x;u.toY=landing.y;
            const value=this.income(u.kind)*(this.state.buffs.double>0?2:1)*u.mult;
            this.state.coins+=value;this.state.hits++;
            const event={id:u.id,kind:u.kind,x:u.x,y:u.y,value,source:u.trigger};if(contact)event.contact=contact;this.emit('dig',event);
            this.rollOre(u);this.rollBox(u);return true;
        }
        land(u){
            if([2,6,10].includes(u.kind)&&this.random()<.35){
                let count;
                if(u.kind===2){const r=this.random()*75;count=r<40?1:r<60?2:r<70?3:4;if(this.effect('goldTool2')>0)count*=2;}
                else count=5+Math.floor(this.random()*4);
                const candidates=this.units.filter(v=>v!==u);
                for(let i=candidates.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1)),tmp=candidates[i];candidates[i]=candidates[j];candidates[j]=tmp;}
                candidates.slice(0,count).forEach((v,i)=>{this.pendingDig.push({target:v,source:'chain',mult:1,shock:true,time:i*.1,fromX:u.x,fromY:u.y,kind:u.kind});});
            }
            if([3,7,11].includes(u.kind)&&!u.shock){const radius=100*(this.state.map===0?1:.6)*(this.effect('goldTool3')>0?2:1);this.emit('shock',{x:u.x,y:u.y,radius});this.units.filter(v=>v!==u&&distance(u,v)<=radius).forEach(v=>this.dig(v,'shock',1,true));}
            if(u.kind===8&&!u.shock){this.emit('laser',{x:u.x,y:u.y});this.units.filter(v=>v!==u&&((Math.abs(v.x-u.x)<=60&&Math.abs(v.y-u.y)<=800)||(Math.abs(v.y-u.y)<=60&&Math.abs(v.x-u.x)<=800))).forEach(v=>this.pendingDig.push({target:v,source:'laser',mult:1,shock:true,time:Math.max(Math.abs(v.x-u.x),Math.abs(v.y-u.y))/2200}));}
        }
        oreChance(kind){let p=.1;this.shop.forEach(x=>{if(x.type===1)p+=(x.oreChanceAdd||0)*this.buyCount(x.id);if(x.type===0&&x.kind===kind)p+=x.oreChanceAdd||0;});return Math.min(1,p*(1+this.effect('meteorSpawnSpeed')));}
        rollOre(u){
            if(!this.buyCount('belt_unlock')||this.oreCd>0||this.ores.length>=30||this.random()>=this.oreChance(u.kind))return;
            this.oreCd=1.2;const max=this.buyCount('pet_zhu')>=3?2:this.buyCount('pet_zhu')>=1?1:0;
            const weights=(u.kind===1?[40,40,20]:[70,25,5]).slice(0,max+1);let r=this.random()*weights.reduce((a,b)=>a+b,0),level=0;
            for(let i=0;i<weights.length;i++){r-=weights[i];if(r<0){level=i;break;}}
            const ore=Object.assign({id:'o'+(++this.serial),level,progress:0,fall:this.state.map===0?0:.5},Walk.project({x:u.x+(this.random()-.5)*60,y:u.y+30},this.state.map));
            this.ores.push(ore);this.emit('oreSpawn',ore);
        }
        pressTime(level){const base=(this.state.map===0?[.3,1,2]:[6,10,15])[level];let factor=Math.max(.1,1-this.effect(this.state.map===1?'moonSmashPower':'smashPower')-this.collect('collectSmash'));if(this.state.buffs.frenzy>0)factor=Math.max(.05,factor*2/3);return base*factor;}
        oreValue(level){let mult=1;this.shop.forEach(x=>{if(x.effect==='oreIncMult'&&this.buyCount(x.id)>0)mult*=1+x.add;});return Math.floor(([1,4,10][level]+this.effect(this.state.map===0?'oreIncome':'meteorIncome'))*mult*(this.state.buffs.double>0?2:1)*(1+this.collect('collectMeteorIncome')));}
        petGear(p){
            if(this.state.map===0||p.enhanced)return {helmet:false,vehicle:false};
            const index=this.pets.filter(x=>x.type===p.type&&!x.enhanced).indexOf(p);
            return {helmet:index>=0&&index<this.buyCount(p.type==='ji'?'moon_helmet_ji':'moon_helmet_zhu'),vehicle:index>=0&&p.form>=3&&index<this.buyCount(p.type==='ji'?'moon_ufo':'moon_excavator')};
        }
        petSpeed(p){const gear=this.petGear(p),base=p.enhanced?150:this.state.map===0?(p.type==='ji'?[200,250,250]:[180,250,250])[p.form-1]:gear.vehicle?125:gear.helmet?100:75;return base*(this.state.map===0?1+this.effect('petSpeed'):1)*(1+this.collect('collectPetSpeedAll')+(p.type==='ji'?this.collect('collectPetSpeedJi'):this.collect('collectPetSpeedZhu')))*(this.state.buffs.frenzy>0?4/3:1);}
        petInterval(p){const gear=this.petGear(p),stage=this.state.map===0?p.form-1:gear.vehicle?2:gear.helmet?1:0;return (p.enhanced?3:(p.type==='ji'?[3,1,1]:[5,3,1])[stage])*(this.state.buffs.frenzy>0?2/3:1);}
        petIsImmune(p){return this.effect('stunImmune')>=1||this.petGear(p).vehicle;}
        tickPets(dt){
            const reserved=new Set();
            this.pets.forEach(p=>{
                p.stun=Math.max(0,p.stun-dt);p.wait=Math.max(0,p.wait-dt);if(p.stun>0||p.wait>0)return;
                const list=p.type==='ji'?this.units.filter(u=>u.busy<=0&&u.cd<=0):this.ores.filter(o=>o.fall<=0&&!reserved.has(o.id));
                let target=list.find(x=>x.id===p.target);if(!target)target=list.slice().sort((a,b)=>distance(p,a)-distance(p,b))[0];
                if(!target){p.target=null;return;}p.target=target.id;if(p.type==='zhu')reserved.add(target.id);
                const d=distance(p,target),step=this.petSpeed(p)*dt;
                if(d>30){p.x+=(target.x-p.x)/d*Math.min(step,d);p.y+=(target.y-p.y)/d*Math.min(step,d);}
                else if(p.type==='ji'){
                    const r=p.form>=3?240*(this.state.map===0?1:.7):0;
                    const targets=[];this.units.filter(u=>u===target||(r>0&&distance(p,u)<r)).forEach(u=>{if(this.dig(u,'pet',1,false))targets.push(u.id);});
                    p.wait=this.petInterval(p);p.target=null;this.emit('petWork',{id:p.id,x:p.x,y:p.y,partnerType:p.type,targetId:target.id,targets});
                }else{
                    const targets=p.form>=3?this.ores.filter(o=>o.fall<=0&&distance(p,o)<=260):[target];
                    targets.forEach(o=>{o.pressing=true;this.processing.push({oreId:o.id,partnerId:p.id});});p.working=true;
                }
            });
        }
        tick(dt){
            dt=clamp(dt,0,.1);this.time+=dt;this.state.activeTime+=dt;this.oreCd=Math.max(0,this.oreCd-dt);
            Object.keys(this.state.buffs).forEach(k=>this.state.buffs[k]=Math.max(0,this.state.buffs[k]-dt));
            this.units.slice().forEach(u=>{u.cd=Math.max(0,u.cd-dt);if(u.busy>0){u.busy=Math.max(0,u.busy-dt);const p=1-u.busy/u.duration;u.x=u.fromX+(u.toX-u.fromX)*p;u.y=u.fromY+(u.toY-u.fromY)*p;if(u.busy===0)this.land(u);}});
            this.pendingDig=this.pendingDig.filter(p=>{p.time-=dt;if(p.time>0)return true;if(this.units.includes(p.target)&&this.dig(p.target,p.source,p.mult,p.shock)&&p.source==='chain')this.emit('link',{x:p.fromX,y:p.fromY,tx:p.target.x,ty:p.target.y,kind:p.kind});return false;});
            this.ores.forEach(o=>{o.pressing=false;if(o.fall>0){o.fall=Math.max(0,o.fall-dt);if(o.fall===0){this.emit('oreLand',o);this.pets.forEach(p=>{if(distance(o,p)<=110&&!this.petIsImmune(p))p.stun=3*Math.max(0,1-this.effect('stunImmune'));});}}});
            this.processing=[];this.pets.forEach(p=>p.working=false);this.tickPets(dt);
            if(this.cursor){
                this.units.forEach(u=>{if(this.hitTest(u,this.cursor,this.radius()))this.dig(u,'manual',1,false,{x:clamp(this.cursor.x,u.x-34,u.x+34),y:clamp(this.cursor.y,u.y-79,u.y+9)});});
                const ore=this.ores.filter(o=>o.fall<=0&&distance(o,this.cursor)<=this.radius()+28).sort((a,b)=>distance(a,this.cursor)-distance(b,this.cursor))[0];if(ore){ore.pressing=true;this.processing.push({oreId:ore.id,partnerId:null});}
            }
            this.ores.slice().forEach(o=>{
                if(o.fall>0)return;
                if(o.pressing)o.progress+=dt/this.pressTime(o.level);else o.progress=0;
                if(o.progress>=1){this.ores.splice(this.ores.indexOf(o),1);const value=this.oreValue(o.level),duration=.5+420/150;this.transports.push({id:o.id,x:o.x,y:o.y,time:duration,value});this.emit('oreBreak',{id:o.id,x:o.x,y:o.y,value,duration,processors:this.processing.filter(p=>p.oreId===o.id&&p.partnerId!==null).map(p=>p.partnerId)});this.pets.filter(p=>p.target===o.id).forEach(p=>{p.target=null;p.wait=this.petInterval(p);});}
            });
            this.transports.slice().forEach(t=>{t.time-=dt;if(t.time<=0){this.state.rare[this.state.map]+=t.value;this.transports.splice(this.transports.indexOf(t),1);this.emit('rare',{value:t.value});}});
            [4,5].forEach(k=>{const s=this.state.skills[k];if(this.buyCount(k===4?'moon_rake':'moon_staff')>0&&s.charge<this.chargeMax(k)){s.time+=dt;if(s.time>=this.chargeCd(k)){s.time-=this.chargeCd(k);s.charge++;this.emit('charge',{kind:k});}}else s.time=0;});
            this.tickSkill(dt);
            if(this.specialBox){this.specialBox.time-=dt;if(this.specialBox.time<=0)this.specialBox=null;}
        }
        chargeMax(k){return 1+this.effect(k===4?'skillMaxRake':'skillMaxStaff')+this.collect('collectSkillChargeMax');}
        chargeCd(k){return Math.max(30,60*(1-this.effect(k===4?'skillCdRake':'skillCdStaff')));}
        useSkill(k){
            if(this.skillActive)return {ok:false,reason:'另一技能正在释放'};
            if(this.buyCount(k===4?'moon_rake':'moon_staff')<=0||this.state.skills[k].charge<1)return {ok:false,reason:'技能正在充能'};
            if(this.random()>=this.collect('collectSkillReplay'))this.state.skills[k].charge--;
            const evolved=this.effect(k===4?'skillEvolveRake':'skillEvolveStaff')>0;
            this.skillActive={kind:k,t:0,round:-1,hits:new Set(),mult:10*(evolved?5:1)*(1+this.collect('collectSkillIncome')),scale:evolved?1.2:1};this.emit('skill',{kind:k});return {ok:true};
        }
        tickSkill(dt){
            const s=this.skillActive;if(!s)return;s.t+=dt;
            if(s.kind===4){const round=Math.min(2,Math.floor(s.t/.3));if(round!==s.round){s.round=round;const radius=120+round*80;this.emit('skillWave',{x:540,y:850,radius:radius*s.scale});this.units.filter(u=>distance(u,{x:540,y:850})<radius).forEach(u=>this.dig(u,'skill',s.mult,true));}if(s.t>=1)this.skillActive=null;}
            else{const p=clamp(s.t/2.6,0,1),a=p*Math.PI*5,r=p*620*s.scale,point={x:540+Math.cos(a)*r,y:850+Math.sin(a)*r};s.x=point.x;s.y=point.y;this.units.filter(u=>!s.hits.has(u.id)&&distance(u,point)<=60).forEach(u=>{if(this.dig(u,'skill',s.mult,true))s.hits.add(u.id);});if(p>=1)this.skillActive=null;}
        }
        boxTier(){return this.effect('boxTier3')>0?3:this.effect('boxTier2')>0?2:this.effect('boxTier1')>0?1:0;}
        rollBox(u){if(this.state.map!==2||!this.buyCount('sun_openbox'))return;if(this.random()>=.005+this.effect('boxDropChance')+this.collect('collectBoxDrop'))return;const special=this.random()<.01&&!this.specialBox;if(special)this.specialBox={x:u.x,y:u.y,time:30};else this.state.boxes[this.boxTier()]++;this.emit('box',{x:u.x,y:u.y,special});}
        openBoxes(){
            let remaining=Math.min(10,this.state.boxes.reduce((a,b)=>a+b,0));if(!remaining)return {ok:false,reason:'还没有尸匣，继续催工吧'};
            const count=remaining,tier=this.boxTier(),cfg=Data.boxLevels[tier],items=[];let total=0;
            while(remaining-->0){const stored=this.state.boxes.map((n,i)=>n>0?i:-1).filter(i=>i>=0);this.state.boxes[stored[Math.floor(this.random()*stored.length)]]--;
                const r=this.random(),quality=r<.7?'white':r<.95?'purple':'gold';
                const missing=Data.collects.filter(c=>!this.state.collects.includes(c.id));
                if(quality==='gold'&&this.random()<cfg.collectWeight/100&&missing.length){const c=missing[Math.floor(this.random()*missing.length)];this.state.collects.push(c.id);items.push({name:c.name,collect:true,quality});}
                else{const ids=cfg[quality],id=ids[Math.floor(this.random()*ids.length)],item=Data.loot.find(x=>x.id===id);const value=Math.floor(item.price*(1+this.effect('boxItemValue')));items.push({name:item.name,quality,value});total+=value;}
            }
            this.state.coins+=total;this.emit('boxOpen',{items,total,count});return {ok:true,items,total,count};
        }
        addOffline(seconds){if(seconds<1800)return 0;const T=Math.min(28800,seconds),A=Math.min(T,Math.max(0,28800-(this.state.offlineSeconds||0))),rounds=10+20*clamp((T-1800)/27000,0,1),sum=this.units.reduce((n,u)=>n+this.income(u.kind),0),reward=Math.floor(sum*rounds*A/T);this.state.offlineReward+=reward;this.state.offlineSeconds+=A;return reward;}
        claimOffline(){const reward=this.state.offlineReward;this.state.coins+=reward;this.state.offlineReward=0;this.state.offlineSeconds=0;return reward;}
        grantBuff(key,seconds){if(!Object.prototype.hasOwnProperty.call(this.state.buffs,key))return false;this.state.buffs[key]+=seconds;this.emit('buff',{key,seconds});return true;}
        advance(){
            this.state.pendingChapter=false;
            if(this.state.map===2){this.state.completed=true;return false;}
            const map=this.state.map;
            Data.shops[map].forEach(x=>this.state.buys[x.id]=Math.max(this.buyCount(x.id),x.maxCount));
            ['ji','zhu'].forEach(type=>{while(this.pets.filter(p=>p.type===type&&!p.enhanced).length<10)this.pets.push(this.makePet(type,3,false));this.pets.filter(p=>!p.enhanced).forEach(p=>p.form=3);});
            this.state.map++;
            if(this.state.map===1&&!this.buyCount('moon_staff'))this.state.coins+=1e7;
            if(this.state.map===2){['moon_staff','moon_rake','moon_craft_sword','moon_craft_hammer'].forEach(id=>this.state.buys[id]=Math.max(10,this.buyCount(id)));if(!this.buyCount('sun_openbox'))this.state.coins+=1e12;}
            this.ores=[];this.transports=[];this.pendingDig=[];this.clearWhip();this.syncUnits();this.fitWalkArea();this.emit('chapter',{map:this.state.map});return true;
        }
        export(){
            this.state.units=this.units.map(u=>({kind:u.kind,x:u.x,y:u.y}));this.state.pets=this.pets.map(p=>({type:p.type,form:p.form,enhanced:p.enhanced,x:p.x,y:p.y}));this.state.ores=this.ores.map(o=>Object.assign({},o));this.state.transports=this.transports.map(t=>Object.assign({},t));this.state.lastSeen=Date.now();
            return JSON.parse(JSON.stringify(this.state));
        }
        emit(type,data){this.events.push(Object.assign({type},data||{}));}
        drain(){const e=this.events;this.events=[];return e;}
        snapshot(){return {map:this.state.map,coins:this.state.coins,rare:this.state.rare.slice(),hits:this.state.hits,units:this.units.length,pets:this.pets.length,ores:this.ores.length,radius:this.radius(),sandbox:this.sandbox,buys:Object.assign({},this.state.buys)};}
        static showcase(map){
            const model=new GameModel();model.sandbox=true;
            while(model.state.map<map)model.advance();
            model.state.buys=Object.assign(model.state.buys,{spoon:7,up_dirt0:4,shovel_a:4,up_dirt1:2,shovel_2:2,shovel_3:1,belt_unlock:1,pet_ji:2,pet_zhu:1,up_range:4});
            model.pets=[model.makePet('ji',2,false,350,700),model.makePet('ji',1,false,760,1020),model.makePet('zhu',2,false,430,1080)];
            if(map===0)model.pets=['ji','zhu'].flatMap((type,row)=>[1,2,3].map((form,i)=>model.makePet(type,form,false,340+i*210,1010+row*100)));
            if(map===0)model.state.coins=3000;
            if(map===1){model.pets=['ji','zhu'].flatMap((type,row)=>[0,1,2].map((stage,i)=>model.makePet(type,3,false,330+i*210,1010+row*100)));Object.assign(model.state.buys,{moon_helmet_ji:2,moon_helmet_zhu:2,moon_ufo:1,moon_excavator:1});}
            if(map===1){Object.assign(model.state.buys,{moon_staff:5,moon_rake:3,moon_craft_sword:2,moon_craft_hammer:2,moon_dirt5:1});model.state.coins=3e10;model.state.skills[4].charge=1;model.state.skills[5].charge=1;}
            if(map===2){Object.assign(model.state.buys,{sun_staff:4,sun_rake:3,sun_craft_sword:4,sun_craft_hammer:3,sun_openbox:1});model.state.coins=8e16;model.state.boxes=[10,0,0,0];model.pets[0].enhanced=true;model.pets[2].enhanced=true;model.state.skills[4].charge=1;model.state.skills[5].charge=1;}
            model.state.rare[map]=3000;
            model.syncUnits();model.units=model.units.filter(u=>map===0||u.kind>=(map===1?4:8)).slice(0,18);
            model.units.forEach((u,i)=>{u.x=320+(i%4)*165;u.y=770+Math.floor(i/4)*88;});
            model.ores=[{id:'showore1',x:440,y:1050,level:1,progress:0,fall:0},{id:'showore2',x:760,y:1115,level:2,progress:0,fall:0}];
            model.fitWalkArea();model.drain();return model;
        }
    }
    function format(n){if(!Number.isFinite(n))return '—';const a=Math.abs(n);if(a>=1e16)return (n/1e16).toFixed(a>=1e18?0:1).replace(/\.0$/,'')+'京';if(a>=1e12)return (n/1e12).toFixed(a>=1e14?0:1).replace(/\.0$/,'')+'万亿';if(a>=1e8)return (n/1e8).toFixed(a>=1e10?0:1).replace(/\.0$/,'')+'亿';if(a>=1e4)return (n/1e4).toFixed(a>=1e6?0:1).replace(/\.0$/,'')+'万';return Math.floor(n).toLocaleString('en-US');}
    return {GameModel,format,CHAPTERS,KIND_NAMES};
});
