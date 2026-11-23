/* Reward rules only. The caller checkpoints each mutation through SaveStore. */
(function(root,factory){
    const api=factory(root.WZData||require('./Data'),root.WZRevisit||require('./Revisit'));if(typeof module!=='undefined')module.exports=api;root.WZAdRewards=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Data,Calendar){
    'use strict';
    const giftIds=['shovel_2','shovel_3','moon_staff','moon_rake','moon_craft_sword','moon_craft_hammer'];
    const bubbleIntervals=[3,6,12,15,18,21,24,27,30,33].map(minutes=>minutes*60);
    const bubbleKeys=['circle','doubleTool'];
    const buffNames={double:'加倍开工',circle:'鞭圈增益',doubleTool:'幻影尸工',frenzy:'暴走'};
    const fail=reason=>({ok:false,reason});
    const newBubbleDay=day=>({day,sent:0,elapsed:0});
    function init(model,saved){
        if(!model.state.adRewards){
            model.state.adRewards={format:1,seq:0,token:0,lastApplied:0,startup:!saved,giftSeen:giftIds.filter(id=>!!saved&&model.buyCount(id)>=3),gift:null,bubble:null,special:null,sale:null,pending:null};
        }
        const a=model.state.adRewards;
        if(!a.bubbleDay){
            a.bubbleDay=newBubbleDay(Calendar.dayKey(Date.now()));
            if(a.bubble&&a.bubbleSlot===undefined)a.bubble={id:a.bubble.id,key:'circle'};
            delete a.bubbleSlot;
            delete a.bubbles;
        }
        model.specialBox=a.special;
    }
    const state=model=>model.state.adRewards;
    const token=(model,prefix)=>prefix+'-'+(++state(model).token);
    function onPurchase(model,item){
        const a=state(model);if(giftIds.includes(item.id)&&model.buyCount(item.id)===3&&!a.giftSeen.includes(item.id)){
            a.giftSeen.push(item.id);a.gift={id:token(model,'gift'),itemId:item.id,time:30,map:model.state.map};model.emit('adOffer',{kind:'gift'});
        }
    }
    function step(model,dt){
        const a=state(model);for(const key of ['gift','special'])if(a[key]){a[key].time=Math.max(0,a[key].time-dt);if(a[key].time<=0)a[key]=null;}
        model.specialBox=a.special;
        const day=Calendar.dayKey(Date.now());
        if(day>a.bubbleDay.day)a.bubbleDay=newBubbleDay(day);
        const schedule=a.bubbleDay;
        const claimingBubble=a.pending&&a.pending.kind==='bubble';
        if(claimingBubble||schedule.sent>=bubbleIntervals.length)return;
        schedule.elapsed+=dt;
        if(schedule.elapsed+1e-7<bubbleIntervals[schedule.sent])return;
        a.bubble={id:token(model,'bubble'),key:bubbleKeys[schedule.sent%bubbleKeys.length]};
        schedule.sent++;
        schedule.elapsed=0;
        model.emit('adOffer',{kind:'bubble'});
    }
    function spawnSpecial(model,u){const a=state(model);a.special={id:token(model,'special'),x:u.x,y:u.y,time:30,map:model.state.map};model.specialBox=a.special;}
    function canShop(model,item){const check=model.canBuy(item);return !!(item&&item.effect!=='urgeUpdate'&&model.buyCount(item.id)>0&&check.poor&&!check.locked&&!check.full);}
    function describe(model,kind,target){
        const a=state(model);if(model.sandbox)return fail('展示模式不领取正式奖励');
        if(kind==='startup')return a.startup&&['workers','coins'].includes(target)?{ok:true,data:{choice:target}}:fail('该补贴已结束');
        if(kind==='buff'){
            if(!buffNames[target]||target==='circle'&&model.state.map!==0||target==='doubleTool'&&model.state.map===0||target==='frenzy'&&!model.pets.length)return fail('该增益尚未开放');
            return {ok:true,data:{key:target,seconds:60}};
        }
        if(kind==='bubble')return a.bubble&&a.bubble.id===target?{ok:true,data:{offerId:target,key:a.bubble.key,seconds:180}}:fail('补给已结束');
        if(kind==='shop'){const item=model.item(target);return canShop(model,item)?{ok:true,data:{itemId:target,count:model.buyCount(target)}}:fail('当前不满足视频购买条件');}
        if(kind==='gift')return a.gift&&a.gift.id===target&&a.gift.time>0?{ok:true,data:{offerId:target,itemId:a.gift.itemId}}:fail('援助机会已结束');
        if(kind==='offline')return model.state.offlineReward>0?{ok:true,data:{amount:model.state.offlineReward,seconds:model.state.offlineSeconds}}:fail('收益已领取');
        if(kind==='special')return a.special&&a.special.id===target&&a.special.time>0&&!a.sale?{ok:true,data:{offerId:target,tier:model.boxTier()}}:fail('请先处理已有开奖结果或等待新尸匣');
        if(kind==='sale')return a.sale&&a.sale.id===target&&a.sale.total>0?{ok:true,data:{batchId:target}}:fail('本批可售物已处理');
        if(kind==='collect')return model.state.map===2&&Data.collects.some(c=>c.id===target)&&!model.state.collects.includes(target)?{ok:true,data:{collectId:target}}:fail('该遗物已拥有或尚未开放');
        return fail('奖励入口暂不可用');
    }
    function begin(model,kind,target){
        const a=state(model);if(a.pending)return fail('请先处理上一笔视频奖励');const check=describe(model,kind,target);if(!check.ok)return check;
        a.pending={id:++a.seq,kind,map:model.state.map,phase:'requested',data:check.data};return {ok:true,id:a.pending.id};
    }
    function cancel(model,id){const a=state(model);if(a.pending&&a.pending.id===id&&a.pending.phase==='requested')a.pending=null;return {ok:true};}
    function complete(model,id){const p=state(model).pending;if(!p||p.id!==id)return fail('视频请求已结束');p.phase='completed';return {ok:true};}
    function fulfil(model){
        const a=state(model),p=a.pending;if(!p||p.phase!=='completed')return fail('尚无已完成的视频奖励');if(p.id<=a.lastApplied){a.pending=null;return {ok:true,duplicate:true};}
        if(p.map!==model.state.map)return fail('奖励所属幕与当前进度不符，请重进游戏');const d=p.data;let result={ok:true};
        if(p.kind==='startup'){if(!a.startup)return fail('补贴已处理');if(d.choice==='workers'){model.state.buys.spoon=model.buyCount('spoon')+3;model.syncUnits();}else model.state.coins+=500;a.startup=false;}
        else if(p.kind==='buff'){model.grantBuff(d.key,d.seconds);}
        else if(p.kind==='bubble'){
            if(!a.bubble||a.bubble.id!==d.offerId||a.bubble.key!==d.key)return fail('补给已处理');
            model.grantBuff(d.key,d.seconds);a.bubble=null;
        }
        else if(p.kind==='shop'){if(model.buyCount(d.itemId)!==d.count)return fail('商品状态已变化');result=model.buyByAd(d.itemId);}
        else if(p.kind==='gift'){if(!a.gift||a.gift.id!==d.offerId)return fail('援助已处理');model.state.gifts[d.itemId]=(model.state.gifts[d.itemId]||0)+3;a.gift=null;model.syncUnits();}
        else if(p.kind==='offline'){
            if(model.state.offlineReward<d.amount)return fail('该代班收益已处理');model.state.coins+=d.amount*3;model.state.offlineReward=Math.max(0,model.state.offlineReward-d.amount);model.state.offlineSeconds=Math.max(0,model.state.offlineSeconds-d.seconds);result.reward=d.amount*3;
        }
        else if(p.kind==='special'){if(!a.special||a.special.id!==d.offerId||a.sale)return fail('封印尸匣已处理');result=model.createBoxBatch(10,d.tier,[3,4,5,6][d.tier],'special');a.special=null;model.specialBox=null;}
        else if(p.kind==='sale'){if(!a.sale||a.sale.id!==d.batchId)return fail('本批物品已出售');result=model.sellBoxes(10);}
        else if(p.kind==='collect'){if(!model.state.collects.includes(d.collectId))model.state.collects.push(d.collectId);}
        else return fail('奖励类型无效');
        if(!result.ok)return result;a.lastApplied=p.id;a.pending=null;model.emit('adReward',{kind:p.kind});return Object.assign({ok:true,kind:p.kind},result);
    }
    function freeBubble(model){
        const a=state(model);
        if(!a.bubble)return fail('补给已结束');
        if(a.pending&&a.pending.kind==='bubble')return fail('请先处理上一笔视频奖励');
        model.grantBuff(a.bubble.key,60);a.bubble=null;return {ok:true};
    }
    function validate(a){
        const obj=v=>v&&typeof v==='object'&&!Array.isArray(v),num=v=>Number.isFinite(v)&&v>=0,int=v=>Number.isSafeInteger(v)&&v>=0,str=v=>typeof v==='string'&&v.length<=100;
        if(!obj(a)||a.format!==1||!int(a.seq)||!int(a.token)||!int(a.lastApplied)||a.lastApplied>a.seq||typeof a.startup!=='boolean'||!Array.isArray(a.giftSeen)||!a.giftSeen.every(v=>giftIds.includes(v)))return false;
        const schedule=a.bubbleDay,legacy=schedule===undefined&&a.bubbleSlot===undefined;
        if(schedule!==undefined){
            if(!obj(schedule)||!Calendar.validDay(schedule.day)||!int(schedule.sent)||schedule.sent>bubbleIntervals.length||!num(schedule.elapsed))return false;
            if(schedule.sent===bubbleIntervals.length?schedule.elapsed!==0:schedule.elapsed>=bubbleIntervals[schedule.sent])return false;
        }else if(legacy?(!Array.isArray(a.bubbles)||a.bubbles.length!==3||!a.bubbles.every(v=>typeof v==='boolean')):!int(a.bubbleSlot))return false;
        if(a.gift!==null&&(!obj(a.gift)||!str(a.gift.id)||!giftIds.includes(a.gift.itemId)||!num(a.gift.time)||!int(a.gift.map)||a.gift.map>2))return false;
        if(a.bubble!==null&&(!obj(a.bubble)||!str(a.bubble.id)||(legacy?(!int(a.bubble.index)||a.bubble.index>2):!bubbleKeys.includes(a.bubble.key))))return false;
        if(a.special!==null&&(!obj(a.special)||!str(a.special.id)||!num(a.special.time)||!Number.isFinite(a.special.x)||!Number.isFinite(a.special.y)||!int(a.special.map)||a.special.map>2))return false;
        if(a.sale!==null&&(!obj(a.sale)||!str(a.sale.id)||!num(a.sale.total)||!int(a.sale.count)||a.sale.count<1||a.sale.count>10||!int(a.sale.tier)||a.sale.tier>3||!Array.isArray(a.sale.items)||a.sale.items.length!==a.sale.count||!a.sale.items.every(i=>obj(i)&&str(i.name)&&['white','purple','gold'].includes(i.quality)&&(i.collect===true?str(i.collectId)&&Data.collects.some(c=>c.id===i.collectId):num(i.value)))||a.sale.total!==a.sale.items.reduce((n,i)=>n+(i.collect?0:i.value),0)))return false;
        const p=a.pending;if(p===null)return true;if(!obj(p)||!int(p.id)||p.id<1||p.id>a.seq||!int(p.map)||p.map>2||!['requested','completed'].includes(p.phase)||!obj(p.data))return false;
        const d=p.data;
        switch(p.kind){case 'startup':return ['workers','coins'].includes(d.choice);case 'buff':return !!buffNames[d.key]&&d.seconds===60;case 'bubble':return str(d.offerId)&&(legacy?d.key==='circle':bubbleKeys.includes(d.key))&&d.seconds===180;case 'shop':return str(d.itemId)&&Data.shops[p.map].some(x=>x.id===d.itemId)&&int(d.count)&&d.count>0;case 'gift':return str(d.offerId)&&giftIds.includes(d.itemId);case 'offline':return num(d.amount)&&d.amount>0&&num(d.seconds)&&d.seconds<=28800;case 'special':return str(d.offerId)&&int(d.tier)&&d.tier<4;case 'sale':return str(d.batchId);case 'collect':return Data.collects.some(c=>c.id===d.collectId);default:return false;}
    }
    return {init,state,onPurchase,step,spawnSpecial,canShop,describe,begin,cancel,complete,fulfil,freeBubble,validate,giftIds,buffNames,token};
});
