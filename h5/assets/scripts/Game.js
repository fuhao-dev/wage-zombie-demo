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
    const Runtime=root.WZRuntime||require('./Runtime');
    const Layout=root.WZUILayout||require('./UILayout');
    const Revisit=root.WZRevisit||require('./Revisit');
    const SaveStore=root.WZSaveStore||require('./SaveStore');
    const Rewards=root.WZAdRewards||require('./AdRewards');
    const Ads=root.WZRewardedAds||require('./RewardedAds');
    const P=A.P,fmt=Logic.format;
    const SHOP_CARD_HEIGHT=112,SHOP_ROW_HEIGHT=125,SHOP_UNLOCK_TIME=2.4;
    const TOP_SOUND_X=44,TOP_SETTINGS_X=144,TOP_REVISIT_X=266;
    const BUFF_STATUS_NAMES={double:'收益 ×2',circle:'鞭圈扩大',doubleTool:'幻影尸工',frenzy:'暴走'};
    const BUFF_TILE_ICONS={double:'coins',circle:'scope',frenzy:'bolt'};
    const BUFF_TILE_WIDTH=164,BUFF_TILE_STEP=168,BUFF_TILE_TOP=530;
    const FIELD_OFFER_SPOTS={
        bubble:[[539,770],[660,842],[541,934]],
        gift:[[329,620],[805,620]],
        special:[[329,1028],[835,1028],[329,865]]
    };
    const GOAL_BAR_WIDTH=936;
    const MIN_STARTUP_VISIBLE_SECONDS=3.2;
    const LAUNCH_COLORS={background:'#f1efe4',paper:'#fbfaf4',edge:'#e3dfcf',ink:'#33352e',muted:'#706858',green:'#507755',track:'#e2dece'};
    const gameTitle=Runtime.config.gameTitle;
    const Game=cc.Class({
        name:'WageZombieGame',extends:cc.Component,
        properties:{launchAgeTexture:{default:null,type:cc.Texture2D}},
        onLoad(){
            this.configureLayout();
            this.uiTime=0;this.saveTime=0;this.clock=0;this.tab=0;this.shopOffsets=[0,0];this.buttons=[];this.modalButtons=[];this.effects=[];this.floaters=[];this.unitNodes={};this.petNodes={};this.oreNodes={};this.pending=null;this.pointerDown=false;this.modalLayer=null;this.normalSnapshot=null;this.soundEnabled=true;this.lastSound=0;this.reactions={};this.whipPulse=0;this.walletPulse=0;this.whipDrag={x:0,y:0};
            this.shopScroll=new Scroll.ShopScroll();this.shopGesture=false;
            this.chapterView=null;this.chapterAdvancing=false;this.artLoading=false;this.artRequest=0;
            this.startupLoading={visibleSeconds:0,drawn:false,complete:null};
            this.backgrounded=false;
            this.whipMotion=new Motion.WhipMotion();this.hitReactions={};this.nextWhoosh=0;
            this.model=null;this.saveStore=SaveStore.create(cc.sys.localStorage,Data.saveKey);this.saveHealth='ok';
            this.ads=Ads.start(Runtime.config);this.adBusy=false;this.adCompletion=null;this.videoLabels=[];
            this.unsubscribeAds=this.ads.subscribe(()=>{this.adUiDirty=true;});this.ads.prepare();
            this.revisit=Revisit.start();this.revisitChanged=true;
            this.unsubscribeRevisit=this.revisit.subscribe(()=>{this.revisitChanged=true;});
            this.attachInput();
            this.hideHandler=()=>{this.backgrounded=true;this.cancelShopGesture();this.releaseWhip();if(!this.adBusy)this.hiddenAt=Date.now();this.save();};
            this.showHandler=()=>{this.backgrounded=false;if(this.hiddenAt&&this.model&&!this.model.sandbox){this.model.addOffline(Math.max(0,(Date.now()-this.hiddenAt)/1000));this.hiddenAt=0;this.save();if(this.rootNode&&!this.artLoading&&this.model.state.offlineReward>0)this.showOffline();}this.queueLaunchReport();};
            cc.game.on(cc.game.EVENT_HIDE,this.hideHandler);cc.game.on(cc.game.EVENT_SHOW,this.showHandler);
            if(typeof window!=='undefined'){this.unloadHandler=()=>this.save();window.addEventListener('beforeunload',this.unloadHandler);}Runtime.expose(this);
            this.resizeHandler=()=>{this.layoutPending=true;};cc.view.setResizeCallback(this.resizeHandler);
            this.restoreSavedGame();
        },
        restoreSavedGame(){
            const loaded=this.saveStore.load();
            if(!loaded.ok)return this.showSaveProblem(loaded.code);
            try{this.model=new Logic.GameModel(loaded.state);}catch(e){console.warn('进度暂不可恢复',e);this.model=null;return this.showSaveProblem('damaged');}
            if(this.artPage){this.artPage.destroy();this.artPage=null;}this.artLoading=false;this.storageBlocked=false;this.hiddenAt=0;
            this.soundEnabled=this.model.state.settings.sound!==false;
            // Checkpoint offline accrual and its lastSeen together before showing the claim UI.
            this.save();this.loadChapterArt(this.model.state.map,()=>this.restoreRewardPanels());
        },
        showSaveProblem(code,confirm){
            if(this.artPage)this.artPage.destroy();
            this.artLoading=true;this.storageBlocked=true;this.artButtons=[];
            const page=this.artPage=new cc.Node('Save recovery page');this.node.addChild(page);this.placeUI(page,true);page.zIndex=2000;
            const g=this.graphics('Recovery backdrop',page);A.rect(g,-1800,-5000,4680,14000,0,P.bg);A.circle(g,540,600,108,'#1b332f');A.icon(g,'bone',540,600,46,P.green);
            this.label(gameTitle,540,790,60,P.text,900,page,'center');
            this.label(confirm?'确认建立新进度？':code==='unsupported'?'请使用较新版本打开游戏':'进度暂时无法读取',540,955,37,P.text,900,page,'center');
            const lines=confirm?['原进度未能恢复，新进度将替换本机记录。','我们会先保留原始记录，再建立新进度。']:code==='damaged'?['暂未找到完整的主进度或备份。','原数据已保留，可先尝试重新读取。']:code==='unsupported'?['这份进度来自较新的游戏版本。','请更新游戏，当前记录不会被覆盖。']:['请检查设备存储空间或稍后重试。','原数据已保留，不会自动建立新档。'];
            lines.forEach((text,i)=>this.label(text,540,1060+i*65,29,P.muted,900,page,'center'));
            const button=(text,y,fn,accent)=>{A.rect(g,170,y,740,90,22,accent?P.green:P.panel,P.edge,2);this.label(text,540,y+45,32,accent?P.ink:P.text,700,page,'center');this.artButtons.push({x:170,y,w:740,h:90,fn});};
            button(confirm?'保留原进度，返回': '重新读取',1250,()=>confirm?this.showSaveProblem(code):this.restoreSavedGame(),true);
            if(code==='damaged')button(confirm?'确认建立新进度':'建立新进度',1370,()=>{
                if(!confirm)return this.showSaveProblem(code,true);
                const model=new Logic.GameModel(),result=this.saveStore.reset(model.export());
                if(result.ok)this.restoreSavedGame();else{this.showSaveProblem('damaged',true);this.label('暂未能保留记录，请检查存储空间后重试',540,1530,26,P.gold,910,this.artPage,'center');}
            },false);
        },
        onDestroy(){if(this.unsubscribeAds)this.unsubscribeAds();if(this.unsubscribeRevisit)this.unsubscribeRevisit();this.cancelChapterAnimation();this.save();cc.view.setResizeCallback(null);cc.game.off(cc.game.EVENT_HIDE,this.hideHandler);cc.game.off(cc.game.EVENT_SHOW,this.showHandler);if(typeof window!=='undefined')window.removeEventListener('beforeunload',this.unloadHandler);if(this.audio)this.audio.close();},
        configureLayout(){
            const previous=this.layout;
            this.layout=Layout.calculate(cc.view.getFrameSize(),Runtime.metrics());
            const canvas=this.node.getComponent(cc.Canvas);canvas.designResolution=cc.size(1080,this.layout.height);canvas.fitWidth=true;canvas.fitHeight=true;
            this.node.setPosition(540,this.layout.height/2);this.node.setContentSize(1080,this.layout.height);
            if(!this.screenBackdrop){this.screenBackdrop=this.graphics('Safe area background',this.node);this.screenBackdrop.node.zIndex=-1000;}
            this.screenBackdrop.clear();A.rect(this.screenBackdrop,-540,-this.layout.height/2,1080,this.layout.height,0,P.bg);
            if(this.input)this.input.setContentSize(1080,this.layout.height);
            if(this.rootNode){
                this.placeUI(this.rootNode);this.paintLayout();this.modeLabel.node.setPosition(540,-this.layout.footerY);this.drawShop();
                if(this.modalLayer&&previous){const delta=(this.layout.contentHeight-previous.contentHeight)/2;this.modalLayer.y-=delta;this.modalButtons.forEach(b=>b.y+=delta);}
            }
            if(this.artPage)this.placeUI(this.artPage,true);
        },
        placeUI(node,centered){const l=this.layout;node.scale=l.scale;node.setPosition(-540+l.left,l.height/2-l.top-(centered?l.loadingOffset*l.scale:0));if(node.launchFooter){node.launchFooter.y=-l.loadingOffset;this.layoutLaunchHeader(node);}},
        paintLayout(){
            const map=this.model.state.map,l=this.layout;
            this.background.clear();A.background(this.background,map,l.contentHeight);
            this.shopFrame.clear();A.rect(this.shopFrame,26,l.shopTop,1028,l.shopHeight,36,P.panel,P.edge,3);
            this.chapterTrim.clear();V.chrome(this.chapterTrim,map,l.shopBottom);
        },
        queueLaunchReport(){
            if(this.launchReported||this.launchReportQueued||!this.rootNode||this.artLoading)return;
            this.launchReportQueued=true;
            cc.director.once(cc.Director.EVENT_AFTER_DRAW,()=>{
                this.launchReportQueued=false;
                if(cc.isValid(this.node)&&this.rootNode&&this.rootNode.active&&!this.artLoading&&!this.hiddenAt)this.launchReported=Runtime.ready();
            });
        },
        graphics(name,parent){const n=new cc.Node(name);(parent||this.rootNode).addChild(n);const g=n.addComponent(cc.Graphics);g.lineJoin=cc.Graphics.LineJoin.ROUND;g.lineCap=cc.Graphics.LineCap.ROUND;return g;},
        label(text,x,y,size,color,width,parent,align){
            const n=new cc.Node('Text '+text.slice(0,14));(parent||this.rootNode).addChild(n);n.setPosition(x,-y);n.setContentSize(width||700,size*1.5);n.anchorX=align==='center'?.5:align==='right'?1:0;n.anchorY=.5;
            const l=n.addComponent(cc.Label);l.string=text;l.fontFamily='Microsoft YaHei';l.fontSize=size;l.lineHeight=Math.ceil(size*1.36);l.horizontalAlign=align==='center'?cc.Label.HorizontalAlign.CENTER:align==='right'?cc.Label.HorizontalAlign.RIGHT:cc.Label.HorizontalAlign.LEFT;l.verticalAlign=cc.Label.VerticalAlign.CENTER;l.overflow=cc.Label.Overflow.SHRINK;l.enableWrapText=false;n.setContentSize(width||700,size*1.5);n.color=A.color(color||P.text);return l;
        },
        button(x,y,w,h,fn,options){const b=Object.assign({x,y,w,h,fn},options||{});this.buttons.push(b);return b;},
        build(){
            this.cancelShopGesture();
            if(this.rootNode)this.rootNode.destroy();
            this.rootNode=new cc.Node('Runtime UI');this.node.addChild(this.rootNode);this.placeUI(this.rootNode);
            this.buttons=[];this.effects=[];this.floaters=[];this.unitNodes={};this.petNodes={};this.oreNodes={};this.cards=[];this.modalLayer=null;this.modalKind=null;this.modalButtons=[];this.boxLabel=null;this.reactions={};this.whipPulse=0;this.walletPulse=0;
            this.hitReactions={};this.partnerFeedback=new PartnerFX.Feedback();this.nextPartnerSound=0;this.whipMotion.reset();this.whipHeld=false;this.pointerDown=false;this.circlePoint=this.circlePoint||{x:540,y:850};this.model.clearWhip();this.stepWhip(0);
            const map=this.model.state.map,t=A.themes[map];this.background=this.graphics('World');A.background(this.background,map,this.layout.contentHeight);
            if(this.shopUnlockModel!==this.model||this.shopUnlockChapter!==map){
                this.shopUnlockModel=this.model;
                this.shopUnlockChapter=map;
                this.shopUnlocks=new Map();
            }
            this.worldArt=V.world(this.rootNode,map);
            const ui=this.graphics('Interface frame');
            A.rect(ui,TOP_SOUND_X,70,78,70,20,P.panel,P.edge,2);A.icon(ui,'sound',TOP_SOUND_X+39,105,17,this.soundEnabled?t.accent:P.muted);
            this.label('音效',TOP_SOUND_X+39,160,17,P.muted,85,null,'center');
            this.soundButton=this.button(TOP_SOUND_X,70,78,110,()=>{this.soundEnabled=!this.soundEnabled;this.model.state.settings.sound=this.soundEnabled;this.save();this.rebuildKeepState();});
            A.rect(ui,TOP_SETTINGS_X,70,100,70,20,P.panel,P.edge,2);A.icon(ui,Runtime.config.debug?'flask':'settings',TOP_SETTINGS_X+50,105,17,t.accent);
            this.label(Runtime.config.debug?'展示':'设置',TOP_SETTINGS_X+50,160,17,P.muted,100,null,'center');this.button(TOP_SETTINGS_X,70,100,110,()=>Runtime.config.debug?this.showDemoMenu():this.showSettings());
            this.buildWallet(ui,t.accent);
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
            const statusStrip=this.graphics('Playfield status strip');
            A.rect(statusStrip,44,1249,992,35,12,P.panel,P.edge,2);
            this.fieldStatus=this.label('',72,1266,28,P.text,936);
            // Active skills are placed above the conveyor.
            this.skillLabels={};
            if(map>0){for(const [k,x] of [[5,276],[4,582]]){A.rect(ui,x,1151,264,65,17,P.panel,P.edge,2);this.skillLabels[k]=this.label('',x+132,1183,23,t.accent,250,null,'center');this.button(x,1151,264,65,()=>{const r=this.model.useSkill(k);if(!r.ok)this.toast(r.reason);});}}
            this.buildBuffDisplay(t.accent);
            this.fieldOfferLayer=new cc.Node('Field rewards');this.rootNode.addChild(this.fieldOfferLayer);this.fieldOfferLayer.zIndex=11;
            this.fieldOffers={};this.fieldOfferButtons={};
            for(const kind of Object.keys(FIELD_OFFER_SPOTS))this.fieldOfferButtons[kind]=this.button(0,0,0,0,()=>this.openFieldOffer(kind));
            if(map===2){
                A.rect(ui,922,548,92,114,23,P.panel,P.edge,2);A.icon(ui,'box',968,580,22,t.accent);this.boxLabel=this.label('尸匣',968,624,20,t.accent,85,null,'center');this.button(922,548,92,114,()=>this.openBoxes());
                A.rect(ui,922,681,92,95,23,P.panel,P.edge,2);A.gem(ui,968,709,18,P.gold);this.label('遗物',968,747,20,P.gold,85,null,'center');this.button(922,681,92,95,()=>this.showCollections());
            }
            // Shop base and tabs.
            this.shopFrame=this.graphics('Shop panel');A.rect(this.shopFrame,26,1290,1028,this.layout.shopHeight,36,P.panel,P.edge,3);
            this.chapterTrim=this.graphics('Chapter trim');V.chrome(this.chapterTrim,map,this.layout.shopBottom);
            this.label(['墓园招工棚','尸厂改造站','冥界契约所'][map],62,1338,30,P.text,420);
            this.shopHint=this.label('上下滑动 · 长按查看详情',1016,1339,20,P.muted,460,null,'right');
            this.shopLayer=new cc.Node('Shop');this.rootNode.addChild(this.shopLayer);
            this.drawShop();
            this.modeLabel=this.label('',540,this.layout.footerY,18,P.muted,990,null,'center');
            this.toastLayer=new cc.Node('Toast');this.rootNode.addChild(this.toastLayer);this.toastLayer.zIndex=2000;
            this.revisitEntry=null;this.refreshRevisitEntry();
            this.refreshHUD();this.refreshFieldOffers();this.updateVisuals(0);this.handleEvents();
        },
        drawBuffIcon(g,key,x,y,size,accent){
            if(key!=='doubleTool')return A.icon(g,BUFF_TILE_ICONS[key],x,y,size,accent);
            const worker=this.model.units.find(u=>!u.clone),kind=worker?worker.kind:0;
            const shade=V.workerHead(g.node,'Phantom worker portrait',kind,x-size*.43,y-size*.39,size*1.48);
            if(shade){
                shade.color=A.color('#95e6d3');shade.opacity=180;
                const face=V.workerHead(g.node,'Worker portrait',kind,x+size*.19,y-size*.16,size*1.61);
                face.color=A.color(this.model.state.map===1?'#d1e8df':'#d1edcf');
            }
            const badge=this.graphics('Worker multiplier',g.node);
            const bx=x+size*.82,by=y+size*.81;
            A.rect(badge,bx-size*.66,by-size*.42,size*1.32,size*.84,size*.28,P.ink,accent,2);
            this.label('×2',bx,by,size*.72,P.white,size*1.24,badge.node,'center');
        },
        buildBuffDisplay(accent){
            const g=this.graphics('Field buffs'),node=g.node;
            node.zIndex=12;
            this.buffTiles={};
            this.buffStatusTop=BUFF_TILE_TOP;
            if(this.adSupported()){
                const keys=[this.model.state.map===0?'circle':'doubleTool','double','frenzy'];
                for(const key of keys){
                    const y=this.buffStatusTop,plate=this.graphics('Video boost '+key,node);
                    A.circle(plate,137,y+51,49,P.panel,P.ink,7);
                    A.ring(plate,137,y+51,46,accent,3);
                    this.drawBuffIcon(plate,key,137,y+51,29,accent);
                    const video=this.graphics('Video playback marker',plate.node);
                    A.circle(video,172,y+21,20,P.ink,P.edge,2);
                    A.icon(video,'video',172,y+21,15,P.white);
                    A.rect(plate,65,y+96,144,34,11,P.panel,P.edge,2);
                    this.label(BUFF_STATUS_NAMES[key],137,y+113,26,P.text,138,plate.node,'center');
                    const timer=this.label('',137,y+146,23,accent,158,node,'center');
                    const button=this.button(55,y,BUFF_TILE_WIDTH,159,()=>this.runRewardVideo('buff',key));
                    this.buffTiles[key]={plate:plate.node,timer,button};
                    this.buffStatusTop+=BUFF_TILE_STEP;
                }
            }
            this.buffStatusLabels={};
            for(const key of Object.keys(BUFF_STATUS_NAMES)){
                if(this.buffTiles[key])continue;
                const row=this.graphics('Active '+key,node);
                row.node.active=false;
                A.rect(row,0,0,218,44,13,P.panel,P.edge,2);
                this.buffStatusLabels[key]=this.label('',13,22,23,accent,192,row.node);
            }
        },
        refreshBuffDisplay(){
            const formatTime=seconds=>Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
            for(const [key,tile] of Object.entries(this.buffTiles)){
                const eligible=key!=='frenzy'||this.model.pets.length>0;
                const seconds=Math.ceil(this.model.state.buffs[key]);
                tile.plate.opacity=eligible?255:130;
                tile.button.w=eligible?BUFF_TILE_WIDTH:0;
                tile.timer.string=seconds>0?formatTime(seconds):eligible?'':'需先招募伙伴';
                tile.timer.node.active=!!tile.timer.string;
            }
            let y=this.buffStatusTop;
            for(const [key,label] of Object.entries(this.buffStatusLabels)){
                const seconds=Math.ceil(this.model.state.buffs[key]),row=label.node.parent;
                row.active=seconds>0;
                if(!row.active)continue;
                row.setPosition(61,-y);
                label.string=BUFF_STATUS_NAMES[key]+' · '+formatTime(seconds);
                y+=50;
            }
        },
        buildWallet(ui,accent){
            const titleY=249,valueY=301,iconY=291;
            this.walletArrivalY=iconY;
            A.rect(ui,44,214,992,195,25,P.panel,P.edge,2);
            A.coin(ui,91,iconY,26);
            this.label('尸币',134,titleY,21,P.muted,250);
            this.coinLabel=this.label('0',134,valueY,48,P.gold,470);
            A.line(ui,[[610,239],[610,326]],P.edge,2);
            A.gem(ui,662,iconY,26,accent);
            this.label(this.model.chapter.rare,707,titleY,21,P.muted,280);
            this.rareLabel=this.label('0',707,valueY,42,accent,280);
            A.line(ui,[[72,340],[1008,340]],P.edge,2);
            A.rect(ui,72,386,GOAL_BAR_WIDTH,8,4,P.edge);
            this.chapterGoal={
                title:this.label('',72,363,28,accent,390),
                detail:this.label('',1008,363,26,P.text,526,null,'right'),
                fill:this.graphics('Chapter goal progress'),
                width:-1,
                button:this.button(44,341,0,68,()=>{
                    const item=this.model.item(this.model.chapter.exit);
                    const state=this.model.state;
                    if(!state.completed&&!state.pendingChapter&&!this.model.canBuy(item).locked)this.showItem(item);
                })
            };
        },
        refreshChapterGoal(){
            const goal=this.chapterGoal;
            if(!goal)return;
            const model=this.model,state=model.state;
            const item=model.item(model.chapter.exit),target=model.cost(item);
            const check=model.canBuy(item),finished=state.completed||state.pendingChapter;
            const accent=A.themes[state.map].accent;
            const missing=Math.max(0,target-state.coins);
            const available=!finished&&!check.locked&&!check.full;
            const funded=finished||state.coins>=target;
            const fraction=funded?1:state.coins/target;
            const percent=fraction*100;
            let progress=Math.min(percent,99.999).toFixed(3).replace(/\.?0+$/,'')+'%';
            if(funded)progress='100%';
            else if(percent>0&&percent<0.001)progress='<0.001%';
            const width=funded?GOAL_BAR_WIDTH:Math.min(GOAL_BAR_WIDTH-1,Math.floor(GOAL_BAR_WIDTH*fraction));
            goal.button.w=available?992:0;
            const title=state.completed?'冥界已封存':item.name;
            goal.title.string=title+' · '+progress+(available?'  ›':'');
            if(state.completed)goal.detail.string='继续经营';
            else if(state.pendingChapter)goal.detail.string='结算中';
            else if(check.locked)goal.detail.string=check.reason;
            else if(check.ok)goal.detail.string='已攒齐 '+fmt(target)+' 尸币';
            else goal.detail.string='目标 '+fmt(target)+' · 还差 '+fmt(missing)+' 尸币';
            if(goal.width!==width){
                goal.width=width;
                goal.fill.clear();
                if(width>0)A.rect(goal.fill,72,386,width,8,4,accent);
            }
            goal.detail.node.color=A.color(check.ok||finished?accent:P.text);
        },
        rebuildKeepState(){this.closeModal();this.build();},
        attachInput(){
            const n=new cc.Node('Input surface');this.node.addChild(n);n.setContentSize(1080,this.layout.height);n.zIndex=999;
            const point=e=>{const origin=this.artPage||this.rootNode,p=origin.convertToNodeSpaceAR(e.getLocation());return {x:p.x,y:-p.y};};
            n.on(cc.Node.EventType.TOUCH_START,e=>this.touchStart(point(e)));
            n.on(cc.Node.EventType.TOUCH_MOVE,e=>this.touchMove(point(e)));
            n.on(cc.Node.EventType.TOUCH_END,()=>this.touchEnd());
            n.on(cc.Node.EventType.TOUCH_CANCEL,()=>{this.pending=null;this.cancelShopGesture();this.releaseWhip();});
            n.on(cc.Node.EventType.MOUSE_WHEEL,e=>{const p=point(e);if(!this.modalLayer&&!this.artLoading&&!this.chapterView&&this.inShopViewport(p)){this.pending=null;this.shopGesture=false;this.shopScroll.wheel(-e.getScrollY());this.positionShop();}});
            this.input=n;
        },
        inside(b,p){if(b.item&&b.shop&&!this.inShopViewport(p))return false;return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;},
        touchStart(p){
            if(this.adBusy)return;
            if(this.artLoading){const button=(this.artButtons||[]).find(b=>this.inside(b,p));if(button)this.pending={button,time:0,x:p.x,y:p.y,loading:true};return;}
            if(this.chapterView&&this.chapterView.phase!=='result')return;
            this.unlockAudio();
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
            const held=this.whipHeld&&!this.modalLayer&&!this.hiddenAt&&!this.chapterView&&!this.artLoading&&!this.adBusy;
            this.whipFrame=this.whipMotion.update(this.circlePoint.x,this.circlePoint.y,dt,held,this.model.radius());
            if(held)this.model.setCursor(this.circlePoint.x,this.circlePoint.y);else this.model.clearWhip();
        },
        touchEnd(){if(this.adBusy){this.pending=null;return;}if(this.artLoading){const p=this.pending;this.pending=null;if(p&&p.loading)p.button.fn();return;}const dragged=this.shopGesture&&this.shopScroll.end(this.clock);this.shopGesture=false;const p=this.pending;this.pending=null;this.releaseWhip();if(p&&!dragged){p.button.fn();this.sound('click');if(!this.artLoading&&this.rootNode&&this.rootNode.active){this.refreshHUD();this.refreshCards();this.handleEvents();}this.save();}},
        cancelShopGesture(){this.shopGesture=false;if(this.shopScroll)this.shopScroll.stop();this.pending=null;},
        inShopViewport(p){const r=this.shopViewport;return !!r&&p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;},
        shopItems(tab=this.tab){return this.model.shop.filter(x=>x.sec===tab&&x.effect!=='urgeUpdate'&&!this.model.canBuy(x).locked);},
        buyShopItem(item){
            const previous=new Set(this.shopItems(0).concat(this.shopItems(1)));
            const result=this.commitProgress(()=>this.model.buy(item.id));
            if(!result.ok)return result;
            const current=new Set(this.shopItems(0).concat(this.shopItems(1)));
            this.shopUnlocks.delete(item);
            for(const offer of this.shopUnlocks.keys()){
                if(!current.has(offer))this.shopUnlocks.delete(offer);
            }
            for(const offer of current){
                if(!previous.has(offer))this.shopUnlocks.set(offer,SHOP_UNLOCK_TIME);
            }
            this.refreshShopUnlockNotice();
            if(V.required&&!V.has(V.required(this.model)))this.loadChapterArt(this.model.state.map);
            return result;
        },
        refreshShopUnlockNotice(){
            const t=A.themes[this.model.state.map],count=this.shopUnlocks.size;
            const next=this.shopUnlocks.keys().next().value;
            this.shopHint.string=count===0?'上下滑动 · 长按查看详情':
                count===1?'新解锁 · '+next.name+'  ›':'新解锁 '+count+' 项  ›';
            this.shopHint.node.color=A.color(count?t.accent:P.muted);
            this.shopUnlockButton.w=count?454:0;
            const g=this.shopTabUnlocks;g.clear();
            for(const tab of new Set(Array.from(this.shopUnlocks.keys(),item=>item.sec))){
                A.circle(g,505+tab*494,1400,8,P.gold,P.ink,2);
            }
        },
        showNewShopItem(){
            const item=this.shopUnlocks.keys().next().value;
            if(!item)return;
            const index=this.shopItems(item.sec).indexOf(item);
            if(index<0)return;
            const top=Math.floor(index/2)*SHOP_ROW_HEIGHT;
            const offset=clamp(this.shopOffsets[item.sec],top+SHOP_CARD_HEIGHT-this.shopViewport.h,top);
            if(this.tab!==item.sec){
                this.shopOffsets[item.sec]=offset;
                this.tab=item.sec;
                this.drawShop();
            }else{
                this.shopScroll.wheel(offset-this.shopScroll.offset);
                this.positionShop();
                this.updateShopUnlocks(0);
            }
        },
        selectShopTab(tab){
            if(tab===1&&!this.shopItems(tab).length){
                const workshop=this.model.item('belt_unlock');
                const hint=this.model.buyCount(workshop.id)
                    ? this.model.canBuy(this.model.item('up_range')).reason
                    : '请先解锁'+workshop.name;
                this.toast(hint,{y:590,emphasized:true});
                return;
            }
            this.shopOffsets[this.tab]=this.shopScroll.offset;
            this.tab=tab;
            this.drawShop();
        },
        drawShop(){
            this.cancelShopGesture();this.shopLayer.children.slice().forEach(n=>n.destroy());this.shopLayer.removeAllChildren();this.buttons=this.buttons.filter(b=>!b.shop);this.cards=[];
            const g=this.graphics('Shop chrome',this.shopLayer),t=A.themes[this.model.state.map];
            for(let i=0;i<2;i++){const x=60+i*494;A.rect(g,x,1370,470,61,16,this.tab===i?t.accent:P.bg,this.tab===i?t.accent:P.edge,2);this.label(i===0?'招募与经营':'赋能与改造',x+235,1400,25,this.tab===i?P.ink:P.muted,450,this.shopLayer,'center');this.button(x,1370,470,61,()=>this.selectShopTab(i),{shop:true});}
            this.shopTabUnlocks=this.graphics('New offers by tab',this.shopLayer);
            this.shopUnlockButton=this.button(570,1310,0,52,()=>this.showNewShopItem(),{shop:true});
            this.refreshShopUnlockNotice();
            this.shopViewport={x:60,y:1450,w:964,h:this.layout.shopViewportHeight};const r=this.shopViewport,items=this.shopItems(),height=Math.max(0,(Math.ceil(items.length/2)-1)*SHOP_ROW_HEIGHT+SHOP_CARD_HEIGHT);
            this.shopScroll.configure(height,r.h,this.shopOffsets[this.tab]||0);
            const clip=new cc.Node('Shop scroll viewport');this.shopLayer.addChild(clip);clip.setPosition(r.x+r.w/2,-r.y-r.h/2);clip.setContentSize(r.w,r.h);clip.addComponent(cc.Mask).type=cc.Mask.Type.RECT;
            this.shopContent=new cc.Node('Shop scrolling cards');clip.addChild(this.shopContent);
            items.forEach((item,i)=>{
                const x=(i%2)*494,y=Math.floor(i/2)*SHOP_ROW_HEIGHT,w=470,h=SHOP_CARD_HEIGHT;
                const card=new cc.Node('Card '+item.id);this.shopContent.addChild(card);card.setPosition(x,-y);
                const cg=this.graphics('Card shape',card),ig=this.graphics('Card icon',card);ig.node.setPosition(60,-82);
                if(item.type===0){ig.node.y=-56;if(!V.worker(ig,item.kind,this.model.state.map,false,false,0,true)){A.zombie(ig,item.kind,this.model.state.map,false,false);ig.node.scale=.48;ig.node.y=-101;}}
                else if(item.type===2||item.type===3){const p={type:item.id.includes('zhu')||item.id.includes('taotie')?'zhu':'ji',form:item.type===3?(item.upLvFrom||1)+1:1,enhanced:item.id.startsWith('sun_')};V.partner(ig,p,true);}
                else A.icon(ig,item.effect==='hitRange'?'whip':item.id.includes('box')?'box':item.id.includes('escape')?'arrow':item.costType===1?'gem':'flask',0,-35,25,item.costType===0?P.gold:t.accent);
                const title=this.label(item.name,114,28,26,P.text,330,card),desc=this.label('',114,61,19,P.muted,330,card),price=this.label('',114,91,25,P.gold,310,card);
                const badge=this.graphics('Shop video offer',card);
                A.rect(badge,316,73,139,34,10,P.panel,t.accent,2);
                A.icon(badge,'video',334,90,10,t.accent);
                this.label('视频'+this.shopVideoVerb(item),396,90,22,t.accent,101,badge.node,'center');
                badge.node.active=false;
                const button=this.button(r.x+x,r.y+y,w,h,()=>{
                    if(this.adSupported()&&Rewards.canShop(this.model,item)){this.showItem(item);return;}
                    const check=this.model.canBuy(item);
                    if(check.full){this.toast(check.reason);return;}
                    const result=this.buyShopItem(item);
                    if(!result.ok)this.toast(result.reason);else this.sound('buy');
                    this.refreshCards();
                },{shop:true,item});
                this.cards.push({item,node:card,icon:ig.node,g:cg,title,desc,price,videoBadge:badge.node,x,y,w,h,button});
            });
            this.shopScrollBar=this.graphics('Shop scroll position',this.shopLayer);this.positionShop();this.refreshCards();
        },
        positionShop(){
            if(!this.shopContent)return;const r=this.shopViewport,s=this.shopScroll;this.shopOffsets[this.tab]=s.offset;this.shopContent.setPosition(-r.w/2,r.h/2+s.offset);
            this.cards.forEach(c=>{c.button.y=r.y+c.y-s.offset;c.node.active=c.y+c.h>s.offset&&c.y<s.offset+r.h;});
            const g=this.shopScrollBar;g.clear();if(s.max>0){const h=Math.max(32,r.h*r.h/(r.h+s.max)),top=r.y+(r.h-h)*s.offset/s.max;A.rect(g,1035,r.y,5,r.h,2,P.edge);A.rect(g,1035,top,5,h,2,A.themes[this.model.state.map].accent);}
        },
        updateShopUnlocks(dt){
            const offset=this.shopScroll.offset,viewBottom=offset+this.shopViewport.h;
            const accent=A.themes[this.model.state.map].accent;
            let changed=false;
            for(const c of this.cards){
                const remaining=this.shopUnlocks.get(c.item);
                if(remaining!==undefined&&c.y>=offset&&c.y+c.h<=viewBottom){
                    const left=Math.max(0,remaining-dt);
                    if(left>0){
                        if(!c.unlockFx){
                            const frame=this.graphics('New offer outline',c.node);
                            frame.strokeColor=A.color(accent);frame.lineWidth=4;
                            frame.roundRect(4,-c.h+4,c.w-8,c.h-8,15);frame.stroke();
                            const badge=this.graphics('New offer badge',c.node);
                            A.rect(badge,345,72,109,31,11,accent);
                            this.label('新解锁',400,87,19,P.ink,98,badge.node,'center');
                            c.unlockFx={frame:frame.node,badge:badge.node};
                        }
                        const elapsed=SHOP_UNLOCK_TIME-left;
                        const fade=Math.min(1,left/.35);
                        const pulse=.48+.52*Math.sin(Math.min(1,elapsed/.9)*Math.PI)**2;
                        c.unlockFx.badge.active=!c.videoBadge||!c.videoBadge.active;
                        c.unlockFx.frame.opacity=Math.round(255*pulse*fade);
                        c.unlockFx.badge.opacity=Math.round(255*fade);
                        c.unlockFx.badge.y=-4*(1-Math.min(1,elapsed/.2));
                        this.shopUnlocks.set(c.item,left);
                        continue;
                    }
                    this.shopUnlocks.delete(c.item);
                    changed=true;
                }
                if(c.unlockFx&&!this.shopUnlocks.has(c.item)){
                    c.unlockFx.frame.destroy();
                    c.unlockFx.badge.destroy();
                    c.unlockFx=null;
                }
            }
            if(changed)this.refreshShopUnlockNotice();
        },
        shopProgress(item){
            const label=item.evolveFrom?'已改造':({0:'已招募',2:'已招募',3:'已进化'}[item.type]||'等级');
            return label+' '+this.model.buyCount(item.id)+' / '+this.model.maxCount(item);
        },
        shopVideoVerb(item){
            return item.evolveFrom?'改造':({0:'招募',2:'招募',3:'进化'}[item.type]||'升级');
        },
        refreshCards(){
            // Unlocks can add or remove evolution offers. Rebuild only when membership changes.
            const items=this.shopItems();
            if(items.length!==this.cards.length||items.some((item,i)=>this.cards[i].item!==item)){this.drawShop();return;}
            const t=A.themes[this.model.state.map],videoSupported=this.adSupported();
            this.cards.forEach(c=>{
                const check=this.model.canBuy(c.item),g=c.g;g.clear();
                const video=videoSupported&&Rewards.canShop(this.model,c.item);
                c.videoBadge.active=video;
                c.price.node.width=video?192:310;
                A.rect(g,0,0,c.w,c.h,18,check.full?'#1c272b':check.ok?'#2b4139':P.bg,check.full?'#354144':check.ok?t.accent:P.edge,check.ok?3:2);
                c.title.node.color=A.color(check.full?'#72817d':check.locked?P.muted:P.text);c.icon.color=A.color(check.full?'#89908b':'#ffffff');c.icon.opacity=check.full?105:255;
                const earnings=c.item.type===0?' · 每次作业 '+fmt(this.model.income(c.item.kind))+' 尸币':'';
                c.desc.string=check.locked?check.reason:this.shopProgress(c.item)+earnings;c.desc.node.color=A.color(check.full?'#687773':P.muted);
                c.price.string=check.full?check.reason:fmt(this.model.cost(c.item))+' '+(c.item.costType===0?'尸币':this.model.chapter.rare);
                c.price.node.color=A.color(check.full?'#83918b':check.ok?t.accent:check.locked?P.muted:P.gold);
                if(check.ok)A.circle(g,c.w-19,20,4,t.accent);
            });
            this.updateShopUnlocks(0);
        },
        refreshHUD(){
            if(this.artLoading||!this.rootNode||!this.rootNode.active)return;
            const m=this.model,s=m.state;this.coinLabel.string=fmt(s.coins);this.rareLabel.string=fmt(s.rare[s.map]);
            this.refreshChapterGoal();
            this.refreshBuffDisplay();
            this.modeLabel.string=m.sandbox?'分幕展示 · 进度仅用于试玩':'';
            this.modeLabel.node.active=!!this.modeLabel.string;
            this.modeLabel.node.color=A.color(P.gold);
            if(this.saveStateLabel&&cc.isValid(this.saveStateLabel.node))this.saveStateLabel.string='保存状态：'+(this.saveHealth==='error'?'暂未保存，请检查存储空间':this.saveHealth==='backup'?'已保存，备份待更新':'进度与备份已保存');
            const cloneCount=m.units.filter(u=>u.clone).length;this.fieldStatus.string='尸工 '+(m.units.length-cloneCount)+(cloneCount?' + 幻影 '+cloneCount:'')+'   ·   鞭圈半径 '+Math.round(m.radius()*10)/10+'   ·   已开工 '+fmt(s.hits)+' 次';
            const intro=s.hits<4&&!m.sandbox;
            this.hint.string=intro?'该上岗了 · 按住场地拖动鞭圈':'';
            this.subHint.string=intro?'圈住空闲尸工 · 升级可扩大范围':!m.sandbox&&m.ores.length>0?'让鞭圈盖住原料，按住碎炼':'';
            if(s.map>0){this.hint.string='';this.subHint.string='';[4,5].forEach(k=>{const st=s.skills[k],name=k===4?'切割狂潮':'钻机暴走',owned=m.buyCount(k===4?'moon_rake':'moon_staff')>0;this.skillLabels[k].string=owned?name+' '+(st.charge>0?'×'+st.charge:Math.ceil(m.chargeCd(k)-st.time)+'s'):name+' · 未解锁';});}
            if(this.boxLabel)this.boxLabel.string='尸匣 '+s.boxes.reduce((a,b)=>a+b,0);
            this.refreshRevisitEntry();
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
                else if(e.type==='adOffer'&&e.kind==='bubble')this.save();
                else if(e.type==='buy'){
                    const item=e.item;
                    let message={0:'新尸工到岗',2:'伙伴就位',3:'伙伴进化完成'}[item.type]||'升级已生效';
                    if(item.id===this.model.chapter.exit)message='结算手续办妥';
                    else if(item.evolveFrom)message='进化上岗';
                    this.float(message,540,530,P.gold,28);this.save();
                    if(e.item.type===0&&(e.item.kind===4||e.item.kind===5)&&this.model.buyCount(e.item.id)===1)this.toast('新技能已就绪，点击场地下方释放');
                }else if(e.type==='chapterEnd')this.showResult();
                else if(e.type==='box'&&(!e.special||Runtime.config.debug))this.float(e.special?'封印尸匣':'尸匣 +1',e.x,e.y-70,P.gold,26);
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
                if(record.key!==key){record.g.clear();if(!V.worker(record.g,u.kind,map,golden,awake,pose,false))A.zombie(record.g,u.kind,map,golden,awake);record.key=key;record.pose=pose;}record.g.node.opacity=u.clone?135:255;
                if(work.phase==='idle'&&record.phase&&record.phase!=='idle')record.finishedAt=this.clock;
                record.phase=work.phase;
                const reaction=this.hitReactions[u.id],age=reaction?this.clock-reaction.time:10,hit=age>=0&&age<.14?Math.exp(-age*27)*reaction.power:0;
                const rest=record.finishedAt===undefined?0:Math.max(0,1-(this.clock-record.finishedAt)/1.4);
                const cutout=u.kind<=11,rigWork=cutout&&age<.035?Object.assign({},work,{progress:.055}):work;
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
                    const q=1-Math.pow(1-p,2),x=e.x+(91-e.x)*q+Math.sin(p*Math.PI)*35,y=e.y+(this.walletArrivalY-e.y)*q-Math.sin(p*Math.PI)*70;
                    A.coin(wallet,x,y,9+Math.sin(p*Math.PI)*2);if(p>.9)this.walletPulse=1;
                }
                else if(e.type==='link'){A.line(g,[[e.x,e.y-70],[e.tx,e.ty-60]],map===0?P.green:map===1?P.cyan:P.fluid,3*(1-p)+1);A.circle(g,e.x+(e.tx-e.x)*p,e.y-70+(e.ty-e.y+10)*p,5,t.accent);}
                else if(e.type==='shock'||e.type==='skillWave'){A.ring(g,e.x,e.y,e.radius*p,t.accent,4*(1-p)+1);A.ring(g,e.x,e.y,e.radius*p*.78,t.accent,1);}
                else if(e.type==='laser'){
                    // Four existing lanes read as cracks in obsidian. The model still owns
                    // their targets, width, speed and reward; these are only fading marks.
                    for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
                        const points=[];for(let i=0;i<=8;i++){const d=i*100,j=i===0?0:Math.sin(i*2.3)*8;points.push([e.x+dx*d-dy*j,e.y+dy*d+dx*j]);}
                        A.line(g,points,'#344e43',11*(1-p)+1);A.line(g,points,P.fluid,4*(1-p)+.8);A.line(g,points,'#d1e4af',1.2*(1-p)+.3);
                    }
                }
                else if(e.type==='transport'){if(e.t<.5){const q=e.t/.5;A.gem(g,e.x+(330-e.x)*q,e.y+(1230-e.y)*q-Math.sin(q*Math.PI)*70,9,t.accent);}else A.gem(g,330+(e.t-.5)*150,1230,9,t.accent);}
                return true;
            });
            if(m.skillActive&&m.skillActive.kind===5){A.circle(g,m.skillActive.x,m.skillActive.y,35,P.cyan,P.white,3);A.line(g,[[m.skillActive.x-15,m.skillActive.y-14],[m.skillActive.x+16,m.skillActive.y+13]],P.ink,8);}
            m.pets.filter(p=>p.stun>0).forEach(p=>{for(let i=0;i<3;i++){const a=this.clock*4+i*2.094;A.circle(g,p.x+Math.cos(a)*23,p.y-66+Math.sin(a)*7,4,P.gold);}});
            if(this.walletPulse>0){A.ring(wallet,91,this.walletArrivalY,27+(1-this.walletPulse)*9,P.gold,1.6);this.coinLabel.node.scale=1+this.walletPulse*.025;}else this.coinLabel.node.scale=1;
            // Calm central floor; chapter-specific ambient details stay sparse.
            for(let i=0;i<8;i++){const x=140+(i*137)%800,y=540+((i*91+this.clock*(map===2?-9:-3)+8000)%640);A.circle(g,x+Math.sin(this.clock+i)*12,y,map===2?2:1,t.light);}
            this.floaters=this.floaters.filter(f=>{f.t+=dt;if(f.t>=f.life){f.node.destroy();return false;}f.node.setPosition(f.x,-f.y+f.t*64);f.node.opacity=Math.round(255*Math.min(1,(f.life-f.t)*3));return true;});
            if(this.toastLife>0){this.toastLife-=dt;this.toastLayer.opacity=Math.min(255,Math.max(0,this.toastLife*500));}
        },
        update(dt){
            if(this.layoutPending&&!this.chapterView){this.layoutPending=false;this.configureLayout();}
            if(this.artLoading){
                const startup=this.startupLoading;
                if(startup&&startup.drawn&&!this.backgrounded&&(typeof document==='undefined'||!document.hidden)){
                    startup.visibleSeconds+=Math.min(dt,.1);
                    const page=this.artPage;
                    if(page.workerFrames){
                        const frame=page.workerFrames[Math.floor(startup.visibleSeconds*8)%page.workerFrames.length];
                        if(page.worker.spriteFrame!==frame)page.worker.spriteFrame=frame;
                    }
                    if(startup.complete&&startup.visibleSeconds>=MIN_STARTUP_VISIBLE_SECONDS)startup.complete();
                }
                return;
            }
            if(!this.model||!this.rootNode)return;dt=Math.min(dt,.1);this.clock+=dt;if(this.adBusy){this.refreshVideoLabels();return;}
            if(this.modalKind==='revisit'&&this.revisitDay!==this.revisit.snapshot().day)this.revisitChanged=true;
            if(this.revisitChanged&&!this.hiddenAt&&!this.chapterView){this.revisitChanged=false;this.refreshRevisitEntry();if(this.modalKind==='revisit')this.showRevisit();}
            if(this.pending){this.pending.time+=dt;const b=this.pending.button;if(b.item&&this.pending.time>=.35){this.pending=null;this.showItem(b.item);}}
            if(!this.modalLayer&&!this.hiddenAt&&!this.chapterView&&!this.artLoading&&this.shopScroll.step(dt))this.positionShop();
            if(this.shopUnlocks.size&&!this.modalLayer&&!this.hiddenAt&&!this.chapterView&&!this.artLoading)this.updateShopUnlocks(dt);
            this.stepWhip(dt);if(!this.modalLayer&&!this.hiddenAt&&!this.chapterView&&!this.artLoading)this.model.tick(dt);if(this.whipFrame.radius!==this.model.radius())this.stepWhip(0);
            if(this.transitionLeft>0&&!this.hiddenAt){this.transitionLeft-=dt;if(this.transitionLabel)this.transitionLabel.string=Math.ceil(this.transitionLeft)+'秒后继续';if(this.transitionLeft<=0)this.continueChapter();}
            this.handleEvents();if(this.chapterView){if(!this.hiddenAt)this.chapterView.update(dt);}else this.updateVisuals(dt);this.uiTime+=dt;this.saveTime+=dt;
            this.refreshFieldOffers();
            if(this.uiTime>.18){this.uiTime=0;this.refreshHUD();this.refreshCards();this.refreshVideoLabels();}
            if(this.saveTime>3){this.saveTime=0;this.save();}
        },
        save(){
            if(!this.model||this.model.sandbox||this.storageBlocked)return false;
            let result;try{result=this.saveStore.write(this.model.export());}catch(e){result={ok:false,code:'write'};}
            this.saveHealth=result.ok?(result.degraded?'backup':'ok'):'error';
            return result.ok;
        },
        commitProgress(action){
            const before=this.model.export(),random=this.model.random;let result;
            try{result=action();if(result&&result.ok===false)return result;if(this.model.sandbox||this.save())return result;}
            catch(e){console.warn('操作暂未提交',e);}
            this.cancelChapterAnimation();this.model=new Logic.GameModel(before,random);if(this.rootNode)this.build();
            return {ok:false,reason:'操作暂未生效，请稍后重试'};
        },
        toast(text,{y=1095,emphasized=false}={}){
            this.toastLayer.removeAllChildren();
            const g=this.graphics('Toast panel',this.toastLayer);
            const width=emphasized?900:790,height=emphasized?108:72;
            const x=(1080-width)/2,top=y-height/2;
            if(emphasized){
                const accent=A.themes[this.model.state.map].accent;
                A.rect(g,x-9,top-9,width+18,height+18,30,P.ink,accent,5);
            }
            A.rect(g,x,top,width,height,22,emphasized?P.panel:P.ink,P.edge,2);
            this.label(text,540,y,emphasized?38:27,emphasized?P.white:P.text,width-40,this.toastLayer,'center');
            this.toastLayer.opacity=255;this.toastLife=2.2;
        },
        modal(title,subtitle,height,{closeButton=true}={}){
            this.cancelShopGesture();this.releaseWhip();this.closeModal();const n=new cc.Node('Modal');this.rootNode.addChild(n);n.zIndex=1000;this.modalLayer=n;this.modalButtons=[];
            const y=Math.max(250,(this.layout.contentHeight-height)/2),g=this.graphics('Modal panel',n);
            g.fillColor=A.color('#081519',232);g.rect(-300,-this.layout.contentHeight-1000,1680,this.layout.contentHeight+2000);g.fill();A.rect(g,70,y,940,height,36,P.panel,P.edge,3);
            this.label(title,116,y+66,39,P.text,760,n);this.label(subtitle||'',116,y+119,23,P.muted,810,n);
            this.videoLabels=[];
            if(closeButton){
                A.icon(g,'close',956,y+57,22,P.muted);
                this.modalButtons.push({x:915,y:y+20,w:80,h:80,fn:()=>this.onModalClose()});
            }
            return {n,g,y};
        },
        closeModal(){if(this.modalLayer)this.modalLayer.destroy();this.modalLayer=null;this.modalKind=null;this.modalButtons=[];this.pending=null;this.transitionLeft=0;this.transitionLabel=null;},
        modalButton(text,x,y,w,h,fn,accent,size){const g=this.graphics('Modal action',this.modalLayer);A.rect(g,x,y,w,h,18,accent?A.themes[this.model.state.map].accent:P.bg,accent?A.themes[this.model.state.map].accent:P.edge,2);const label=this.label(text,x+w/2,y+h/2,size||27,accent?P.ink:P.text,w-30,this.modalLayer,'center');this.modalButtons.push({x,y,w,h,fn});return label;},
        showItem(item){
            const check=this.model.canBuy(item),video=this.adSupported()&&Rewards.canShop(this.model,item);
            const currency=item.costType===0?'尸币':this.model.chapter.rare,cost=fmt(this.model.cost(item));
            const lines=[{text:item.desc,size:24,color:P.text},{text:this.shopProgress(item),color:P.text}];
            if(!check.full&&(!check.poor||fmt(check.missing)!==cost))lines.push({text:'费用 '+cost+' '+currency,color:P.gold});
            lines.push({text:check.ok?'现在可以购买':check.reason,color:check.poor?P.gold:P.text});
            const actionsY=221+lines.length*68,buyY=actionsY+(video?117:0);
            const box=this.modal(item.name,'工头手册 · 招募与升级',buyY+117);
            lines.forEach(({text,size,color},i)=>this.label(text,121,box.y+192+i*68,size||27,color,820,box.n));
            if(video){
                const amount=item.type===0?'1 名':item.type===2?'1 名伙伴':'1 次';
                const action=this.shopVideoVerb(item)+' '+amount;
                this.videoButton(action,box.y+actionsY,'shop',item.id,()=>this.showItem(this.model.item(item.id)));
            }
            this.modalButton(check.ok?'购买一次':video?'暂不购买':'知道了',120,box.y+buyY,840,74,()=>{
                this.closeModal();
                if(check.ok){const r=this.buyShopItem(item);this.handleEvents();this.refreshHUD();this.refreshCards();this.save();if(!r.ok)this.toast(r.reason);}
            },check.ok);
        },
        showSettings(){
            const b=this.modal('设置','',578);
            this.modalButton('音效 · '+(this.soundEnabled?'已开启':'已关闭'),120,b.y+118,840,88,()=>{this.soundEnabled=!this.soundEnabled;this.model.state.settings.sound=this.soundEnabled;this.save();this.rebuildKeepState();this.showSettings();},true);
            this.modalButton('玩法说明',120,b.y+226,840,88,()=>this.showHelp(),false);
            this.modalButton('关于与存档',120,b.y+334,840,88,()=>this.showAbout(),false);
            this.modalButton('返回游戏',120,b.y+450,840,75,()=>this.closeModal(),false);
        },
        showHelp(){
            const b=this.modal('玩法说明','工头入职指南 · 墓园不打卡，挖一铲算一笔',720);
            [
                '按住场地拖动鞭圈，催促圈内空闲尸工开工。',
                '招募尸工、升级收入，扩大鞭圈催工范围。',
                '招募伙伴自动催工或碎炼，工坊负责运输。',
                '上下滑动逛商店，长按卡片看详情。',
                '前两幕结算后转岗，封存冥界后可继续经营。'
            ].forEach((text,i)=>this.label(text,120,b.y+192+i*71,27,P.text,840,b.n));
            this.modalButton('返回设置',120,b.y+598,840,75,()=>this.showSettings(),true);
        },
        showAbout(){
            const b=this.modal('关于与存档',gameTitle+' · 版本 '+Runtime.version(),800);
            this.modalKind='saveAbout';this.toastLife=0;this.toastLayer.removeAllChildren();
            ['游戏进度自动保存在本机，并保留备份。','记录异常时，优先恢复最近一次可用进度。','清理应用数据或更换设备，不会自动同步存档。','请保留应用数据，避免丢失经营进度。'].forEach((text,i)=>this.label(text,120,b.y+190+i*68,26,P.text,840,b.n));
            this.saveStateLabel=this.label('',120,b.y+462,26,P.gold,840,b.n);this.refreshHUD();
            this.modalButton('立即保存',120,b.y+560,840,74,()=>{this.save();this.refreshHUD();},true);
            this.modalButton('返回设置',120,b.y+662,840,74,()=>this.showSettings(),false);
        },
        adSupported(){return !!(this.ads&&this.ads.snapshot().supported&&!(this.model&&this.model.sandbox));},
        videoButton(text,y,kind,target,back){
            if(!this.adSupported())return;const label=this.modalButton('',120,y,840,78,()=>this.runRewardVideo(kind,target,back),true,26);
            const badge=this.graphics('Video playback marker',this.modalLayer);
            A.rect(badge,139,y+25,35,28,7,P.ink);
            A.icon(badge,'video',156.5,y+39,12,P.white);
            label.node.x=559;label.node.width=760;
            this.videoLabels.push({label,text});this.refreshVideoLabels();
        },
        refreshVideoLabels(){
            if(!this.ads)return;const status=this.ads.snapshot();
            for(const item of this.videoLabels||[])if(cc.isValid(item.label.node))item.label.string='看广告 · '+(typeof item.text==='function'?item.text():item.text)+(status.ready?'':status.phase==='loading'?' · 准备中':status.phase==='error'?' · 点击重试':'');
            if(this.adWaitingLabel&&cc.isValid(this.adWaitingLabel.node))this.adWaitingLabel.string=status.phase==='showing'?'看完广告即可领取奖励':'正在加载广告，请稍候';
        },
        drawFieldOffer(kind,offer){
            const spots=FIELD_OFFER_SPOTS[kind];
            const serial=Math.abs(Number.parseInt(offer.id.split('-').pop(),10))||0;
            const [x,y]=spots[serial%spots.length],g=this.graphics('Field offer '+kind,this.fieldOfferLayer),node=g.node;
            const accent=kind==='bubble'?A.themes[this.model.state.map].accent:P.gold;
            A.circle(g,0,0,55,kind==='bubble'?'#294b40':P.panel,P.ink,6);
            A.ring(g,0,0,52,accent,3);
            A.ellipse(g,-31,-30,9,5,P.white);
            let title='';
            if(kind==='bubble')this.drawBuffIcon(g,offer.key,0,0,34,accent);
            if(kind==='special'){A.icon(g,'box',0,-6,38,accent);title='封印尸匣';}
            if(kind==='gift'){
                const item=this.model.item(offer.itemId),portrait=this.graphics('Aid portrait',node);
                portrait.node.setPosition(-10,0);portrait.node.scale=.72;
                if(!item||!V.worker(portrait,item.kind,this.model.state.map,false,false,0,true))A.icon(portrait,'gift',0,0,23,accent);
                this.label('×3',26,25,26,P.white,44,node,'center');
                title=item?item.name+'援助':'尸工援助';
            }
            let timer=null;
            if(kind!=='bubble'){
                A.circle(g,43,-37,20,P.ink,P.edge,2);
                A.icon(g,'video',43,-37,15,P.white);
                A.rect(g,-104,42,208,36,12,P.panel,P.edge,2);
                this.label(title,0,60,25,P.text,198,node,'center');
                A.rect(g,-47,77,94,30,10,P.panel,P.edge,2);
                timer=this.label('',0,92,27,accent,92,node,'center');
            }
            return {id:offer.id,node,timer,x,y,started:this.clock,opening:false};
        },
        refreshFieldOffers(){
            const rewards=Rewards.state(this.model),supported=this.adSupported();
            for(const [kind,button] of Object.entries(this.fieldOfferButtons)){
                const offer=kind==='bubble'||(supported&&rewards[kind]&&rewards[kind].map===this.model.state.map)?rewards[kind]:null;
                let view=this.fieldOffers[kind];
                if(view&&(!offer||view.id!==offer.id)){
                    if(this.pending&&this.pending.button===button)this.pending=null;
                    view.node.destroy();delete this.fieldOffers[kind];view=null;
                }
                if(!offer){button.w=0;button.h=0;continue;}
                if(!view)view=this.fieldOffers[kind]=this.drawFieldOffer(kind,offer);
                if(view.opening)continue;
                const hidden=kind==='bubble'&&this.modalKind==='bubble';
                view.node.active=!hidden;
                if(hidden){button.w=0;button.h=0;continue;}
                const age=Math.max(0,this.clock-view.started),appear=clamp(age/.26,0,1);
                const y=view.y+Math.sin(age*4)*7-(kind==='gift'?Math.pow(1-appear,2)*110:0);
                view.node.scale=.75+appear*.25;view.node.opacity=255;
                view.node.setPosition(view.x,-y);
                if(view.timer){
                    const seconds=Math.ceil(offer.time)+' 秒';
                    if(seconds!==view.timer.string)view.timer.string=seconds;
                }
                if(kind==='bubble'){
                    button.x=view.x-60;button.y=y-60;button.w=120;button.h=120;
                }else{
                    button.x=view.x-104;button.y=y-57;button.w=208;button.h=165;
                }
            }
        },
        openFieldOffer(kind){
            const offer=Rewards.state(this.model)[kind],view=this.fieldOffers[kind];
            if(!offer||!view||view.id!==offer.id||view.opening)return;
            if(kind!=='bubble'){this.runRewardVideo(kind,offer.id);return;}
            view.opening=true;
            this.fieldOfferButtons.bubble.w=0;this.fieldOfferButtons.bubble.h=0;
            cc.tween(view.node).to(.08,{scale:1.15}).to(.12,{scale:.25,opacity:0}).call(()=>{
                if(this.fieldOffers.bubble!==view)return;
                view.opening=false;
                if(!this.modalLayer&&!this.hiddenAt&&!this.adBusy)this.showBubble();
            }).start();
        },
        restoreRewardPanels(){
            const rewards=Rewards.state(this.model),p=rewards.pending;
            if(p&&p.phase==='completed'){this.adCompletion=p.id;this.finishVideoReward();return;}
            if(p){const cleared=this.commitProgress(()=>Rewards.cancel(this.model,p.id));if(!cleared.ok){this.showAdCancelRetry();return;}}
            if(rewards.sale)this.showBoxResult();
            else if(this.model.state.pendingChapter)this.showResult();
            else if(rewards.startup&&this.adSupported())this.showStartup();
            else if(this.model.state.offlineReward>0)this.showOffline();
        },
        runRewardVideo(kind,target,back){
            if(this.adBusy)return;if(!this.adSupported())return this.toast('当前环境暂不支持激励视频');
            if(Rewards.state(this.model).pending){this.restoreRewardPanels();return;}
            const begun=this.commitProgress(()=>Rewards.begin(this.model,kind,target));if(!begun.ok){if(back)back();this.toast(begun.reason);return;}
            this.adBusy=true;this.adReturn=back;this.hiddenAt=0;this.cancelShopGesture();this.releaseWhip();
            try{if(this.audio&&this.audio.suspend)Promise.resolve(this.audio.suspend()).catch(()=>{});}catch(e){}
            const fromField=kind==='gift'||kind==='special';
            if(fromField){
                if(!this.ads.snapshot().ready)this.toast('正在加载广告…');
            }else{
                const box=this.modal('正在加载广告','看完广告后领取本次奖励',430);
                this.adWaitingLabel=this.label('请稍候',540,box.y+250,29,P.text,800,box.n,'center');
            }
            this.ads.watch(begun.id,kind+(kind==='buff'?':'+target:'')).then(result=>{
                if(!cc.isValid(this.node))return;this.adBusy=false;this.hiddenAt=0;
                if(fromField){this.toastLife=0;this.toastLayer.removeAllChildren();}
                try{if(this.soundEnabled&&this.audio&&this.audio.resume)Promise.resolve(this.audio.resume()).catch(()=>{});}catch(e){}
                if(result.completed){this.adCompletion=begun.id;this.finishVideoReward();}
                else{const cancelled=this.commitProgress(()=>Rewards.cancel(this.model,begun.id));if(!cancelled.ok){this.showAdCancelRetry();return;}this.closeModal();if(back)back();this.toast(result.reason||'本次未领取奖励');this.ads.prepare();}
            });
        },
        finishVideoReward(){
            const p=Rewards.state(this.model).pending;if(!p){this.adCompletion=null;return;}
            const id=this.adCompletion||p.id;
            const marked=this.commitProgress(()=>Rewards.complete(this.model,id));
            if(!marked.ok){this.ads.rewardState(id,'completion-save-pending');this.showVideoRetry();return;}
            const previous=new Set(this.shopItems(0).concat(this.shopItems(1)));
            const result=this.commitProgress(()=>Rewards.fulfil(this.model));
            if(!result.ok){this.ads.rewardState(id,'reward-save-pending');this.showVideoRetry();return;}this.ads.rewardState(id,'saved');
            this.adCompletion=null;this.adReturn=null;this.closeModal();
            for(const item of this.shopItems(0).concat(this.shopItems(1)))if(!previous.has(item))this.shopUnlocks.set(item,SHOP_UNLOCK_TIME);
            const done=()=>{this.handleEvents();this.drawShop();this.refreshHUD();this.updateVisuals(0);this.restoreRewardPanels();if(!this.modalLayer)this.toast('奖励已领取');};
            if(!V.has(V.required(this.model)))this.loadChapterArt(this.model.state.map,done);else done();this.ads.prepare();
        },
        showVideoRetry(){
            const b=this.modal('奖励待领取','视频已完成，无需再次观看',520);this.modalKind='adRetry';this.label('请检查存储空间，再重试领取本次奖励',540,b.y+235,28,P.text,810,b.n,'center');this.modalButton('重试领取',120,b.y+363,840,80,()=>this.finishVideoReward(),true);
        },
        showAdCancelRetry(){
            const b=this.modal('正在恢复奖励入口','本次未完成领取，不会扣除资源',520);this.modalKind='adCancel';this.modalButton('重试恢复',120,b.y+325,840,80,()=>{const p=Rewards.state(this.model).pending,r=this.commitProgress(()=>Rewards.cancel(this.model,p&&p.id));if(!r.ok)return this.showAdCancelRetry();this.closeModal();if(this.adReturn)this.adReturn();},true);
        },
        onModalClose(){
            if(this.adBusy)return;if(['adRetry','adCancel'].includes(this.modalKind))return this.toast('请先重试完成本次奖励处理');
            if(this.modalKind==='startup')return this.dismissStartup();
            if(this.modalKind==='bubble')return this.dismissBubble();
            this.closeModal();
        },
        showStartup(){
            const b=this.modal('新工头上岗补贴','每个存档限领一次，看完广告可选一份',620);
            this.modalKind='startup';
            this.videoButton('招募 3 名普通腐尸',b.y+195,'startup','workers',()=>this.showStartup());
            this.videoButton('领取 500 尸币',b.y+300,'startup','coins',()=>this.showStartup());
            this.label('关闭此窗口后，这份补贴将无法再领',540,b.y+407,23,P.muted,820,b.n,'center');
            this.modalButton('放弃补贴，继续开工',120,b.y+450,840,72,()=>this.dismissStartup(),false);
        },
        dismissStartup(){const r=this.commitProgress(()=>{Rewards.state(this.model).startup=false;return {ok:true};});if(r.ok){this.closeModal();this.restoreRewardPanels();}else{this.showStartup();this.toast(r.reason);}},
        showBubble(){
            const offer=Rewards.state(this.model).bubble;if(!offer)return;
            const title=BUFF_STATUS_NAMES[offer.key];
            const effect=offer.key==='circle'?'临时扩大鞭圈':'当前尸工数量临时翻倍';
            const video=this.adSupported(),b=this.modal('漂浮补给 · '+title,effect+'，增益时间可累加',video?510:406);
            this.modalKind='bubble';
            const firstY=b.y+174,freeY=firstY+(video?104:0);
            if(video)this.videoButton('领取 180 秒',firstY,'bubble',offer.id,()=>this.showBubble());
            this.modalButton('免费领取 60 秒',120,freeY,840,80,()=>{
                const r=this.commitProgress(()=>Rewards.freeBubble(this.model));
                if(r.ok){this.closeModal();this.toast(title+' +60 秒');}else{this.showBubble();this.toast(r.reason);}
            },!video);
            this.modalButton('放弃本次补给',120,freeY+104,840,70,()=>this.dismissBubble(),false);
        },
        dismissBubble(){
            const r=this.commitProgress(()=>{Rewards.state(this.model).bubble=null;return {ok:true};});
            if(r.ok)this.closeModal();else{this.showBubble();this.toast(r.reason);}
        },
        refreshRevisitEntry(){
            if(!this.revisit||!this.rootNode)return;
            const side=this.revisit.status(this.model,'sidebar'),desk=this.revisit.status(this.model,'desktop');
            const visible=!this.model.sandbox&&(side.supported||desk.supported);
            if(!this.revisitEntry&&visible){
                this.revisitEntry=new cc.Node('Daily benefits');this.rootNode.addChild(this.revisitEntry);
                this.revisitIcon=this.graphics('Benefits icon',this.revisitEntry);
                this.revisitText=this.label('福利',TOP_REVISIT_X+41,160,17,P.muted,88,this.revisitEntry,'center');
            }
            this.buttons=this.buttons.filter(b=>!b.revisit);
            if(!this.revisitEntry)return;this.revisitEntry.active=visible;if(!visible)return;
            const ready=side.eligible||desk.eligible,finished=(!side.supported||side.received)&&(!desk.supported||desk.received),accent=A.themes[this.model.state.map].accent,g=this.revisitIcon;
            g.clear();A.rect(g,TOP_REVISIT_X,70,82,70,20,P.panel,ready?accent:P.edge,2);A.icon(g,'gift',TOP_REVISIT_X+41,105,19,finished?P.muted:accent);
            if(ready)A.circle(g,TOP_REVISIT_X+71,77,7,P.gold);
            this.revisitText.string=ready?'可领取':finished?'已领取':'福利';this.revisitText.node.color=A.color(ready?accent:P.muted);
            this.button(TOP_REVISIT_X,70,82,110,()=>this.showRevisit(),{revisit:true});
        },
        showRevisit(){
            if(!this.revisit||this.model.sandbox)return;
            const rows=['sidebar','desktop'].filter(kind=>this.revisit.status(this.model,kind).supported);
            if(!rows.length){this.closeModal();return;}
            const b=this.modal('每日福利','从指定入口回来，领取尸工三轮作业的尸币',rows.length===2?850:560);this.modalKind='revisit';
            this.revisitDay=this.revisit.snapshot().day;
            rows.forEach((kind,i)=>{
                const s=this.revisit.status(this.model,kind),y=b.y+170+i*282;
                A.rect(b.g,113,y,854,255,22,P.bg,P.edge,2);
                A.icon(b.g,kind==='sidebar'?'whip':'bone',157,y+42,18,A.themes[this.model.state.map].accent);
                this.label(kind==='sidebar'?'侧边栏复访礼':'桌面开工礼',196,y+42,34,P.text,700,b.n);
                this.label('+'+fmt(s.reward)+' 尸币 · 每日一次',143,y+94,30,P.gold,770,b.n);
                this.label(s.received?'今日已领取，明天从此入口回来再领':s.clockBlocked?'请校准设备日期后再试':s.eligible?'已从指定入口返回，可以领取':kind==='sidebar'?'从 B 站首页侧边栏打开本游戏':'从手机桌面图标打开本游戏',143,y+137,28,P.muted,770,b.n);
                const text=s.pending?'正在处理…':s.received?'今日已领取':s.eligible?'领取奖励':kind==='sidebar'?'去首页侧边栏':s.added?'查看桌面进入指引':'添加到桌面';
                this.modalButton(text,143,y+175,794,60,()=>{
                    if(s.received)return this.toast('今日已领取，明天再来');
                    if(s.eligible)return this.claimRevisit(kind);
                    if(kind==='desktop'&&s.added)return this.showDesktopGuide();
                    this.requestRevisit(kind);
                },s.eligible,32);
            });
            this.modalButton('返回经营',120,b.y+(rows.length===2?748:468),840,62,()=>this.closeModal(),false);
        },
        showDesktopGuide(){
            this.toastLife=0;this.toastLayer.removeAllChildren();
            const b=this.modal('从桌面回来开工','添加成功后，还需要从桌面图标打开游戏',630);
            ['1. 关闭当前小游戏，返回手机桌面。','2. 点击本游戏的桌面图标进入。','3. 打开「福利」，领取今日桌面开工礼。','找不到图标？检查桌面权限后可重新添加。'].forEach((text,i)=>this.label(text,120,b.y+192+i*65,26,P.text,840,b.n));
            this.modalButton('重新添加到桌面',120,b.y+468,402,68,()=>this.requestRevisit('desktop'),false);
            this.modalButton('返回福利',558,b.y+468,402,68,()=>this.showRevisit(),true);
        },
        requestRevisit(kind){
            if(kind==='sidebar')this.closeModal();
            const callback=result=>{
                if(!cc.isValid(this.node))return;
                if(!result.ok){this.toast(result.reason);return;}
                if(kind==='desktop'){
                    const record=Revisit.ledger(this.model);record.desktopAdded=true;this.model.state.revisitRewards=record;this.save();
                    if(!this.hiddenAt&&!this.artLoading&&!this.chapterView)this.showDesktopGuide();
                }
            };
            if(kind==='sidebar')this.revisit.navigateSidebar(callback);else this.revisit.addDesktop(callback);
        },
        claimRevisit(kind){
            const result=Revisit.claim(this.model,kind,this.revisit,()=>this.save());
            if(!result.ok)return this.toast(result.reason);
            this.walletPulse=1;this.refreshHUD();this.refreshCards();this.showRevisit();this.toast('已领取 '+fmt(result.reward)+' 尸币');this.sound('buy');
        },
        showDemoMenu(){
            if(!Runtime.config.debug)return;
            const b=this.modal('Demo 展示台','展示模式独立运行，不影响原值成长存档',960);
            for(let i=0;i<3;i++)this.modalButton('进入展示 · 0'+(i+1)+' '+Logic.CHAPTERS[i].name,120,b.y+174+i*118,840,92,()=>this.enterShowcase(i),false);
            this.modalButton('观看 · 墓园入厂转场',120,b.y+535,840,78,()=>this.previewFactoryTransition(),false);
            this.modalButton('观看 · 尸厂裂隙转场',120,b.y+629,840,78,()=>this.previewInfernalTransition(),false);
            this.modalButton(this.model.sandbox?'返回我的正常进度':'继续正常游玩',120,b.y+740,840,78,()=>this.model.sandbox?this.returnToGame():this.closeModal(),true);
            this.label('正常开局：1只腐尸 / 0尸币 · 三章展示可直接体验',540,b.y+887,21,P.muted,820,b.n,'center');
        },
        enterShowcase(map){
            if(!Runtime.config.debug)return;
            this.cancelChapterAnimation();
            if(!this.model.sandbox){this.save();this.normalSnapshot=this.model.export();}
            this.closeModal();this.model=Logic.GameModel.showcase(clamp(map,0,2));this.tab=0;
            if(map===2){
                // All four infernal forms are visible only in the isolated art showcase.
                this.model.pets=['ji','zhu'].flatMap((type,row)=>[1,2].map((form,i)=>this.model.makePet(type,form,true,380+i*290,1010+row*100)));
                this.model.fitWalkArea();
            }
            const first=map===1?'moon_staff':map===2?'sun_openbox':'spoon';this.shopOffsets=[Math.max(0,Math.floor(this.shopItems().findIndex(x=>x.id===first)/2)*SHOP_ROW_HEIGHT),0];this.loadChapterArt(map,()=>this.toast(map===1?'伙伴从左到右：载具 / 作业盔 / 基础':'分幕展示 · 可购买、催工、释放技能'));
        },
        returnToGame(){
            this.cancelChapterAnimation();this.closeModal();if(this.model.sandbox){const data=this.normalSnapshot;if(data)data.lastSeen=Date.now();this.model=new Logic.GameModel(data);this.normalSnapshot=null;}this.tab=0;this.shopOffsets=[0,0];this.loadChapterArt(this.model.state.map,()=>this.toast('已返回正常进度'));
        },
        showChapterInfo(index){
            const c=Logic.CHAPTERS[index],b=this.modal(c.name,'三阶段共享拖鞭催工玩法，主要变化在题材与表现',590);
            const texts=[['皮鞭 · 旧墓 · 滑稽腐尸','骨质结块 → 骨晶','招募、自动化与镀金改造'],['电鞭 · 培养罐 · 机械改造尸','带电废核 → 电核','原两种主动技能与机械进化'],['燃烧链鞭 · 幽绿熔岩 · 岩甲尸工','封魂结晶 → 魂晶','尸匣、十二遗物与终局成长']][index];
            texts.forEach((text,i)=>this.label(text,120,b.y+201+i*62,28,i===0?A.themes[index].accent:P.text,820,b.n));
            this.label('本幕目标 · '+fmt(c.goal)+' 尸币',120,b.y+406,26,P.gold,820,b.n);
            this.modalButton('继续经营本幕',120,b.y+476,840,73,()=>this.closeModal(),true);
        },
        showResult(afterDeparture){
            if(this.model.state.map<2&&!afterDeparture&&!this.chapterView){this.startFactoryDeparture();return;}
            const map=this.model.state.map;
            const title=['墓园交班 · 全员转岗','尸厂交班 · 裂隙已开启','冥界已封存'][map];
            const b=this.modal(title,map===2?'账簿可以封存，生意还可以做':'本幕招募和升级补齐后，队伍集体转岗',620);
            this.label('工头账簿 · 累计开工 '+fmt(this.model.state.hits)+' 次',540,b.y+215,36,P.gold,820,b.n,'center');
            this.label(map===2?'三幕已结算，可留在冥界继续经营':'下一站 · '+Logic.CHAPTERS[map+1].name,540,b.y+285,30,P.text,820,b.n,'center');
            this.transitionLabel=this.label('3秒后继续',540,b.y+357,24,P.muted,820,b.n,'center');
            this.modalButton(map===2?'继续经营冥界':map===0?'继续 · 墓园入厂':'继续 · 裂隙入冥界',120,b.y+453,840,85,()=>this.continueChapter(),true);this.transitionLeft=3;
            this.modalButtons[0].fn=()=>this.continueChapter();
        },
        showArtLoading(state,error){
            if(!this.artPage){
                const startup=this.startupLoading;
                const page=this.artPage=new cc.Node('Art loading page');this.node.addChild(page);page.zIndex=2000;
                page.launch=!!startup;
                const g=this.graphics('Loading backdrop',page);
                A.rect(g,-1800,-5000,4680,14000,0,startup?LAUNCH_COLORS.background:P.bg);
                if(startup){
                    this.drawLaunchNotice(page,g);
                    startup.drawn=false;
                    startup.visibleSeconds=0;
                    cc.director.once(cc.Director.EVENT_AFTER_DRAW,()=>{
                        if(this.artPage===page&&this.startupLoading===startup)startup.drawn=true;
                    });
                }else{
                    A.circle(g,540,615,112,'#1b332f');A.ring(g,540,615,99,P.green,3);A.icon(g,'whip',540,615,43,P.green);
                    this.label(gameTitle,540,810,63,P.text,940,page,'center');
                    this.label('尸工整队中，稍候就开工',540,877,27,P.muted,800,page,'center');
                    this.label('美术准备完成后，自动进入游戏',540,1535,23,P.muted,820,page,'center');
                }
                page.track=this.graphics('Loading progress',page);
                page.progressBar=startup?{x:40,y:1495,w:1000,h:15}:{x:170,y:1091,w:740,h:18};
                page.status=startup?this.label('',40,1564,36,LAUNCH_COLORS.muted,810,page):this.label('',540,1015,33,P.text,850,page,'center');
                page.percent=startup?this.label('',1040,1564,36,LAUNCH_COLORS.green,147,page,'right'):this.label('',540,1164,29,P.green,850,page,'center');
                page.hint=this.label('',540,startup?1625:1250,29,startup?LAUNCH_COLORS.muted:P.muted,950,page,'center');
                page.action=this.graphics('Loading retry',page);
                page.retryButton={x:330,y:startup?1674:1330,w:420,h:94,fn:()=>this.retryArt()};
                page.retryLabel=this.label('重新加载',540,page.retryButton.y+47,32,startup?'#ffffff':P.ink,400,page,'center');
                this.placeUI(page,true);
            }
            const page=this.artPage,ratio=Math.max(0,Math.min(1,state.progress||0));
            if(error)page.status.string='画面暂未准备完成';
            else if(state.retrying)page.status.string='网络较慢，正在重新加载';
            else if(page.launch)page.status.string=ratio>=1?'资源已就绪，即将进入':'正在加载资源';
            else page.status.string='正在准备'+this.model.chapter.short+'美术';
            if(page.launch)page.status.string+=' · '+state.loaded+'/'+state.total;
            page.track.clear();
            const {x,y,w,h}=page.progressBar;
            A.rect(page.track,x,y,w,h,h/2,page.launch?LAUNCH_COLORS.track:P.edge);
            if(ratio>0)A.rect(page.track,x,y,w*ratio,h,h/2,page.launch?LAUNCH_COLORS.green:P.green);
            const percent=Math.floor(ratio*100)+'%';
            page.percent.string=page.launch?percent:'已准备 '+state.loaded+' / '+state.total+' 项  ·  '+percent;
            page.hint.string=error?'请检查网络后重试，已加载的内容会保留':state.retrying?'正在重试 '+state.attempt+' / '+state.maxAttempts:page.launch?'':'首次进入可能需要一点时间';
            page.action.clear();
            page.retryLabel.node.active=!!error;
            this.artButtons=[];
            if(error){
                const b=page.retryButton;
                A.rect(page.action,b.x,b.y,b.w,b.h,22,page.launch?LAUNCH_COLORS.green:P.green);
                this.artButtons.push(b);
            }
        },
        drawLaunchNotice(page,backdrop){
            const notice=Runtime.config.launchNotice,c=LAUNCH_COLORS;
            const age=page.launchAge=new cc.Node('CADPA 8+ age label');page.addChild(age);
            const badge=age.addComponent(cc.Sprite);badge.sizeMode=cc.Sprite.SizeMode.CUSTOM;
            const useBadge=texture=>{badge.spriteFrame=new cc.SpriteFrame(texture);};
            if(this.launchAgeTexture)useBadge(this.launchAgeTexture);
            else this.loadLaunchTexture(page,'cadpa-age-8',useBadge);
            const title=page.launchTitle=this.label(gameTitle,540,260,78,c.green,985,page,'center');
            this.loadLaunchTexture(page,'loading-logo',texture=>{
                const node=page.launchLogo=new cc.Node('Loading game logo');page.addChild(node);
                const sprite=node.addComponent(cc.Sprite);sprite.sizeMode=cc.Sprite.SizeMode.CUSTOM;
                sprite.spriteFrame=new cc.SpriteFrame(texture);
                title.node.active=false;
                this.layoutLaunchHeader(page);
            });

            A.rect(backdrop,32,342,1016,770,52,c.paper,c.edge,3);
            this.label('健康游戏忠告',540,454,40,c.muted,890,page,'center');
            notice.healthyPlay.forEach((line,index)=>{
                this.label(line,540,591+index*109,46,c.ink,950,page,'center');
            });
            A.line(backdrop,[[485,1023],[595,1023]],'#d2cbb8',3);

            const footer=page.launchFooter=new cc.Node('Copyright footer');page.addChild(footer);
            this.label('著作权人：'+notice.copyrightHolder,540,1828,36,c.muted,980,footer,'center');
            this.label('软著登记号：'+notice.registrationNumber,540,1878,36,c.muted,980,footer,'center');
            this.loadLaunchWorker(page);
        },
        layoutLaunchHeader(page){
            const width=Math.max(130,111/this.layout.scale),height=width*1058/818;
            page.launchAge.setContentSize(width,height);
            page.launchAge.setPosition(40+width/2,-8-height/2);

            const top=8+height+6,bottom=337,y=-(top+bottom)/2;
            page.launchTitle.node.y=y;
            if(page.launchLogo){
                const size=page.launchLogo.getComponent(cc.Sprite).spriteFrame.getOriginalSize();
                const ratio=size.width/size.height,logoWidth=Math.min(994,(bottom-top)*ratio);
                page.launchLogo.setContentSize(logoWidth,logoWidth/ratio);
                page.launchLogo.setPosition(540,y);
            }
        },
        loadLaunchWorker(page){
            this.loadLaunchTexture(page,'loading-worker',texture=>{
                const shadow=this.graphics('Loading worker shadow',page);
                A.ellipse(shadow,540,1427,80,10,'#dddac9');
                const node=new cc.Node('Loading worker');page.addChild(node);node.setPosition(540,-1298);
                const sprite=page.worker=node.addComponent(cc.Sprite);sprite.sizeMode=cc.Sprite.SizeMode.CUSTOM;
                const tile=texture.width/4;
                page.workerFrames=Array.from({length:16},(_,i)=>new cc.SpriteFrame(texture,cc.rect(i%4*tile,Math.floor(i/4)*tile,tile,tile)));
                sprite.spriteFrame=page.workerFrames[0];node.setContentSize(330,330);
            });
        },
        loadLaunchTexture(page,name,done){
            const ready=(error,texture)=>{
                if(!error&&this.artPage===page)done(texture);
            };
            if(root.WZ_WEB_DEMO)cc.assetManager.loadRemote(new URL('assets/resources/'+name+'.png',location.href).href,{ext:'.png'},ready);
            else cc.resources.load(name,cc.Texture2D,ready);
        },
        loadChapterArt(map,done){
            if(this.artLoadTask)this.artLoadTask.cancel();
            const current=this.model,request=++this.artRequest,names=V.required(current);
            const startup=this.startupLoading;
            if(startup)startup.complete=null;
            if(map!==current.state.map&&map===1)names.push('transition');
            this.artLoading=true;this.pending=null;this.releaseWhip();if(this.rootNode)this.rootNode.active=false;
            this.retryArt=()=>this.loadChapterArt(map,done);
            this.showArtLoading({loaded:names.filter(name=>V.resource(name)).length,total:names.length,progress:0});
            const currentRequest=()=>cc.isValid(this.node)&&this.model===current&&this.artRequest===request;
            const finish=()=>{
                if(!currentRequest())return;
                this.startupLoading=null;
                this.artLoading=false;this.artButtons=[];this.artPage.destroy();this.artPage=null;
                if(this.rootNode)this.rootNode.active=true;
                if(!this.modalLayer&&!this.chapterView)this.build();if(done)done(null);this.queueLaunchReport();
            };
            this.artLoadTask=V.preload((err,state)=>{
                if(!currentRequest())return;
                if(err){this.showArtLoading(state,err);return;}
                if(startup)startup.complete=finish;
                else finish();
            },map,{names,progress:state=>{if(currentRequest())this.showArtLoading(state);}});
        },
        cancelChapterAnimation(){this.artRequest++;if(this.artLoadTask)this.artLoadTask.cancel();if(this.artPage){this.artPage.destroy();this.artPage=null;}this.artLoading=false;if(this.rootNode)this.rootNode.active=true;if(this.chapterView){this.chapterView.destroy();this.chapterView=null;}this.chapterAdvancing=false;},
        chapterActors(){return Object.values(this.unitNodes).concat(Object.values(this.petNodes)).map(r=>({node:r.g.node}));},
        startFactoryDeparture(){
            if(this.chapterView||this.artLoading)return;this.releaseWhip();this.save();
            const map=this.model.state.map;
            this.loadChapterArt(map+1,err=>{
                if(err){this.showResult(true);return;}const art=map===0?V.resource('transition'):{theme:'rift'};
                this.model.units.forEach(u=>{const r=this.unitNodes[u.id];if(r)V.animate(r.g,u.kind,map,false,{phase:'finish',progress:.96,pose:5},this.clock,1,0);});
                this.whip.node.active=false;const view=ChapterMovie.create(this.rootNode,Object.assign({width:1080,height:this.layout.contentHeight},art));this.chapterView=view;view.phase='depart';
                view.depart(this.chapterActors(),()=>{if(this.chapterView!==view)return;view.phase='result';this.showResult(true);});
            });
        },
        continueChapter(){
            if(this.chapterAdvancing||!this.model.state.pendingChapter)return;this.chapterAdvancing=true;
            const sourceMap=this.model.state.map,factory=sourceMap===0,travelling=sourceMap<2;
            const result=this.commitProgress(()=>{this.model.advance();return {ok:true};});
            if(!result.ok){this.chapterAdvancing=false;this.showResult(true);this.transitionLeft=0;this.transitionLabel.string='点击继续重试';this.toast(result.reason);return;}
            this.transitionLeft=0;this.closeModal();if(this.chapterView){this.chapterView.destroy();this.chapterView=null;}
            this.tab=0;this.shopOffsets=[0,0];
            this.loadChapterArt(this.model.state.map,err=>{if(!travelling||err){this.chapterAdvancing=false;return;}
                this.whip.node.active=false;const view=ChapterMovie.create(this.rootNode,Object.assign({width:1080,height:this.layout.contentHeight},factory?V.resource('transition'):{theme:'rift'}));this.chapterView=view;view.phase='arrive';
                view.arrive(this.chapterActors(),()=>{if(this.chapterView!==view)return;view.destroy();this.chapterView=null;this.chapterAdvancing=false;this.whip.node.active=true;this.releaseWhip();this.toast(factory?'尸厂开张 · 到「赋能与改造」解锁伙伴装备':'冥界到岗 · 可在「招募与经营」开启尸匣');});
            });
        },
        previewFactoryTransition(){if(!Runtime.config.debug)return;this.enterShowcase(0);this.model.state.pendingChapter=true;this.loadChapterArt(1,()=>this.startFactoryDeparture());},
        previewInfernalTransition(){if(!Runtime.config.debug)return;this.enterShowcase(1);this.model.state.pendingChapter=true;this.loadChapterArt(2,()=>this.startFactoryDeparture());},
        openBoxes(){
            if(!this.model.buyCount('sun_openbox'))return this.toast('先在商店开启尸匣功能');
            const r=this.commitProgress(()=>this.model.openBoxes());if(!r.ok)return this.toast(r.reason);
            this.showBoxResult();this.sound('buy');
        },
        showBoxResult(){
            const r=Rewards.state(this.model).sale;if(!r)return;
            const video=this.adSupported()&&r.total>0,h=610+Math.ceil(r.items.length/2)*72;
            const subtitle=video?'请选择出售方式':r.total>0?'确认后按普通价格出售':'遗物已收入收藏';
            const b=this.modal('尸匣清点 ×'+r.count,subtitle,h,{closeButton:false});this.modalKind='sale';
            r.items.forEach((item,i)=>{const x=123+(i%2)*425,y=b.y+183+Math.floor(i/2)*72;this.label(item.collect?'遗物 · '+item.name:item.name,x,y,25,item.collect?P.gold:item.quality==='gold'?P.gold:item.quality==='purple'?P.blue:P.text,395,b.n);});
            this.label('本批估值 '+fmt(r.total)+' 尸币',540,b.y+h-320,32,P.gold,820,b.n,'center');
            if(video)this.videoButton('10 倍出售 · '+fmt(r.total*10)+' 尸币',b.y+h-250,'sale',r.id,()=>this.showBoxResult());
            this.modalButton(r.total?'普通出售 · '+fmt(r.total)+' 尸币':'继续开工',120,b.y+h-128,840,75,()=>this.sellBoxResult(),!video);
        },
        sellBoxResult(){
            const r=this.commitProgress(()=>this.model.sellBoxes(1));if(!r.ok){this.showBoxResult();this.toast(r.reason);return;}this.closeModal();this.refreshHUD();this.toast('本批已结算');
        },
        showCollections(){
            const b=this.modal('冥界遗物柜','已收集 '+this.model.state.collects.length+' / 12 · 唯一收藏，永久属性',1000);
            Data.collects.forEach((c,i)=>{const owned=this.model.state.collects.includes(c.id),x=122+(i%2)*426,y=b.y+185+Math.floor(i/2)*105;A.rect(b.g,x-8,y-19,402,85,16,P.bg,owned?P.gold:P.edge,2);this.label(c.name,x+16,y+4,25,owned?P.gold:P.muted,362,b.n);this.label(owned?'已拥有 · 属性生效':this.adSupported()?'未获得 · 点击查看寻回':'未获得 · 在尸匣中寻找',x+16,y+40,19,P.muted,362,b.n);if(!owned&&this.adSupported())this.modalButtons.push({x:x-8,y:y-19,w:402,h:85,fn:()=>this.showCollectReward(c)});});
            this.label('开启尸匣有机会发现遗物，收集后永久生效',540,b.y+853,22,P.muted,830,b.n,'center');this.modalButton('返回场地',120,b.y+906,840,65,()=>this.closeModal(),true);
        },
        showCollectReward(c){
            const effects={collectMeteorIncome:'稀有原料价值',collectDirtIncome:'尸工作业收益',collectPetSpeedJi:'监工移动速度',collectPetSpeedZhu:'灵柩移动速度',collectPetSpeedAll:'所有伙伴移动速度',collectBoxDrop:'尸匣掉落概率',collectFlipSpeed:'尸工位移动作速度',collectSkillChargeMax:'技能储存上限',collectSkillReplay:'技能不消耗次数概率',collectSkillIncome:'技能触发收益'};
            const percent=Math.round(c.add*10000)/100;
            const value=c.effect==='collectSkillChargeMax'?'+'+c.add+'次':'+'+percent+(['collectBoxDrop','collectSkillReplay'].includes(c.effect)?'个百分点':'%');
            const description=c.effect==='collectSmash'?'缩短基础碎炼耗时的 '+percent+'%':(effects[c.effect]||'永久属性')+' '+value;
            const b=this.modal('遗物寻回','只获得当前指定的缺失遗物',590);this.label(c.name,540,b.y+205,38,P.gold,820,b.n,'center');this.label(description,540,b.y+275,27,P.text,820,b.n,'center');this.videoButton('寻回 '+c.name,b.y+385,'collect',c.id,()=>this.showCollections());
        },
        showOffline(){
            const reward=this.model.state.offlineReward;if(!reward)return;
            const minutes=Math.floor(this.model.state.offlineSeconds/60),hours=Math.floor(minutes/60);
            const time=(hours?hours+' 小时 ':'')+(minutes%60)+' 分钟';
            const video=this.adSupported(),b=this.modal('尸工代班收益','累计离线 '+time,video?660:530);
            this.label('+'+fmt(reward)+' 尸币',540,b.y+242,49,P.gold,820,b.n,'center');
            if(video)this.videoButton('3 倍领取 · '+fmt(reward*3)+' 尸币',b.y+365,'offline',null,()=>this.showOffline());
            this.modalButton('普通领取 · '+fmt(reward)+' 尸币',120,b.y+(video?490:386),840,80,()=>{
                const r=this.commitProgress(()=>({ok:true,reward:this.model.claimOffline()}));
                if(!r.ok){this.showOffline();this.toast(r.reason);return;}
                this.closeModal();
            },!video);
        },
        unlockAudio(){if(!this.soundEnabled)return;if(this.audio){try{if(!this.adBusy&&this.audio.state==='suspended')Promise.resolve(this.audio.resume()).catch(()=>{});}catch(e){}return;}try{const C=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);if(C)this.audio=new C();}catch(e){this.audio=null;}},
        sound(type){
            if(this.adBusy||!this.soundEnabled||!this.audio||this.clock-this.lastSound<.05)return;this.lastSound=this.clock;
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
