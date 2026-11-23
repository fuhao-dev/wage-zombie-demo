/* Platform lifecycle boundary and once-per-cold-start readiness reporting. */
(function(root){
 'use strict';
 const Config=root.WZRuntimeConfig||require('./RuntimeConfig');
 const startedAt=Number.isFinite(root.__WZ_START_AT__)?root.__WZ_START_AT__:Date.now();let reported=false;
 function platform(){return root.bl||(typeof bl!=='undefined'?bl:null);}
 function metrics(){
  const api=platform(),result={native:!!api,info:{},menu:null};
  if(api){
   try{if(api.getSystemInfoSync)result.info=api.getSystemInfoSync()||{};}catch(e){}
   try{if(api.getMenuButtonBoundingClientRect)result.menu=api.getMenuButtonBoundingClientRect();}catch(e){}
  }else if(typeof document!=='undefined'&&typeof getComputedStyle==='function'){
   const style=getComputedStyle(document.documentElement),top=parseFloat(style.getPropertyValue('--wz-safe-top'))||0,bottom=parseFloat(style.getPropertyValue('--wz-safe-bottom'))||0;
   result.info={windowWidth:innerWidth,windowHeight:innerHeight,safeArea:{top,bottom:innerHeight-bottom}};
  }
  return result;
 }
 function ready(){
  if(reported)return true;reported=true;const api=platform();if(!api)return true;
  try{if(api.launchSuccess)api.launchSuccess();}catch(e){console.warn('启动成功上报失败',e.message||e);}
  try{if(api.reportScene)api.reportScene({sceneId:7,costTime:Math.max(0,Math.round(Date.now()-startedAt))});}catch(e){console.warn('启动耗时上报失败',e.message||e);}
  return true;
 }
 function expose(game){
  if(!Config.debug)return;
  root.__WZ_DEMO__={game,get model(){return game.model;},snapshot:()=>game.model.snapshot(),showcase:map=>game.enterShowcase(map),returnToGame:()=>game.returnToGame()};
 }
 const api={config:Config,metrics,ready,expose,version:()=>root.__appVersion__||Config.version};
 if(typeof module!=='undefined')module.exports=api;root.WZRuntime=api;
})(typeof globalThis!=='undefined'?globalThis:this);
