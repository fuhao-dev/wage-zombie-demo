/* One Bilibili rewarded-video component shared by every reward entry. */
(function(root,factory){
    const api=factory(root);if(typeof module!=='undefined')module.exports=api;root.WZRewardedAds=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
    'use strict';
    function create(platform,config,timers){
        config=config||{};timers=timers||{set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id)};
        const supported=!!(config.rewardVideo&&config.adUnitId&&platform&&typeof platform.createRewardedVideoAd==='function');
        let component=null,phase=supported?'idle':'unsupported',active=null,loading=null,disposed=false,generation=0;
        const listeners=new Set();
        const history=[];let eventOrder=0;
        const record=(type,details)=>{history.push(Object.assign({order:++eventOrder,type,at:Date.now()},details||{}));if(history.length>100)history.shift();};
        const snapshot=()=>({supported,phase,ready:phase==='ready',busy:!!active,adUnitId:config.adUnitId||''});
        const notify=()=>listeners.forEach(fn=>{try{fn(snapshot());}catch(e){}});
        function settle(result){
            if(!active)return;const request=active;record('result',{requestId:request.id,placement:request.placement,completed:result.completed,reason:result.reason||''});active=null;if(request.timer)timers.clear(request.timer);
            generation++;loading=null;phase=result.completed?'idle':'error';notify();request.resolve(Object.assign({requestId:request.id},result));
        }
        const onLoad=()=>{if(!active&&phase!=='loading'){phase='ready';notify();}};
        const onError=()=>{phase='error';notify();settle({completed:false,reason:'广告暂时无法加载，请稍后重试'});};
        const onClose=res=>{
            if(!active||!active.showCalled)return;
            // Never infer completion from a missing result on an unverified legacy client.
            settle({completed:!!(res&&res.isEnded===true),reason:res&&res.isEnded===true?'':'未完整观看，奖励未领取'});
        };
        function ensure(){
            if(component)return component;if(!supported||disposed)throw Error('unsupported');
            const candidate=platform.createRewardedVideoAd({adUnitId:config.adUnitId});
            if(!candidate||typeof candidate.load!=='function'||typeof candidate.show!=='function'||typeof candidate.onClose!=='function')throw Error('unsupported');
            component=candidate;component.onClose(onClose);if(component.onLoad)component.onLoad(onLoad);if(component.onError)component.onError(onError);return component;
        }
        function prepare(){
            if(!supported||disposed)return Promise.resolve(false);if(loading)return loading;if(phase==='ready')return Promise.resolve(true);
            if(active&&active.showCalled)return Promise.resolve(false);
            phase='loading';record('load');notify();const token=++generation;
            loading=new Promise(resolve=>{
                let done=false,timer;
                const finish=ok=>{if(done)return;done=true;if(timer)timers.clear(timer);if(token===generation){loading=null;if(!disposed){phase=ok?'ready':'error';record(ok?'loaded':'load-failed');notify();}}resolve(ok&&!disposed);};
                timer=timers.set(()=>finish(false),12000);
                Promise.resolve().then(()=>ensure().load()).then(()=>finish(true),()=>finish(false));
            });
            return loading;
        }
        function watch(requestId,placement){
            if(!supported||disposed)return Promise.resolve({completed:false,reason:'当前环境暂不支持激励视频'});
            if(active)return Promise.resolve({completed:false,reason:'已有视频正在处理，请稍候'});
            return new Promise(resolve=>{
                const request=active={id:requestId,placement:placement||'',resolve,showCalled:false};record('request',{requestId,placement:request.placement});notify();
                try{if(platform.reportScene)platform.reportScene({sceneId:1007});}catch(e){}
                prepare().then(ok=>{
                    if(active!==request||disposed)return;if(!ok){settle({completed:false,reason:'广告暂时无法加载，请稍后重试'});return;}
                    phase='showing';request.showCalled=true;record('show-requested',{requestId});notify();
                    // A playing video has no game-imposed timeout. Only close/error can settle it.
                    try{Promise.resolve(component.show()).then(()=>{if(active===request&&request.timer){timers.clear(request.timer);request.timer=null;}},()=>{if(active===request)settle({completed:false,reason:'广告暂时无法播放，请稍后重试'});});}
                    catch(e){settle({completed:false,reason:'广告暂时无法播放，请稍后重试'});}
                });
            });
        }
        return {snapshot,prepare,watch,events:()=>history.map(e=>Object.assign({},e)),rewardState:(requestId,status)=>record('reward',{requestId,status}),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},destroy(){disposed=true;generation++;settle({completed:false,reason:'播放已结束'});if(component){if(component.offClose)component.offClose(onClose);if(component.offLoad)component.offLoad(onLoad);if(component.offError)component.offError(onError);}listeners.clear();}};
    }
    let singleton=null;
    function start(config){if(!singleton)singleton=create(root.bl||null,config);return singleton;}
    return {create,start};
});
