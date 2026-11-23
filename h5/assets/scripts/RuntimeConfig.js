/* Build-time settings. Development tools must be enabled in a separate build. */
(function(root){
 'use strict';
 const config=Object.freeze({
  mode:'release',
  version:'0.13.5',
  debug:false,
  rewardVideo:true,
  adUnitId:'bili-211794558493765698',
  gameTitle:'植物大师vs精英僵尸',
  launchNotice:{
   age:'8+',
   copyrightHolder:'司唯泽',
   registrationNumber:'2020SR1911777',
   healthyPlay:[
    '抵制不良游戏，拒绝盗版游戏。',
    '注意自我保护，谨防受骗上当。',
    '适度游戏益脑，沉迷游戏伤身。',
    '合理安排时间，享受健康生活。'
   ]
  }
 });
 if(typeof module!=='undefined')module.exports=config;root.WZRuntimeConfig=config;
})(typeof globalThis!=='undefined'?globalThis:this);
