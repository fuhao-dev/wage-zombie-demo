(function(){
    'use strict';
    window.WZ_WEB_DEMO=true;
    function fail(error){const el=document.getElementById('error');el.style.display='block';el.textContent='Demo 启动遇到问题\n\n'+(error.stack||error.message||String(error))+'\n\n请通过“启动Demo.cmd”或 npm start 启动，避免直接双击 index.html。';console.error(error);}
    window.addEventListener('error',e=>{if(!window.__WZ_DEMO__)fail(e.error||e.message);});
    try{
        cc.assetManager.init({bundleVers:{internal:'ff428'},remoteBundles:[],server:''});
        cc.assetManager.loadBundle(new URL('vendor/assets/internal',location.href).href,{version:'ff428'},function(error){
            if(error)return fail(error);
            cc.game.run({id:'GameCanvas',debugMode:cc.debug.DebugMode.ERROR,showFPS:false,frameRate:60,renderMode:0,groupList:['default'],collisionMatrix:[[true]]},function(){
                cc.view.enableRetina(true);cc.view.setDesignResolutionSize(1080,1920,cc.ResolutionPolicy.SHOW_ALL);cc.view.resizeWithBrowserSize(true);cc.view.enableAutoFullScreen(false);
                const scene=new cc.Scene(),canvas=new cc.Node('Canvas');scene.addChild(canvas);canvas.setPosition(540,960);canvas.setContentSize(1080,1920);
                const c=canvas.addComponent(cc.Canvas);c.designResolution=cc.size(1080,1920);c.fitHeight=true;c.fitWidth=true;
                const cameraNode=new cc.Node('Main Camera');canvas.addChild(cameraNode);cameraNode.setPosition(0,0,1000);const camera=cameraNode.addComponent(cc.Camera);camera.backgroundColor=new cc.Color(16,28,34);camera.cullingMask=0xffffffff;camera.ortho=true;camera.orthoSize=960;
                let map=0;try{map=JSON.parse(cc.sys.localStorage.getItem(window.WZData.saveKey)||'{}').map||0;}catch(e){}
                window.WZVisuals.preload(function(){
                    canvas.addComponent(window.WZGame);cc.director.runScene(scene);
                    cc.director.once(cc.Director.EVENT_AFTER_DRAW,function(){const load=document.getElementById('loading');load.style.opacity='0';setTimeout(()=>load.style.display='none',350);});
                },map);
            });
        });
    }catch(e){fail(e);}
})();
