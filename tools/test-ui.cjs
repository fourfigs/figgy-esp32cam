// Deterministic dashboard behavior checks. DOM and device responses are mocked.
const vm=require('vm'),fs=require('fs'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../web/index.html'),'utf8');
function element(id='') {return {id,hidden:false,disabled:false,value:'',type:id==='password'?'password':'',textContent:'',children:[],attributes:{},removeAttribute(k){delete this[k]},setAttribute(k,v){this.attributes[k]=v},append(...nodes){this.children.push(...nodes)},replaceChildren(){this.children=[]},focus(){this.focused=true},click(){this.clicked=true}};}
const elements={};const el=id=>elements[id]??=element(id);const downloads=[];let scanMode='success',postScan=0,pollScan=0,wifiPosts=0,fail=false,captureFail=false,wifiFail=false;
let state={camera:true,stream:true,setup:true,setup_access:true,connected:false,ip:'0.0.0.0'};
const networks=[{ssid:'Weak',rssi:-83,open:false},{ssid:'Home',rssi:-42,open:false},{ssid:'Home',rssi:-70,open:false},{ssid:'<img src=x onerror=alert(1)>',rssi:-65,open:true},{ssid:'',rssi:-50,open:false}];
const response=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data,text:async()=>typeof data==='string'?data:JSON.stringify(data)});
const context={document:{hidden:false,fullscreenEnabled:true,getElementById:el,addEventListener(){},createElement(tag){const e=element();if(tag==='a')downloads.push(e);return e;}},location:{href:'http://192.168.4.1/'},URL,URLSearchParams,AbortSignal,Date,TextEncoder,setTimeout(fn,ms){if(ms<=750)Promise.resolve().then(fn)},setInterval(){},fetch:async(url,opt={})=>{
 if(fail)throw Error('offline');if(url==='/status')return response(200,state);
 if(url==='/wifi/scan') {if(opt.method==='POST'){postScan++;assert.equal(opt.headers['X-Figgy-Setup'],'1');return response(202,{scanning:true});}pollScan++;if(scanMode==='timeout')return response(202,{});if(scanMode==='failure')return response(503,'Radio unavailable');return response(200,{networks:scanMode==='empty'?[]:networks});}
 if(url==='/capture'){if(captureFail)return response(503,'Camera busy');return {ok:true,blob:async()=>new Blob(['jpeg'])};}
 if(url==='/wifi'){wifiPosts++;assert.equal(opt.headers['X-Figgy-Setup'],'1');assert.equal(opt.body.get('ssid'),el('ssid').value);return response(wifiFail?500:200,wifiFail?'Storage unavailable':'Saved. Reconnect to your home Wi-Fi after restart.');}
 throw Error('Unexpected route '+url);
}};
vm.createContext(context);vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
const run=s=>vm.runInContext(s,context);
async function settle(){for(let i=0;i<100;i++)await Promise.resolve();}
(async()=>{
 await settle();assert.equal(el('badge').textContent,'Camera ready');assert(!el('toggle').disabled);assert.equal(postScan,1);assert.equal(el('networks').children.length,3);assert.equal(el('networks').children[0].children[0].textContent,'Home');assert.equal(el('networks').children[1].children[0].textContent,'<img src=x onerror=alert(1)>');
 el('password').value='oldpassword';el('networks').children[0].onclick();assert.equal(el('ssid').value,'Home');assert.equal(el('password').value,'');assert.equal(el('networks').children[0].attributes['aria-pressed'],'true');
 el('show-password').onclick();assert.equal(el('password').type,'text');el('show-password').onclick();assert.equal(el('password').type,'password');
 el('toggle').onclick();assert.equal(new URL(el('stream').src).port,'81');assert(!el('fullscreen').disabled);el('toggle').onclick();assert(el('stream').hidden);assert(el('fullscreen').disabled);
 el('toggle').onclick();el('stream').onerror();assert.match(el('message').textContent,/disconnected/);
 await el('capture').onclick();assert(downloads[0].clicked);assert(!el('capture').disabled);captureFail=true;await el('capture').onclick();assert.match(el('message').textContent,/Camera busy/);captureFail=false;
 scanMode='failure';await context.scanNetworks();assert.match(el('scan-status').textContent,/manually/);assert(!el('rescan').disabled);
 scanMode='empty';await context.scanNetworks();assert.equal(el('networks').children.length,0);assert.match(el('scan-status').textContent,/No named/);
 scanMode='timeout';await context.scanNetworks();assert.match(el('scan-status').textContent,/timed out/);assert(!el('rescan').disabled);
 const submit=()=>el('wifi').onsubmit({preventDefault(){}});
 el('ssid').value='é'.repeat(17);await submit();assert.equal(wifiPosts,0);assert.match(el('wifi-message').textContent,/1–32 bytes/);
 el('ssid').value='Hidden network';el('password').value='short';await submit();assert.equal(wifiPosts,0);
 el('password').value='validpassword';wifiFail=true;await submit();assert.match(el('wifi-message').textContent,/Storage unavailable/);assert(!el('save-wifi').disabled);wifiFail=false;
 state.camera=false;await context.status();assert(el('toggle').disabled);assert.match(el('message').textContent,/initialization failed/);
 state.camera=true;state.setup_access=false;state.connected=true;state.ssid='Home';state.rssi=-60;state.ip='192.168.1.42';await context.status();assert(el('settings').hidden);assert.match(el('wifi-state').textContent,/Home · Good/);
 fail=true;await context.status();assert.equal(el('badge').textContent,'Offline');assert(el('capture').disabled);assert(el('save-wifi').disabled);
 fail=false;state.setup_access=true;await context.status();assert(!el('capture').disabled);assert.match(el('message').textContent,/Ready/);
 await submit();assert.equal(wifiPosts,2);assert.equal(el('badge').textContent,'Restarting…');assert(el('save-wifi').disabled);assert(el('toggle').disabled);assert.equal(el('password').value,'');
 fail=true;await context.status();assert.equal(el('badge').textContent,'Restarting…');assert.match(el('wifi-message').textContent,/Reconnect/);assert(run('restarting'));
 console.log('PASS: scan start/poll, strongest-first deduplication, literal SSIDs, network selection, manual entry, password toggle, scan failure/empty/timeout, stream controls/errors, photo success/failure, byte validation, save failure, setup-only controls, offline/recovery, restart feedback. DOM/device mocked; hardware and visual checks still required.');
})().catch(e=>{console.error(e);process.exitCode=1;});
