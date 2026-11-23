(function(){
    'use strict';
    window.WZ_WEB_DEMO=true;
    function fail(error){const el=document.getElementById('error');el.style.display='block';el.textContent='游戏暂时无法启动，请检查网络后刷新页面。';if(window.WZRuntimeConfig&&window.WZRuntimeConfig.debug)el.textContent+='\n\n'+(error.stack||error.message||String(error));console.error(error);}
    window.addEventListener('error',e=>{if(!window.__WZ_DEMO__)fail(e.error||e.message);});
    try{
        cc.assetManager.init({bundleVers:{internal:'ff428'},remoteBundles:[],server:''});
        cc.assetManager.loadBundle(new URL('vendor/assets/internal',location.href).href,{version:'ff428'},function(error){
            if(error)return fail(error);
            cc.game.run({id:'GameCanvas',debugMode:cc.debug.DebugMode.ERROR,showFPS:false,frameRate:60,renderMode:0,groupList:['default'],collisionMatrix:[[true]]},function(){
                cc.view.enableRetina(true);cc.view.setDesignResolutionSize(1080,1920,cc.ResolutionPolicy.SHOW_ALL);cc.view.resizeWithBrowserSize(true);cc.view.enableAutoFullScreen(false);
                const scene=new cc.Scene(),canvas=new cc.Node('Canvas');scene.addChild(canvas);canvas.setPosition(540,960);canvas.setContentSize(1080,1920);
                const c=canvas.addComponent(cc.Canvas);c.designResolution=cc.size(1080,1920);c.fitHeight=true;c.fitWidth=true;
                const cameraNode=new cc.Node('Main Camera');canvas.addChild(cameraNode);cameraNode.setPosition(0,0,1000);const camera=cameraNode.addComponent(cc.Camera);camera.backgroundColor=new cc.Color(16,28,34);camera.cullingMask=0xffffffff;camera.ortho=true;camera.orthoSize=960;camera.farClip=10000;
                const game=canvas.addComponent(window.WZGame),ageImage=new Image();
                ageImage.src=document.getElementById('launch-age').src;
                const startScene=()=>{
                    if(ageImage.naturalWidth){
                        const texture=new cc.Texture2D();texture.initWithElement(ageImage);game.launchAgeTexture=texture;
                    }
                    cc.director.runScene(scene);
                    cc.director.once(cc.Director.EVENT_AFTER_DRAW,()=>{document.getElementById('loading').style.display='none';});
                };
                if(ageImage.complete)startScene();
                else{
                    ageImage.addEventListener('load',startScene,{once:true});
                    ageImage.addEventListener('error',startScene,{once:true});
                }
            });
        });
    }catch(e){fail(e);}
})();
