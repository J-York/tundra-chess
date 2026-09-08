/* Screenshot fallback for local QA when ego's screenshot endpoint is unavailable.
   Requires the isolated headless Chrome listening on 127.0.0.1:41879. */
'use strict';
const fs=require('node:fs/promises');
async function main(){
  const [url,out,width='1440',height='1050']=process.argv.slice(2);
  if(!url?.startsWith('http://127.0.0.1:8879/')||!out)throw Error('Use a local QA URL and an output path');
  const target=await (await fetch('http://127.0.0.1:41879/json/new?'+encodeURIComponent('about:blank'),{method:'PUT'})).json();
  const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let next=1;
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=e=>{const data=JSON.parse(e.data),p=pending.get(data.id);if(p){pending.delete(data.id);clearTimeout(p.timer);data.error?p.reject(Error(data.error.message)):p.resolve(data.result);}};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=next++,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},15000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
  try{
    await call('Page.enable');
    await call('Emulation.setDeviceMetricsOverride',{width:+width,height:+height,deviceScaleFactor:1,mobile:+width<641});
    await call('Page.navigate',{url});
    for(let i=0;i<40;i++){
      const ready=await call('Runtime.evaluate',{expression:"document.readyState==='complete'&&!!document.querySelector('[data-actor]')",returnByValue:true});
      if(ready.result.value)break;if(i===39)throw Error('Game failed to render');await new Promise(r=>setTimeout(r,100));
    }
    await call('Runtime.evaluate',{expression:'document.fonts.ready',awaitPromise:true});
    const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await fs.writeFile(out,Buffer.from(shot.data,'base64'));
    const geometry=await call('Runtime.evaluate',{expression:'({width:innerWidth,scroll:document.documentElement.scrollWidth,height:innerHeight})',returnByValue:true});
    console.log(JSON.stringify({file:out,...geometry.result.value}));
  }finally{ws.close();await fetch('http://127.0.0.1:41879/json/close/'+target.id);}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
