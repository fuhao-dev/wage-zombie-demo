(function(root){
    'use strict';
    const Data=root.WZData||require('./Data');
    const Logic=root.WZModel||require('./Model');
    const A=root.WZArt||require('./Art');
    const V=root.WZVisuals||require('./Visuals');
    const Work=root.WZWorkAnimation||require('./WorkAnimation');
    const Motion=root.WZWhipMotion||require('./WhipMotion');
    const PartnerFX=root.WZPartnerFeedback||require('./PartnerFeedback');
    const ChapterMovie=root.WZChapterTransition||require('./ChapterTransition');
    const Scroll=root.WZShopScroll||require('./ShopScroll');
    const P=A.P,fmt=Logic.format;
    const Game=cc.Class({
        name:'WageZombieGame',extends:cc.Component,
        onLoad(){
            this.uiTime=0;this.saveTime=0;this.clock=0;this.tab=0;this.shopOffsets=[0,0];this.buttons=[];this.modalButtons=[];this.effects=[];this.floaters=[];this.unitNodes={};this.petNodes={};this.oreNodes={};this.pending=null;this.pointerDown=false;this.modalLayer=null;this.normalSnapshot=null;this.soundEnabled=true;this.lastSound=0;this.reactions={};this.whipPulse=0;this.walletPulse=0;this.whipDrag={x:0,y:0};
            this.shopScroll=new Scroll.ShopScroll();this.shopGesture=false;
            this.chapterView=null;this.chapterAdvancing=false;this.artLoading=false;this.artRequest=0;
            this.whipMotion=new Motion.WhipMotion();this.hitReactions={};this.nextWhoosh=0;
            let saved=null;try{saved=JSON.parse(cc.sys.localStorage.getItem(Data.saveKey)||'null');}catch(e){console.warn('存档读取失败，建立新档',e);}
            try{this.model=new Logic.GameModel(saved);}catch(e){console.warn('存档格式不可用，建立新档',e);this.model=new Logic.GameModel();}
            this.soundEnabled=this.model.state.settings.sound!==false;
            this.build();this.attachInput();
            if(!V.ready)this.loadChapterArt(this.model.state.map,()=>{if(this.model.state.pendingChapter&&!this.modalLayer&&!this.chapterView)this.showResult();});
            this.hideHandler=()=>{this.cancelShopGesture();this.releaseWhip();this.hiddenAt=Date.now();this.save();};
            this.showHandler=()=>{if(this.hiddenAt&&!this.model.sandbox){this.model.addOffline(Math.max(0,(Date.now()-this.hiddenAt)/1000));this.hiddenAt=0;if(this.model.state.offlineReward>0)this.showOffline();}};
            cc.game.on(cc.game.EVENT_HIDE,this.hideHandler);cc.game.on(cc.game.EVENT_SHOW,this.showHandler);
            if(typeof window!=='undefined'){this.unloadHandler=()=>this.save();window.addEventListener('beforeunload',this.unloadHandler);window.__WZ_DEMO__={game:this,get model(){return this.game.model;},snapshot:()=>this.model.snapshot(),showcase:map=>this.enterShowcase(map),returnToGame:()=>this.returnToGame()};}
            if(this.model.state.pendingChapter)this.showResult();else if(this.model.state.offlineReward>0)this.showOffline();
        },
        onDestroy(){this.cancelChapterAnimation();this.save();cc.game.off(cc.game.EVENT_HIDE,this.hideHandler);cc.game.off(cc.game.EVENT_SHOW,this.showHandler);if(typeof window!=='undefined')window.removeEventListener('beforeunload',this.unloadHandler);if(this.audio)this.audio.close();},
        graphics(name,parent){const n=new cc.Node(name);(parent||this.rootNode).addChild(n);const g=n.addComponent(cc.Graphics);g.lineJoin=cc.Graphics.LineJoin.ROUND;g.lineCap=cc.Graphics.LineCap.ROUND;return g;},
        label(text,x,y,size,color,width,parent,align){
            const n=new cc.Node('Text '+text.slice(0,14));(parent||this.rootNode).addChild(n);n.setPosition(x,-y);n.setContentSize(width||700,size*1.5);n.anchorX=align==='center'?.5:align==='right'?1:0;n.anchorY=.5;
            const l=n.addComponent(cc.Label);l.string=text;l.fontFamily='Microsoft YaHei';l.fontSize=size;l.lineHeight=Math.ceil(size*1.36);l.horizontalAlign=align==='center'?cc.Label.HorizontalAlign.CENTER:align==='right'?cc.Label.HorizontalAlign.RIGHT:cc.Label.HorizontalAlign.LEFT;l.verticalAlign=cc.Label.VerticalAlign.CENTER;l.overflow=cc.Label.Overflow.SHRINK;l.enableWrapText=false;n.setContentSize(width||700,size*1.5);n.color=A.color(color||P.text);return l;
        },
        button(x,y,w,h,fn,options){const b=Object.assign({x,y,w,h,fn},options||{});this.buttons.push(b);return b;},
        build(){
            this.cancelShopGesture();
            if(this.rootNode)this.rootNode.destroy();
            this.rootNode=new cc.Node('Runtime UI');this.node.addChild(this.rootNode);this.rootNode.setPosition(-540,960);
            this.buttons=[];this.effects=[];this.floaters=[];this.unitNodes={};this.petNodes={};this.oreNodes={};this.cards=[];this.modalLayer=null;this.modalButtons=[];this.boxLabel=null;this.reactions={};this.whipPulse=0;this.walletPulse=0;
            this.hitReactions={};this.partnerFeedback=new PartnerFX.Feedback();this.nextPartnerSound=0;this.whipMotion.reset();this.whipHeld=false;this.pointerDown=false;this.circlePoint=this.circlePoint||{x:540,y:850};this.model.clearWhip();this.stepWhip(0);
            const map=this.model.state.map,t=A.themes[map],bg=this.graphics('World');A.background(bg,map);
            this.worldArt=V.world(this.rootNode,map);
            const ui=this.graphics('Interface frame');
            // Original insignia, title and quiet top controls.
            A.rect(ui,44,66,72,72,21,t.accent,P.ink,4);A.icon(ui,'whip',80,101,20,P.ink);
            this.label('挖个僵尸',136,89,53,P.text,560);
            this.label('触摸移动鞭圈 · 发光边界就是判定范围',140,149,21,P.muted,660);
            A.rect(ui,832,70,78,70,20,P.panel,P.edge,2);A.icon(ui,'sound',872,105,17,this.soundEnabled?t.accent:P.muted);
            this.label('音效',872,160,17,P.muted,85,null,'center');
            this.soundButton=this.button(832,70,78,110,()=>{this.soundEnabled=!this.soundEnabled;this.model.state.settings.sound=this.soundEnabled;this.save();this.rebuildKeepState();});
            A.rect(ui,930,70,100,70,20,P.panel,P.edge,2);A.icon(ui,'flask',980,105,17,t.accent);
            this.label('展示',980,160,17,P.muted,100,null,'center');this.button(930,70,100,110,()=>this.showDemoMenu());
            // Chapter selector is an information sheet, never a free normal-mode skip.
            for(let i=0;i<3;i++){
                const x=44+i*334,active=i===map;
                A.rect(ui,x,214,320,62,18,active?t.accent:P.panel,active?t.accent:P.edge,2);
                this.label('0'+(i+1)+'  '+Logic.CHAPTERS[i].name,x+160,246,27,active?P.ink:P.muted,300,null,'center');
                this.button(x,214,320,62,()=>this.showChapterInfo(i));
            }
            A.rect(ui,44,299,992,110,25,P.panel,P.edge,2);
            A.coin(ui,91,353,26);this.label('尸币',134,329,21,P.muted,250);this.coinLabel=this.label('0',134,369,43,P.gold,470);
            A.line(ui,[[610,326],[610,385]],P.edge,2);A.gem(ui,662,352,26,t.accent);this.label(this.model.chapter.rare,707,329,21,P.muted,280);this.rareLabel=this.label('0',707,369,37,t.accent,280);
            const chapterTag=this.label('0'+(map+1)+' / '+this.model.chapter.name,102,473,25,t.accent,290);chapterTag.node.zIndex=10;
            const clip=new cc.Node('Playfield clip');this.rootNode.addChild(clip);clip.setPosition(540,-829);clip.setContentSize(988,778);clip.addComponent(cc.Mask).type=cc.Mask.Type.RECT;
            const playScene=new cc.Node('Playfield content');clip.addChild(playScene);playScene.setPosition(-540,829);
            this.unitsLayer=new cc.Node('Zombies');playScene.addChild(this.unitsLayer);
            this.petLayer=new cc.Node('Partners');playScene.addChild(this.petLayer);
            this.oreLayer=this.unitsLayer;
            this.fallingLayer=new cc.Node('Falling materials');playScene.addChild(this.fallingLayer);
            this.oreHintLayer=new cc.Node('Material progress hints');playScene.addChild(this.oreHintLayer);
            this.fx=this.graphics('Green effects',playScene);
            this.partnerFx=this.graphics('Partner target feedback',playScene);
            this.whip=this.graphics('Whip cursor',playScene);
            this.walletFx=this.graphics('Cosmetic reward flight');
            this.floatingLayer=new cc.Node('Income');this.rootNode.addChild(this.floatingLayer);
            this.hint=this.label('',540,1146,26,P.text,810,null,'center');
            this.subHint=this.label('',540,1182,21,P.muted,840,null,'center');
            this.fieldStatus=this.label('',100,1241,20,P.muted,800);
            // Original skill and long-press entry, placed above the conveyor.
            this.skillLabels={};
            if(map>0){for(const [k,x] of [[5,276],[4,582]]){A.rect(ui,x,1151,264,65,17,P.panel,P.edge,2);this.skillLabels[k]=this.label('',x+132,1183,23,t.accent,250,null,'center');this.button(x,1151,264,65,()=>{const r=this.model.useSkill(k);if(!r.ok)this.toast(r.reason);});}}
            A.rect(ui,61,676,91,126,24,P.panel,P.edge,2);A.icon(ui,'whip',106,716,19,t.accent);this.label('暴走',106,755,21,t.accent,90,null,'center');this.label('长按',106,784,17,P.muted,90,null,'center');
            this.button(61,676,91,126,()=>this.toast('按住1.5秒，伙伴暴走30秒'),{hold:true});
            if(map===2){
                A.rect(ui,922,548,92,114,23,P.panel,P.edge,2);A.icon(ui,'box',968,580,22,t.accent);this.boxLabel=this.label('尸匣',968,624,20,t.accent,85,null,'center');this.button(922,548,92,114,()=>this.openBoxes());
                A.rect(ui,922,681,92,95,23,P.panel,P.edge,2);A.gem(ui,968,709,18,P.gold);this.label('遗物',968,747,20,P.gold,85,null,'center');this.button(922,681,92,95,()=>this.showCollections());
            }
            // Shop base and tabs.
            A.rect(ui,26,1290,1028,610,36,P.panel,P.edge,3);
            V.chrome(ui,map);
            this.label(['墓园招工棚','尸厂改造站','冥界契约所'][map],62,1338,30,P.text,420);
            this.label('上下滑动 · 长按查看详情',1016,1339,20,P.muted,460,null,'right');
            this.shopLayer=new cc.Node('Shop');this.rootNode.addChild(this.shopLayer);
            this.drawShop();
            this.modeLabel=this.label('',540,1910,18,P.muted,990,null,'center');
            this.toastLayer=new cc.Node('Toast');this.rootNode.addChild(this.toastLayer);this.toastLayer.zIndex=100;
            this.refreshHUD();this.updateVisuals(0);this.handleEvents();
        },
        rebuildKeepState(){this.closeModal();this.build();},
        attachInput(){
            const n=new cc.Node('Input surface');this.node.addChild(n);n.setContentSize(1080,1920);n.zIndex=999;
            const point=e=>{const p=this.rootNode.convertToNodeSpaceAR(e.getLocation());return {x:p.x,y:-p.y};};
            n.on(cc.Node.EventType.TOUCH_START,e=>this.touchStart(point(e)));
            n.on(cc.Node.EventType.TOUCH_MOVE,e=>this.touchMove(point(e)));
            n.on(cc.Node.EventType.TOUCH_END,()=>this.touchEnd());
            n.on(cc.Node.EventType.TOUCH_CANCEL,()=>{this.pending=null;this.cancelShopGesture();this.releaseWhip();});
            n.on(cc.Node.EventType.MOUSE_WHEEL,e=>{const p=point(e);if(!this.modalLayer&&!this.artLoading&&!this.chapterView&&this.inShopViewport(p)){this.pending=null;this.shopGesture=false;this.shopScroll.wheel(-e.getScrollY());this.positionShop();}});
            this.input=n;
        },
        inside(b,p){if(b.item&&b.shop&&!this.inShopViewport(p))return false;return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;},
        touchStart(p){
            if(this.artLoading||(this.chapterView&&this.chapterView.phase!=='result'))return;
            this.unlockAudio();
            if(!this.modalLayer&&this.model.specialBox&&Math.hypot(p.x-this.model.specialBox.x,p.y-(this.model.specialBox.y-40))<50){this.toast('封印尸匣需要激励视频，Demo暂未接入');return;}
            const settling=!this.modalLayer&&this.inShopViewport(p)?(this.shopGesture=true,this.shopScroll.begin(p,this.clock)):false;
            const list=this.modalLayer?this.modalButtons:this.buttons;
            const b=list.slice().reverse().find(b=>this.inside(b,p));
            if(settling){this.pending=null;return;}
            if(b){this.pending={button:b,time:0,x:p.x,y:p.y};return;}
            if(!this.modalLayer&&p.x>=44&&p.x<=1036&&p.y>=480&&p.y<1218){
                this.pointerDown=true;this.whipHeld=true;this.moveCircle(p);this.stepWhip(0);
            }
        },
        touchMove(p){
            if(this.shopGesture){if(this.shopScroll.move(p,this.clock))this.pending=null;this.positionShop();return;}
            if(this.pending&&Math.hypot(p.x-this.pending.x,p.y-this.pending.y)>30)this.pending=null;
            if(this.whipHeld&&!this.modalLayer){this.moveCircle(p);this.stepWhip(0);}
        },
        moveCircle(p){this.circlePoint={x:clamp(p.x,60,1020),y:clamp(p.y,480,1215)};},
        releaseWhip(){this.pointerDown=false;this.whipHeld=false;if(this.model)this.model.clearWhip();if(this.circlePoint)this.stepWhip(0);},
        stepWhip(dt){
            const held=this.whipHeld&&!this.modalLayer&&!this.hiddenAt&&!this.chapterView&&!this.artLoading;
            this.whipFrame=this.whipMotion.update(this.circlePoint.x,this.circlePoint.y,dt,held,this.model.radius());
            if(held)this.model.setCursor(this.circlePoint.x,this.circlePoint.y);else this.model.clearWhip();
        },
        touchEnd(){const dragged=this.shopGesture&&this.shopScroll.end(this.clock);this.shopGesture=false;const p=this.pending;this.pending=null;this.releaseWhip();if(p&&!dragged){p.button.fn();this.sound('click');this.refreshHUD();this.refreshCards();this.handleEvents();this.save();}},
        cancelShopGesture(){this.shopGesture=false;if(this.shopScroll)this.shopScroll.stop();this.pending=null;},
        inShopViewport(p){const r=this.shopViewport;return !!r&&p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;},
        shopItems(){return this.model.shop.filter(x=>x.sec===this.tab&&x.effect!=='urgeUpdate');},
        drawShop(){
            this.cancelShopGesture();this.shopLayer.removeAllChildren();this.buttons=this.buttons.filter(b=>!b.shop);this.cards=[];
            const g=this.graphics('Shop chrome',this.shopLayer),t=A.themes[this.model.state.map];
            for(let i=0;i<2;i++){const x=60+i*494;A.rect(g,x,1370,470,61,16,this.tab===i?t.accent:P.bg,this.tab===i?t.accent:P.edge,2);this.label(i===0?'招募与经营':'赋能与改造',x+235,1400,25,this.tab===i?P.ink:P.muted,450,this.shopLayer,'center');this.button(x,1370,470,61,()=>{this.shopOffsets[this.tab]=this.shopScroll.offset;this.tab=i;this.drawShop();},{shop:true});}
            this.shopViewport={x:60,y:1450,w:964,h:430};const r=this.shopViewport,items=this.shopItems(),height=Math.max(0,Math.ceil(items.length/2)*125-13);
            this.shopScroll.configure(height,r.h,this.shopOffsets[this.tab]||0);
            const clip=new cc.Node('Shop scroll viewport');this.shopLayer.addChild(clip);clip.setPosition(r.x+r.w/2,-r.y-r.h/2);clip.setContentSize(r.w,r.h);clip.addComponent(cc.Mask).type=cc.Mask.Type.RECT;
            this.shopContent=new cc.Node('Shop scrolling cards');clip.addChild(this.shopContent);
            items.forEach((item,i)=>{
                const x=(i%2)*494,y=Math.floor(i/2)*125,w=470,h=112;
                const card=new cc.Node('Card '+item.id);this.shopContent.addChild(card);card.setPosition(x,-y);
                const cg=this.graphics('Card shape',card),ig=this.graphics('Card icon',card);ig.node.setPosition(60,-82);
                if(item.type===0){if(!V.worker(ig,item.kind,this.model.state.map,false,false,0,true)){A.zombie(ig,item.kind,this.model.state.map,false,false);ig.node.scale=.48;}}
                else if(item.type===2||item.type===3){const p={type:item.id.includes('zhu')||item.id.includes('taotie')?'zhu':'ji',form:item.type===3?(item.upLvFrom||1)+1:1,enhanced:item.id.startsWith('sun_')};V.partner(ig,p,true);}
                else A.icon(ig,item.effect==='hitRange'?'whip':item.id.includes('box')?'box':item.id.includes('escape')?'arrow':item.costType===1?'gem':'flask',0,-35,25,item.costType===0?P.gold:t.accent);
                const title=this.label(item.name,114,28,26,P.text,330,card),desc=this.label('',114,61,19,P.muted,330,card),price=this.label('',114,91,25,P.gold,310,card);
                const button=this.button(r.x+x,r.y+y,w,h,()=>{if(this.model.canBuy(item).full){this.toast('达到上线');return;}const result=this.model.buy(item.id);if(!result.ok)this.toast(result.reason);else this.sound('buy');this.refreshCards();},{shop:true,item});
                this.cards.push({item,node:card,icon:ig.node,g:cg,title,desc,price,x,y,w,h,button});
            });
            this.shopScrollBar=this.graphics('Shop scroll position',this.shopLayer);this.positionShop();this.refreshCards();
        },
        positionShop(){
            if(!this.shopContent)return;const r=this.shopViewport,s=this.shopScroll;this.shopOffsets[this.tab]=s.offset;this.shopContent.setPosition(-r.w/2,r.h/2+s.offset);
            this.cards.forEach(c=>{c.button.y=r.y+c.y-s.offset;c.node.active=c.y+c.h>s.offset&&c.y<s.offset+r.h;});
            const g=this.shopScrollBar;g.clear();if(s.max>0){const h=Math.max(32,r.h*r.h/(r.h+s.max)),top=r.y+(r.h-h)*s.offset/s.max;A.rect(g,1035,r.y,5,r.h,2,P.edge);A.rect(g,1035,top,5,h,2,A.themes[this.model.state.map].accent);}
        },
        refreshCards(){
            const t=A.themes[this.model.state.map];
            this.cards.forEach(c=>{
                const check=this.model.canBuy(c.item),n=this.model.buyCount(c.item.id),max=this.model.maxCount(c.item),g=c.g;g.clear();
                A.rect(g,0,0,c.w,c.h,18,check.full?'#1c272b':check.ok?'#2b4139':P.bg,check.full?'#354144':check.ok?t.accent:P.edge,check.ok?3:2);
                c.title.node.color=A.color(check.full?'#72817d':check.locked?P.muted:P.text);c.icon.color=A.color(check.full?'#89908b':'#ffffff');c.icon.opacity=check.full?105:255;
                c.desc.string=check.locked?check.reason:(c.item.type===0?'拥有 '+n+' / '+max+' · 单次 '+fmt(this.model.income(c.item.kind)):'等级 '+n+' / '+max);c.desc.node.color=A.color(check.full?'#687773':P.muted);
                c.price.string=check.full?'达到上线':fmt(this.model.cost(c.item))+' '+(c.item.costType===0?'尸币':this.model.chapter.rare);
                c.price.node.color=A.color(check.full?'#83918b':check.ok?t.accent:check.locked?P.muted:P.gold);
                if(check.ok)A.circle(g,c.w-19,20,4,t.accent);
            });
        },
        refreshHUD(){
            const m=this.model,s=m.state;this.coinLabel.string=fmt(s.coins);this.rareLabel.string=fmt(s.rare[s.map]);
            this.modeLabel.string=m.sandbox?'章节展示模式 · 资源与进度不写入正式存档':'DEMO 0.9.1  /  原值成长 · 本地自动保存';
            this.modeLabel.node.color=A.color(m.sandbox?P.gold:P.muted);
            this.fieldStatus.string='尸工 '+m.units.length+'   ·   鞭圈半径 '+Math.round(m.radius()*10)/10+'   ·   已开工 '+fmt(s.hits)+' 次';
            const intro=s.hits<4&&!m.sandbox;
            this.hint.string=intro?'触摸场地，移动鞭圈催工':'';
            this.subHint.string=intro?'圈内持续催工 · 升级扩大范围':!m.sandbox&&m.ores.length>0?'让发光鞭圈覆盖结块，按住持续碎炼':'';
            if(s.map>0){this.hint.string='';this.subHint.string='';[4,5].forEach(k=>{const st=s.skills[k],name=k===4?'切割狂潮':'钻机暴走',owned=m.buyCount(k===4?'moon_rake':'moon_staff')>0;this.skillLabels[k].string=owned?name+' '+(st.charge>0?'×'+st.charge:Math.ceil(m.chargeCd(k)-st.time)+'s'):name+' · 未解锁';});}
            if(this.boxLabel)this.boxLabel.string='尸匣 '+s.boxes.reduce((a,b)=>a+b,0);
        },
        handleEvents(){
            let partnerSound=false;
            this.model.drain().forEach(e=>{
                this.partnerFeedback.accept(e,this.clock);
                if(e.type==='petWork'&&e.targets&&e.targets.length)partnerSound=true;
                if(e.type==='dig'){
                    this.reactions[e.id]=this.clock;
                    this.addEffect({type:'impact',x:e.x,y:e.y-69,t:0,life:.24});
                    for(let i=0;i<3;i++){const a=Math.random()*6.28;this.addEffect({type:'slime',x:e.x,y:e.y-61,vx:Math.cos(a)*(40+Math.random()*70),vy:-40-Math.random()*80,t:0,life:.35+Math.random()*.2});}
                    if(this.effects.filter(f=>f.type==='coinFly').length<12)this.addEffect({type:'coinFly',x:e.x,y:e.y-89,t:0,life:.6,phase:Math.random()*.5});
                    this.float('+'+fmt(e.value),e.x,e.y-133,e.source==='skill'?P.gold:P.green,e.source==='manual'?30:24);
                    if(e.source==='manual'){
                        const speed=this.whipMotion.speed,power=.72+Math.min(1,speed/1100)*.28,vx=this.whipMotion.vx,vy=this.whipMotion.vy,len=Math.max(1,Math.hypot(vx,vy));
                        const direction=len>20?{x:vx/len,y:vy/len}:{x:.7,y:-.7};
                        this.hitReactions[e.id]={time:this.clock,power,dx:direction.x,dy:direction.y};
                        const contact=e.contact||{x:e.x,y:e.y-65};
                        this.addEffect({type:'whipSlash',x:contact.x,y:contact.y,dx:direction.x,dy:direction.y,power,t:0,life:.18});
                        this.whipMotion.strike();this.whipPulse=1;this.sound('whip');
                    }
                }else if(e.type==='link')this.addEffect(Object.assign({t:0,life:.28},e));
                else if(e.type==='shock'||e.type==='skillWave')this.addEffect(Object.assign({t:0,life:e.type==='skillWave'?.5:.4},e));
                else if(e.type==='laser')this.addEffect(Object.assign({t:0,life:.4},e));
                else if(e.type==='oreBreak'){this.float('碎炼完成',e.x,e.y-45,P.cyan,23);this.addEffect({type:'transport',x:e.x,y:e.y,t:0,life:e.duration});this.sound('ore');}
                else if(e.type==='rare')this.float('+'+fmt(e.value),755,370,A.themes[this.model.state.map].accent,26);
                else if(e.type==='buy'){
                    this.float('招募 / 强化成功',540,530,P.gold,28);this.save();
                    if(e.item.type===0&&(e.item.kind===4||e.item.kind===5)&&this.model.buyCount(e.item.id)===1)this.toast('新技能已就绪，点击场地下方释放');
                }else if(e.type==='chapterEnd')this.showResult();
                else if(e.type==='box')this.float(e.special?'封印尸匣':'尸匣 +1',e.x,e.y-70,P.gold,26);
                else if(e.type==='skill')this.sound('skill');
                else if(e.type==='charge')this.toast((e.kind===4?'切割狂潮':'钻机暴走')+'已充能');
            });
            if(partnerSound&&this.clock>=this.nextPartnerSound){this.nextPartnerSound=this.clock+.5;this.sound('stamp');}
        },
        addEffect(e){if(this.effects.length>140)this.effects.shift();this.effects.push(e);},
        float(text,x,y,color,size){
            if(this.floaters.length>=30){const old=this.floaters.shift();if(old.node.isValid)old.node.destroy();}
            const l=this.label(text,x,y,size,color,380,this.floatingLayer,'center');this.floaters.push({node:l.node,x,y,t:0,life:.85});
        },
        updateVisuals(dt){
            const m=this.model,map=m.state.map,t=A.themes[map],seen=new Set(),depth=[];
            const feedback=this.partnerFeedback.sample(m,this.clock),ghosts=new Map(feedback.ghosts.map(a=>[a.id,a]));this.partnerView=feedback;
            m.units.forEach(u=>{
                seen.add(u.id);let record=this.unitNodes[u.id];
                const work=Work.sample(u,this.clock),pose=work.pose;
                const golden=m.effect('goldTool'+u.kind)>0,awake=m.effect('skillAwaken'+u.kind)>0,key=[u.kind,golden,awake,pose,V.revision].join(':');
                if(!record){const g=this.graphics(u.id,this.unitsLayer);record=this.unitNodes[u.id]={g,key:null};}
                if(record.key!==key){record.g.clear();if(!V.worker(record.g,u.kind,map,golden,awake,pose,false))A.zombie(record.g,u.kind,map,golden,awake);record.key=key;record.pose=pose;}
                if(work.phase==='idle'&&record.phase&&record.phase!=='idle')record.finishedAt=this.clock;
                record.phase=work.phase;
                const reaction=this.hitReactions[u.id],age=reaction?this.clock-reaction.time:10,hit=age>=0&&age<.14?Math.exp(-age*27)*reaction.power:0;
                const rest=record.finishedAt===undefined?0:Math.max(0,1-(this.clock-record.finishedAt)/1.4);
                const cutout=u.kind<=7,rigWork=cutout&&age<.035?Object.assign({},work,{progress:.055}):work;
                const contact=V.animate(record.g,u.kind,map,golden,rigWork,this.clock,rest,hit);
                if(work.strike>=0&&record.strike!==work.strike){
                    const x=work.x+(contact?contact.x:24),y=work.y-(contact?contact.y:2);
                    const chips=u.kind===0?2:5;for(let i=0;i<chips;i++)this.addEffect({type:'digChip',x,y,vx:u.kind===0?-15-i*18:(i-2)*39,vy:u.kind===0?-12-i*6:-45-i*12,t:0,life:.28+Math.random()*.08});
                    if(cutout&&u.kind!==0)this.addEffect({type:'digDust',x,y,t:0,life:u.kind===3?.3:.22});
                }
                record.strike=work.strike;
                const recoil=cutout?0:hit*3.5;
                record.g.node.setPosition(work.x+(reaction?reaction.dx:0)*recoil,-work.y+work.lift-(reaction?reaction.dy:0)*recoil);record.g.node.angle=work.angle;record.g.node.scaleY=work.scaleY-(cutout?0:hit*.025);record.g.node.scaleX=1+(cutout?0:hit*.025);depth.push({node:record.g.node,y:work.y,id:'worker:'+u.id});
            });
            Object.keys(this.unitNodes).forEach(id=>{if(!seen.has(id)){this.unitNodes[id].g.node.destroy();delete this.unitNodes[id];}});
            const ps=new Set();m.pets.forEach(p=>{ps.add(p.id);let r=this.petNodes[p.id];const viewPet=Object.assign({},p,{gear:m.petGear(p)}),key=[p.type,p.form,p.enhanced,viewPet.gear.helmet,viewPet.gear.vehicle,V.revision].join(':');if(!r)r=this.petNodes[p.id]={g:this.graphics(p.id,this.unitsLayer),x:p.x,y:p.y,wait:p.wait};if(r.key!==key){if(r.key)r.upgradedAt=this.clock;V.partner(r.g,viewPet,false);r.key=key;}
                const moving=Math.hypot(p.x-r.x,p.y-r.y)>.01,action=ghosts.get(p.id),focus=p.type==='ji'?m.units.find(u=>u.id===(action?action.primary:p.target)):m.ores.find(o=>o.id===p.target);
                V.animatePartner(r.g,viewPet,this.clock,action?action.action:0,moving,Math.max(0,1-(this.clock-(r.upgradedAt===undefined?-10:r.upgradedAt))),focus);r.x=p.x;r.y=p.y;r.wait=p.wait;r.g.node.setPosition(p.x,-p.y);depth.push({node:r.g.node,y:p.y,id:'partner:'+p.id});});
            Object.keys(this.petNodes).forEach(id=>{if(!ps.has(id)){this.petNodes[id].g.node.destroy();delete this.petNodes[id];}});
            const os=new Set();m.ores.forEach(o=>{os.add(o.id);let r=this.oreNodes[o.id];if(!r){const g=this.graphics(o.id,this.oreLayer);A.ore(g,o.level,map);r=this.oreNodes[o.id]={g,progress:this.graphics(o.id+' progress',this.oreHintLayer)};}const parent=o.fall>0?this.fallingLayer:this.oreLayer;if(r.g.node.parent!==parent)r.g.node.parent=parent;r.g.node.setPosition(o.x,-o.y+o.fall*700);r.g.node.angle=o.pressing?Math.sin(this.clock*25)*7:0;if(o.fall<=0)depth.push({node:r.g.node,y:o.y,id:'ore:'+o.id});r.progress.clear();if(o.progress>0){A.rect(r.progress,o.x-31,o.y+14,62,9,4,P.ink);A.rect(r.progress,o.x-29,o.y+16,Math.max(3,58*o.progress),5,2,t.accent);}});
            Object.keys(this.oreNodes).forEach(id=>{if(!os.has(id)){this.oreNodes[id].g.node.destroy();this.oreNodes[id].progress.node.destroy();delete this.oreNodes[id];}});
            this.groundDepth=PartnerFX.depthOrder(depth);this.groundDepth.forEach((r,i)=>r.node.zIndex=i);
            const point=(node,x,y)=>{const q=this.rootNode.convertToNodeSpaceAR(node.convertToWorldSpaceAR(cc.v2(x||0,y||0)));return{x:q.x,y:-q.y};};
            PartnerFX.draw(this.partnerFx,A,feedback,{
                pet:(id,kind)=>{const r=this.petNodes[id];if(!r)return null;const b=r.g._buddy;if(!b)return point(r.g.node,0,70);if(kind==='whip')return point(b.pieces.Whip.node,0,0);if(kind==='mouth')return point(b.pieces.Mineral.node,0,0);return point(b.pieces.Attendance.node,0,0);},
                unit:id=>{const r=this.unitNodes[id];return r?point(r.g.node,41,124):null;},
                ore:id=>{const r=this.oreNodes[id];return r?point(r.g.node,0,0):null;}
            },this.clock);
            this.whipPulse=Math.max(0,this.whipPulse-dt*6);this.whipDrag.x*=Math.exp(-dt*12);this.whipDrag.y*=Math.exp(-dt*12);
            this.whip.clear();if(this.whipFrame){
                A.whip(this.whip,this.circlePoint.x,this.circlePoint.y,map,this.clock,m.radius(),{pulse:Math.max(this.whipPulse,this.whipFrame.pulse),active:this.whipHeld,motion:this.whipFrame});
            }
            const g=this.fx;g.clear();const wallet=this.walletFx;wallet.clear();this.walletPulse=Math.max(0,this.walletPulse-dt*6);
            this.effects=this.effects.filter(e=>{e.t+=dt;const p=e.t/e.life;if(p>=1){if(e.type==='coinFly')this.walletPulse=1;return false;}
                if(e.type==='whipSlash'){
                    const q=1-p,size=22+e.power*8,nx=-e.dy,ny=e.dx;
                    A.line(g,[[e.x-e.dx*size*q-nx*5,e.y-e.dy*size*q-ny*5],[e.x,e.y],[e.x+e.dx*size*q+nx*5,e.y+e.dy*size*q+ny*5]],map===1?P.cyan:P.fluid,5*q+1);
                    A.line(g,[[e.x-e.dx*size*.6*q,e.y-e.dy*size*.6*q],[e.x+e.dx*size*.7*q,e.y+e.dy*size*.7*q]],P.white,2*q+1);
                    for(let i=0;i<5;i++){const angle=i*1.256+.3,r=8+p*31;A.line(g,[[e.x+Math.cos(angle)*r,e.y+Math.sin(angle)*r],[e.x+Math.cos(angle)*(r+8*q),e.y+Math.sin(angle)*(r+8*q)]],i%2?P.fluid:P.white,2*q+.5);}
                }
                else if(e.type==='digDust'){A.ellipse(g,e.x,e.y+1,9+p*19,2+p*3,map===0?'#899578':map===1?'#8ba6a4':P.fluid);A.ellipse(g,e.x,e.y+1,7+p*15,1+p*2,A.themes[map].ground);}
                else if(e.type==='digChip'){
                    const x=e.x+e.vx*e.t,y=e.y+e.vy*e.t+180*e.t*e.t,size=3*(1-p)+1;
                    A.poly(g,[[x-size,y],[x,y-size],[x+size,y+1],[x,y+size]],map===0?'#899578':map===1?'#8ba6a4':P.fluid);
                }
                else if(e.type==='slime'){A.ellipse(g,e.x+e.vx*e.t,e.y+e.vy*e.t+130*e.t*e.t,3.4*(1-p)+1,2.4*(1-p)+1,P.fluid);}
                else if(e.type==='impact'){
                    const size=(1-p)*24+8,points=[];for(let i=0;i<12;i++){const a=i*Math.PI/6,r=i%2?size*.28:size;points.push([e.x+Math.cos(a)*r,e.y+Math.sin(a)*r]);}A.poly(g,points,map===1?P.cyan:P.green);A.line(g,[[e.x-size*.6,e.y-size*.5],[e.x+size*.5,e.y+size*.3]],P.white,3*(1-p)+1);
                    if(map===1)A.line(g,[[e.x-35,e.y-21],[e.x-19,e.y-7],[e.x-25,e.y+5],[e.x-9,e.y+14]],P.cyan,2);
                    if(map===2){for(let i=0;i<3;i++)A.poly(g,[[e.x-18+i*15,e.y+8],[e.x-22+i*15,e.y-17-p*15],[e.x-5+i*15,e.y]],P.fluid);}
                }
                else if(e.type==='coinFly'){
                    const q=1-Math.pow(1-p,2),x=e.x+(91-e.x)*q+Math.sin(p*Math.PI)*35,y=e.y+(353-e.y)*q-Math.sin(p*Math.PI)*70;
                    A.coin(wallet,x,y,9+Math.sin(p*Math.PI)*2);if(p>.9)this.walletPulse=1;
                }
                else if(e.type==='link'){A.line(g,[[e.x,e.y-70],[e.tx,e.ty-60]],map===0?P.green:map===1?P.cyan:P.fluid,3*(1-p)+1);A.circle(g,e.x+(e.tx-e.x)*p,e.y-70+(e.ty-e.y+10)*p,5,t.accent);}
                else if(e.type==='shock'||e.type==='skillWave'){A.ring(g,e.x,e.y,e.radius*p,t.accent,4*(1-p)+1);A.ring(g,e.x,e.y,e.radius*p*.78,t.accent,1);}
                else if(e.type==='laser'){A.line(g,[[120,e.y],[960,e.y]],P.fluid,8*(1-p)+1);A.line(g,[[e.x,520],[e.x,1198]],P.fluid,8*(1-p)+1);}
                else if(e.type==='transport'){if(e.t<.5){const q=e.t/.5;A.gem(g,e.x+(330-e.x)*q,e.y+(1230-e.y)*q-Math.sin(q*Math.PI)*70,9,t.accent);}else A.gem(g,330+(e.t-.5)*150,1230,9,t.accent);}
                return true;
            });
            if(m.skillActive&&m.skillActive.kind===5){A.circle(g,m.skillActive.x,m.skillActive.y,35,P.cyan,P.white,3);A.line(g,[[m.skillActive.x-15,m.skillActive.y-14],[m.skillActive.x+16,m.skillActive.y+13]],P.ink,8);}
            if(m.specialBox){A.icon(g,'box',m.specialBox.x,m.specialBox.y-40,26,P.gold);A.ring(g,m.specialBox.x,m.specialBox.y-40,38+Math.sin(this.clock*4)*2,P.gold,2);}
            m.pets.filter(p=>p.stun>0).forEach(p=>{for(let i=0;i<3;i++){const a=this.clock*4+i*2.094;A.circle(g,p.x+Math.cos(a)*23,p.y-66+Math.sin(a)*7,4,P.gold);}});
            if(this.walletPulse>0){A.ring(wallet,91,353,27+(1-this.walletPulse)*9,P.gold,1.6);this.coinLabel.node.scale=1+this.walletPulse*.025;}else this.coinLabel.node.scale=1;
            // Calm central floor; chapter-specific ambient details stay sparse.
            for(let i=0;i<8;i++){const x=140+(i*137)%800,y=540+((i*91+this.clock*(map===2?-9:-3)+8000)%640);A.circle(g,x+Math.sin(this.clock+i)*12,y,map===2?2:1,t.light);}
            this.floaters=this.floaters.filter(f=>{f.t+=dt;if(f.t>=f.life){f.node.destroy();return false;}f.node.setPosition(f.x,-f.y+f.t*64);f.node.opacity=Math.round(255*Math.min(1,(f.life-f.t)*3));return true;});
            if(this.toastLife>0){this.toastLife-=dt;this.toastLayer.opacity=Math.min(255,Math.max(0,this.toastLife*500));}
        },
        update(dt){
            if(!this.model)return;dt=Math.min(dt,.1);this.clock+=dt;
            if(this.pending){this.pending.time+=dt;const b=this.pending.button;if(b.hold&&this.pending.time>=1.5){this.model.grantBuff('frenzy',30);this.toast('伙伴暴走 · 30秒');this.pending=null;this.sound('skill');}else if(b.item&&this.pending.time>=.35){this.pending=null;this.showItem(b.item);}}
            if(!this.modalLayer&&!this.hiddenAt&&!this.chapterView&&!this.artLoading&&this.shopScroll.step(dt))this.positionShop();
            this.stepWhip(dt);if(!this.modalLayer&&!this.hiddenAt&&!this.chapterView&&!this.artLoading)this.model.tick(dt);if(this.whipFrame.radius!==this.model.radius())this.stepWhip(0);
            if(this.transitionLeft>0&&!this.hiddenAt){this.transitionLeft-=dt;if(this.transitionLabel)this.transitionLabel.string=Math.ceil(this.transitionLeft)+'秒后继续';if(this.transitionLeft<=0)this.continueChapter();}
            this.handleEvents();if(this.chapterView){if(!this.hiddenAt)this.chapterView.update(dt);}else this.updateVisuals(dt);this.uiTime+=dt;this.saveTime+=dt;
            if(this.uiTime>.18){this.uiTime=0;this.refreshHUD();this.refreshCards();}
            if(this.saveTime>3){this.saveTime=0;this.save();}
        },
        save(){if(!this.model||this.model.sandbox)return;try{cc.sys.localStorage.setItem(Data.saveKey,JSON.stringify(this.model.export()));}catch(e){console.warn('本地存档不可写',e);}},
        toast(text){this.toastLayer.removeAllChildren();const g=this.graphics('Toast panel',this.toastLayer);A.rect(g,145,1060,790,72,22,P.ink,P.edge,2);this.label(text,540,1095,27,P.text,750,this.toastLayer,'center');this.toastLayer.opacity=255;this.toastLife=2.2;},
        modal(title,subtitle,height){
            this.cancelShopGesture();this.releaseWhip();this.closeModal();const n=new cc.Node('Modal');this.rootNode.addChild(n);n.zIndex=1000;this.modalLayer=n;this.modalButtons=[];
            const y=Math.max(250,(1920-height)/2),g=this.graphics('Modal panel',n);
            g.fillColor=A.color('#081519',232);g.rect(-10,-1930,1100,1940);g.fill();A.rect(g,70,y,940,height,36,P.panel,P.edge,3);
            this.label(title,116,y+66,39,P.text,760,n);this.label(subtitle||'',116,y+119,23,P.muted,810,n);
            A.icon(g,'close',956,y+57,22,P.muted);this.modalButtons.push({x:915,y:y+20,w:80,h:80,fn:()=>this.closeModal()});
            return {n,g,y};
        },
        closeModal(){if(this.modalLayer)this.modalLayer.destroy();this.modalLayer=null;this.modalButtons=[];this.pending=null;this.transitionLeft=0;this.transitionLabel=null;},
        modalButton(text,x,y,w,h,fn,accent){const g=this.graphics('Modal action',this.modalLayer);A.rect(g,x,y,w,h,18,accent?A.themes[this.model.state.map].accent:P.bg,accent?A.themes[this.model.state.map].accent:P.edge,2);this.label(text,x+w/2,y+h/2,27,accent?P.ink:P.text,w-30,this.modalLayer,'center');this.modalButtons.push({x,y,w,h,fn});},
        showItem(item){const box=this.modal(item.name,'商品详情 · 原数值配置',610),check=this.model.canBuy(item);const text=[item.desc,'当前：'+this.model.buyCount(item.id)+' / '+this.model.maxCount(item),'费用：'+fmt(this.model.cost(item))+' '+(item.costType===0?'尸币':this.model.chapter.rare),check.ok?'现在可以购买':check.reason];text.forEach((s,i)=>this.label(s,121,box.y+192+i*68,i===0?24:27,i===2?P.gold:P.text,820,box.n));this.modalButton(check.ok?'购买一次':'知道了',120,box.y+493,840,74,()=>{this.closeModal();if(check.ok){const r=this.model.buy(item.id);this.handleEvents();this.refreshHUD();this.refreshCards();this.save();if(!r.ok)this.toast(r.reason);}},check.ok);},
        showDemoMenu(){
            const b=this.modal('Demo 展示台','展示模式独立运行，不影响原值成长存档',850);
            for(let i=0;i<3;i++)this.modalButton('进入展示 · 0'+(i+1)+' '+Logic.CHAPTERS[i].name,120,b.y+174+i*118,840,92,()=>this.enterShowcase(i),false);
            this.modalButton('观看 · 墓园入厂转场',120,b.y+535,840,78,()=>this.previewFactoryTransition(),false);
            this.modalButton(this.model.sandbox?'返回我的正常进度':'继续正常游玩',120,b.y+640,840,78,()=>this.model.sandbox?this.returnToGame():this.closeModal(),true);
            this.label('正常开局：1只腐尸 / 0尸币 · 三章展示可直接体验',540,b.y+782,21,P.muted,820,b.n,'center');
        },
        enterShowcase(map){
            this.cancelChapterAnimation();
            if(!this.model.sandbox){this.save();this.normalSnapshot=this.model.export();}
            this.closeModal();this.model=Logic.GameModel.showcase(clamp(map,0,2));this.tab=0;
            const first=map===1?'moon_staff':map===2?'sun_openbox':'spoon';this.shopOffsets=[Math.max(0,Math.floor(this.shopItems().findIndex(x=>x.id===first)/2)*125),0];this.build();this.loadChapterArt(map,()=>this.toast(map===1?'伙伴从左到右：载具 / 作业盔 / 基础':'章节展示 · 可购买、催工、释放技能'));
        },
        returnToGame(){
            this.cancelChapterAnimation();this.closeModal();if(this.model.sandbox){const data=this.normalSnapshot;if(data)data.lastSeen=Date.now();this.model=new Logic.GameModel(data);this.normalSnapshot=null;}this.tab=0;this.shopOffsets=[0,0];this.build();this.loadChapterArt(this.model.state.map,()=>this.toast('已返回正常进度'));
        },
        showChapterInfo(index){
            const c=Logic.CHAPTERS[index],b=this.modal(c.name,'三阶段共享拖鞭催工玩法，主要变化在题材与表现',590);
            const texts=[['皮鞭 · 旧墓 · 滑稽腐尸','骨质结块 → 骨晶','招募、自动化与镀金改造'],['电鞭 · 培养罐 · 机械改造尸','带电废核 → 电核','原两种主动技能与机械进化'],['燃烧链鞭 · 幽绿熔岩 · 岩甲尸工','封魂结晶 → 魂晶','尸匣、十二遗物与终局成长']][index];
            texts.forEach((text,i)=>this.label(text,120,b.y+201+i*62,28,i===0?A.themes[index].accent:P.text,820,b.n));
            this.label('章节目标：'+fmt(c.goal)+' 尸币',120,b.y+406,26,P.gold,820,b.n);
            this.modalButton('继续经营当前章节',120,b.y+476,840,73,()=>this.closeModal(),true);
        },
        showResult(afterDeparture){
            if(this.model.state.map===0&&!afterDeparture&&!this.chapterView){this.startFactoryDeparture();return;}
            const map=this.model.state.map,b=this.modal(map===2?'冥界已封存':map===0?'墓园结算 · 全员转岗':'这一站，经营完成！',this.model.chapter.name+' · 队伍和成长将按原规则继承',620);
            this.label('累计开工 '+fmt(this.model.state.hits)+' 次',540,b.y+215,36,P.gold,820,b.n,'center');
            this.label(map===2?'Demo 的三个世界已全部展示':'下一站：'+Logic.CHAPTERS[map+1].name,540,b.y+285,30,P.text,820,b.n,'center');
            this.transitionLabel=this.label('3秒后继续',540,b.y+357,24,P.muted,820,b.n,'center');
            this.modalButton(map===2?'继续经营冥界':map===0?'继续 · 墓园入厂':'前往下一世界',120,b.y+453,840,85,()=>this.continueChapter(),true);this.transitionLeft=3;
            this.modalButtons[0].fn=()=>this.continueChapter();
        },
        loadChapterArt(map,done){
            const current=this.model,request=++this.artRequest;this.artLoading=true;this.pending=null;this.releaseWhip();
            V.preload(err=>{if(!cc.isValid(this.node)||this.model!==current||this.artRequest!==request)return;this.artLoading=false;
                if(!this.modalLayer&&!this.chapterView)this.build();if(err)this.toast('部分画面未载入，可重新进入章节重试');if(done)done(err);
            },map);
        },
        cancelChapterAnimation(){this.artRequest++;this.artLoading=false;if(this.chapterView){this.chapterView.destroy();this.chapterView=null;}this.chapterAdvancing=false;},
        chapterActors(){return Object.values(this.unitNodes).concat(Object.values(this.petNodes)).map(r=>({node:r.g.node}));},
        startFactoryDeparture(){
            if(this.chapterView||this.artLoading)return;this.releaseWhip();this.save();
            this.loadChapterArt(1,err=>{
                if(err){this.showResult(true);return;}const art=V.resource('transition');
                this.model.units.forEach(u=>{const r=this.unitNodes[u.id];if(r)V.animate(r.g,u.kind,0,false,{phase:'finish',progress:.96,pose:5},this.clock,1,0);});
                this.whip.node.active=false;const view=ChapterMovie.create(this.rootNode,Object.assign({width:1080,height:1920},art));this.chapterView=view;view.phase='depart';
                view.depart(this.chapterActors(),()=>{if(this.chapterView!==view)return;view.phase='result';this.showResult(true);});
            });
        },
        continueChapter(){
            if(this.chapterAdvancing||!this.model.state.pendingChapter)return;this.chapterAdvancing=true;
            const factory=this.model.state.map===0;this.transitionLeft=0;this.closeModal();if(this.chapterView){this.chapterView.destroy();this.chapterView=null;}
            this.model.advance();this.save();this.tab=0;this.shopOffsets=[0,0];this.build();
            this.loadChapterArt(this.model.state.map,err=>{if(!factory||err){this.chapterAdvancing=false;return;}
                this.whip.node.active=false;const view=ChapterMovie.create(this.rootNode,Object.assign({width:1080,height:1920},V.resource('transition')));this.chapterView=view;view.phase='arrive';
                view.arrive(this.chapterActors(),()=>{if(this.chapterView!==view)return;view.destroy();this.chapterView=null;this.chapterAdvancing=false;this.whip.node.active=true;this.releaseWhip();this.toast('已到岗 · 作业装备请在伙伴栏配置');});
            });
        },
        previewFactoryTransition(){this.enterShowcase(0);this.model.state.pendingChapter=true;this.loadChapterArt(1,()=>this.startFactoryDeparture());},
        openBoxes(){
            if(!this.model.buyCount('sun_openbox'))return this.toast('先在商店开启尸匣功能');
            const r=this.model.openBoxes();if(!r.ok)return this.toast(r.reason);
            const h=480+Math.ceil(r.items.length/2)*72,b=this.modal('尸匣开启 ×'+r.count,'普通开箱 · 本次可售物已按1倍结算',h);
            r.items.forEach((item,i)=>{const x=123+(i%2)*425,y=b.y+183+Math.floor(i/2)*72;this.label(item.collect?'遗物 · '+item.name:item.name,x,y,25,item.collect?P.gold:item.quality==='gold'?P.gold:item.quality==='purple'?P.blue:P.text,395,b.n);});
            this.label('获得 '+fmt(r.total)+' 尸币',540,b.y+h-180,35,P.gold,820,b.n,'center');this.modalButton('收下，继续催工',120,b.y+h-118,840,75,()=>this.closeModal(),true);this.save();this.sound('buy');
        },
        showCollections(){
            const b=this.modal('冥界遗物柜','已收集 '+this.model.state.collects.length+' / 12 · 唯一收藏，永久属性',1000);
            Data.collects.forEach((c,i)=>{const owned=this.model.state.collects.includes(c.id),x=122+(i%2)*426,y=b.y+185+Math.floor(i/2)*105;A.rect(b.g,x-8,y-19,402,85,16,P.bg,owned?P.gold:P.edge,2);this.label(c.name,x+16,y+4,25,owned?P.gold:P.muted,362,b.n);this.label(owned?'已拥有 · 属性生效':'未获得 · 在尸匣中寻找',x+16,y+40,19,P.muted,362,b.n);});
            this.label('Demo 未接广告；正式成长沿用普通开箱概率',540,b.y+853,22,P.muted,830,b.n,'center');this.modalButton('返回场地',120,b.y+906,840,65,()=>this.closeModal(),true);
        },
        showOffline(){const reward=this.model.state.offlineReward;if(!reward)return;const b=this.modal('尸工代班收益','离线30分钟起算，最多累计8小时',530);this.label('+'+fmt(reward)+' 尸币',540,b.y+242,49,P.gold,820,b.n,'center');this.modalButton('领取收益',120,b.y+386,840,80,()=>{this.model.claimOffline();this.closeModal();this.save();},true);},
        unlockAudio(){if(!this.soundEnabled||this.audio)return;try{const C=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);if(C)this.audio=new C();}catch(e){this.audio=null;}},
        sound(type){
            if(!this.soundEnabled||!this.audio||this.clock-this.lastSound<.05)return;this.lastSound=this.clock;
            if(type==='swing'){
                const ctx=this.audio,now=ctx.currentTime,length=Math.floor(ctx.sampleRate*.10),buffer=ctx.createBuffer(1,length,ctx.sampleRate),samples=buffer.getChannelData(0);
                for(let i=0;i<length;i++)samples[i]=(Math.random()*2-1)*Math.sin(i/length*Math.PI);
                const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(1600,now);filter.frequency.exponentialRampToValueAtTime(450,now+.1);gain.gain.setValueAtTime(.012,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.11);source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};source.start();return;
            }
            if(type==='whip'){
                const ctx=this.audio,now=ctx.currentTime,map=this.model.state.map;if(ctx.state==='suspended')ctx.resume();
                const variation=.94+Math.random()*.12,length=Math.floor(ctx.sampleRate*.055),buffer=ctx.createBuffer(1,length,ctx.sampleRate),samples=buffer.getChannelData(0);
                for(let i=0;i<length;i++)samples[i]=(Math.random()*2-1)*Math.pow(1-i/length,2);
                const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();noise.buffer=buffer;filter.type='bandpass';filter.frequency.value=(map===0?2200:map===1?3400:1400)*variation;filter.Q.value=map===1?2:.8;
                gain.gain.setValueAtTime(.075,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.075);noise.connect(filter);filter.connect(gain);gain.connect(ctx.destination);noise.onended=()=>{noise.disconnect();filter.disconnect();gain.disconnect();};noise.start();
                const thud=ctx.createOscillator(),body=ctx.createGain();thud.type='sine';thud.frequency.setValueAtTime(135*variation,now);thud.frequency.exponentialRampToValueAtTime(48,now+.07);body.gain.setValueAtTime(.055,now);body.gain.exponentialRampToValueAtTime(.0001,now+.09);thud.connect(body);body.connect(ctx.destination);thud.onended=()=>{thud.disconnect();body.disconnect();};thud.start();thud.stop(now+.10);
                if(map>0){const o=ctx.createOscillator(),v=ctx.createGain();o.type=map===1?'sine':'triangle';o.frequency.setValueAtTime(map===1?1200:480,now);o.frequency.exponentialRampToValueAtTime(map===1?400:170,now+.11);v.gain.setValueAtTime(.014,now);v.gain.exponentialRampToValueAtTime(.0001,now+.14);o.connect(v);v.connect(ctx.destination);o.start();o.stop(now+.15);}return;
            }
            const ctx=this.audio;if(ctx.state==='suspended')ctx.resume();const o=ctx.createOscillator(),g=ctx.createGain(),now=ctx.currentTime,base={click:450,buy:740,whip:150,ore:310,skill:110,stamp:220}[type]||300;
            o.type=type==='whip'?'sawtooth':'triangle';o.frequency.setValueAtTime(base,now);o.frequency.exponentialRampToValueAtTime(base*(type==='buy'?1.6:.4),now+.085);g.gain.setValueAtTime(type==='stamp'?.012:type==='whip'?.018:.035,now);g.gain.exponentialRampToValueAtTime(.0001,now+.13);o.connect(g);g.connect(ctx.destination);o.start();o.stop(now+.14);
        }
    });
    function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
    if(typeof module!=='undefined')module.exports=Game;root.WZGame=Game;
})(typeof globalThis!=='undefined'?globalThis:this);
