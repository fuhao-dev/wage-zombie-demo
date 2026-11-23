/* Screen placement only: playfield coordinates, work areas and hit radii stay unchanged. */
(function(root){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),positive=(v,f)=>Number.isFinite(+v)&&+v>0?+v:f;
 function calculate(frame,metrics){
  metrics=metrics||{};const w=positive(frame.width,360),h=positive(frame.height,640);
  const height=Math.max(1920,1080*h/w),pixelScale=Math.min(w/1080,h/height),viewportTop=(h-height*pixelScale)/2;
  const info=metrics.info||{},unit=w/positive(info.windowWidth,positive(info.screenWidth,w));
  const windowHeight=positive(info.windowHeight,h/unit),windowTop=Math.max(0,+info.windowTop||0),safe=info.safeArea;
  let top=0,bottom=0,hasTop=false,hasBottom=false;
  if(safe&&Number.isFinite(+safe.top)&&Number.isFinite(+safe.bottom)&&+safe.bottom>+safe.top){
   top=Math.max(0,+safe.top-windowTop);bottom=Math.max(0,windowHeight-(+safe.bottom-windowTop));hasTop=hasBottom=true;
  }
  if(+info.statusBarHeight>windowTop){top=Math.max(top,+info.statusBarHeight-windowTop);hasTop=true;}
  const menu=metrics.menu,menuBottom=menu&&(Number.isFinite(+menu.bottom)?+menu.bottom:+menu.top+(+menu.height||0));
  const hasMenu=menu&&+menu.width>0&&menuBottom>0&&menuBottom<windowHeight*.3;
  if(hasMenu){top=Math.max(top,menuBottom-windowTop+8);hasTop=true;}
  let topInset=Math.max(0,(top*unit-viewportTop)/pixelScale),bottomInset=Math.max(0,(bottom*unit-viewportTop)/pixelScale);
  if(metrics.native&&!hasMenu)topInset=Math.max(topInset,168);
  if(metrics.native&&!hasBottom)bottomInset=28;
  topInset=clamp(topInset,0,height*.22);bottomInset=clamp(bottomInset,0,height*.15);
  const scale=Math.min(1,(height-topInset-bottomInset)/1920),contentHeight=(height-topInset-bottomInset)/scale;
  return {width:1080,height,top:topInset,bottom:bottomInset,scale,left:(1080-1080*scale)/2,contentHeight,
   shopTop:1290,shopBottom:contentHeight-20,shopHeight:contentHeight-1310,shopViewportHeight:contentHeight-1490,
   footerY:contentHeight-10,loadingOffset:(contentHeight-1920)/2};
 }
 const api={calculate};if(typeof module!=='undefined')module.exports=api;root.WZUILayout=api;
})(typeof globalThis!=='undefined'?globalThis:this);
