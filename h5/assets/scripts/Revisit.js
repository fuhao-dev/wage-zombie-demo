/* Bilibili revisit lifecycle. Also required synchronously by the native game.js entry. */
(function(root,factory){
    'use strict';
    const api=root.WZRevisit||factory();
    root.WZRevisit=api;
    api.start(root.bl||(typeof bl!=='undefined'?bl:null));
    if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
    'use strict';
    const SCENES={sidebar:'021036',desktop:'10002'},claiming=new WeakSet();
    // All clients use the same China calendar day, regardless of the device's timezone.
    function dayKey(time){return new Date(time+8*3600000).toISOString().slice(0,10);}
    function validDay(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
    function ledger(model){
        const raw=model.state.revisitRewards||{},claims=raw.claims||{};
        return {claims:{sidebar:validDay(claims.sidebar)?claims.sidebar:'',desktop:validDay(claims.desktop)?claims.desktop:''},desktopAdded:raw.desktopAdded===true};
    }
    function rewardFor(model){
        const income=model.units.filter(u=>!u.clone).reduce((sum,u)=>sum+Math.max(0,model.income(u.kind)||0),0);
        return Math.max(1,Math.floor(income*3));
    }
    function create(platform,options){
        const opts=options||{},now=opts.now||Date.now,schedule=opts.setTimeout||setTimeout,cancel=opts.clearTimeout||clearTimeout;
        const listeners=new Set(),api=platform||{};
        let scene='',entryDay='',sidebar=false,desktop=false,desktopAdded=false,pending='',probeTimer=null,operationTimer=null,probeId=0,operationId=0,disposed=false,listening=false;
        function emit(){if(!disposed)listeners.forEach(fn=>fn());}
        function supports(name){
            if(typeof api[name]!=='function')return false;
            try{return typeof api.canIUse!=='function'||api.canIUse(name)!==false;}catch(e){return false;}
        }
        function probe(){
            const id=++probeId;cancel(probeTimer);sidebar=false;
            if(!listening||!supports('checkScene')||!supports('navigateToScene'))return emit();
            let settled=false;
            const finish=value=>{if(disposed||settled||id!==probeId)return;settled=true;cancel(probeTimer);probeTimer=null;sidebar=value===true;emit();};
            probeTimer=schedule(()=>finish(false),5000);
            try{api.checkScene({scene:'sidebar',success:res=>finish(res&&res.isExist),fail:()=>finish(false)});}catch(e){finish(false);}
        }
        function onShow(res){
            scene=res&&res.scene!=null?String(res.scene):'';entryDay=dayKey(now());
            if(scene===SCENES.desktop)desktopAdded=true;
            // A real entry supersedes a jump. Returning from a desktop permission dialog
            // may emit an ordinary onShow before addShortcut's result; keep waiting for it.
            if(pending==='sidebar'||pending==='desktop'&&(scene===SCENES.desktop||scene===SCENES.sidebar)){operationId++;cancel(operationTimer);operationTimer=null;pending='';}
            emit();probe();
        }
        // Register before querying launch parameters or starting asynchronous capability checks.
        try{if(typeof api.onShow==='function'){api.onShow(onShow);listening=true;}}catch(e){}
        if(listening){
            desktop=supports('addShortcut');
            if(!entryDay){try{if(typeof api.getLaunchOptionsSync==='function'){const initial=api.getLaunchOptionsSync();scene=initial&&initial.scene!=null?String(initial.scene):'';entryDay=dayKey(now());if(scene===SCENES.desktop)desktopAdded=true;}}catch(e){}}
            probe();
        }
        function snapshot(){return {sidebar,desktop,scene,entryDay,desktopAdded,pending,day:dayKey(now())};}
        function status(model,kind){
            const s=snapshot(),record=ledger(model),claimed=record.claims[kind]||'';
            const supported=kind==='sidebar'?s.sidebar:kind==='desktop'&&s.desktop;
            const future=Object.values(record.claims).some(day=>day>s.day);
            const received=claimed===s.day,eligible=!!supported&&!model.sandbox&&!future&&!received&&s.scene===SCENES[kind]&&s.entryDay===s.day;
            return {supported:!!supported,eligible,received,clockBlocked:future,added:record.desktopAdded||s.desktopAdded,reward:rewardFor(model),pending:s.pending===kind,day:s.day};
        }
        function action(kind,done){
            const supported=kind==='sidebar'?sidebar:desktop;
            if(!supported||disposed){if(done)done({ok:false,reason:'当前客户端暂不支持此入口'});return false;}
            if(pending){if(done)done({ok:false,reason:'正在处理，请稍候'});return false;}
            pending=kind;const id=++operationId;emit();
            let settled=false;
            const finish=result=>{if(disposed||settled||id!==operationId)return;settled=true;cancel(operationTimer);operationTimer=null;pending='';if(result.ok&&kind==='desktop')desktopAdded=true;emit();if(done)done(result);};
            operationTimer=schedule(()=>finish({ok:false,reason:'暂未完成，请稍后重试'}),12000);
            const fail=err=>finish({ok:false,reason:/cancel/i.test(err&&err.errMsg||'')?'已取消，可稍后重试':kind==='sidebar'?'侧边栏暂时无法打开，请稍后重试':'添加未完成，请检查桌面权限后重试'});
            try{if(kind==='sidebar')api.navigateToScene({scene:'sidebar',success:()=>finish({ok:true}),fail});else api.addShortcut({success:()=>finish({ok:true}),fail});}catch(e){fail(e);}
            return true;
        }
        return {snapshot,status,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},navigateSidebar:done=>action('sidebar',done),addDesktop:done=>action('desktop',done),
            dispose(){disposed=true;probeId++;operationId++;cancel(probeTimer);cancel(operationTimer);listeners.clear();try{if(listening&&api.offShow)api.offShow(onShow);}catch(e){}}};
    }
    function claim(model,kind,service,persist){
        if(!SCENES[kind]||!service||claiming.has(model))return {ok:false,reason:'请稍后重试'};
        const status=service.status(model,kind);
        if(model.sandbox)return {ok:false,reason:'展示模式不领取正式奖励'};
        if(status.received)return {ok:false,reason:'今日已领取，明天再来'};
        if(status.clockBlocked)return {ok:false,reason:'设备日期有变化，请校准时间后再试'};
        if(!status.eligible)return {ok:false,reason:kind==='sidebar'?'请先从首页侧边栏进入游戏':'请先从桌面快捷方式进入游戏'};
        const oldCoins=model.state.coins,oldRecord=model.state.revisitRewards,next=ledger(model);
        next.claims[kind]=status.day;if(kind==='desktop')next.desktopAdded=true;
        claiming.add(model);model.state.coins+=status.reward;model.state.revisitRewards=next;
        try{
            if(typeof persist!=='function'||persist()!==true)throw new Error('Save failed');
            return {ok:true,reward:status.reward};
        }catch(e){
            model.state.coins=oldCoins;if(oldRecord===undefined)delete model.state.revisitRewards;else model.state.revisitRewards=oldRecord;
            return {ok:false,reason:'进度暂未保存，请检查存储空间后重试'};
        }finally{claiming.delete(model);}
    }
    let singleton=null;
    function start(platform){if(!singleton)singleton=create(platform);return singleton;}
    return {create,start,dayKey,validDay,rewardFor,ledger,claim};
});
