(function(root,factory){
  if(typeof module!=="undefined"&&module.exports){module.exports=factory;return;}
  try{if(root.parent!==root&&root.parent.ONMBotAttempts){root.ONMBotAttempts=root.parent.ONMBotAttempts;return;}}catch{}
  root.ONMBotAttempts=factory(root.localStorage,()=>root.crypto.randomUUID());
})(typeof window!=="undefined"?window:globalThis,function(storage,newId){
  "use strict";
  const valid=key=>/^(10|[1-9])-(1|3|5|7|9)$/.test(key);
  const clean=counts=>Object.fromEntries(Object.entries(counts||{}).filter(([key,n])=>valid(key)&&Number.isSafeInteger(n)&&n>=0));
  const read=key=>{try{return JSON.parse(storage.getItem(key)||"null");}catch{return null;}};
  const write=(key,value)=>{try{storage.setItem(key,JSON.stringify(value));}catch{}};
  let device=read("onm-bot-attempt-device");
  if(typeof device!=="string"||!/^[\w-]{8,80}$/.test(device))device=null;
  const accounts=new Map(),queues=new Map();
  const ensureDevice=()=>{if(!device){device=newId();write("onm-bot-attempt-device",device);}};
  const state=uid=>{
    if(!accounts.has(uid))accounts.set(uid,{devices:{},own:clean(read(`onm-bot-attempts-${uid}`))});return accounts.get(uid);
  };
  function load(uid,data={}){
    const s=state(uid);s.devices=data.monsterBotAttemptDevices||{};
    const saved=clean(s.devices[device]);
    s.own=clean(read(`onm-bot-attempts-${uid}`));
    for(const [key,n] of Object.entries(saved))s.own[key]=Math.max(s.own[key]||0,n);
    if(Object.keys(s.own).length)write(`onm-bot-attempts-${uid}`,s.own);
  }
  function counts(uid){
    const s=state(uid),result={};
    for(const [id,values] of Object.entries({...s.devices,[device]:s.own}))for(const [key,n] of Object.entries(clean(values)))result[key]=(result[key]||0)+n;
    return result;
  }
  function start(uid,key){
    if(!valid(key))throw Error("Invalid bot challenge");
    ensureDevice();
    const s=state(uid),local=clean(read(`onm-bot-attempts-${uid}`));
    for(const [k,n] of Object.entries(local))s.own[k]=Math.max(s.own[k]||0,n);
    s.own[key]=(s.own[key]||0)+1;write(`onm-bot-attempts-${uid}`,s.own);
    return counts(uid)[key];
  }
  function sync(uid,db,sdk){
    ensureDevice();
    const run=async()=>{
      const s=state(uid);
      await sdk.runTransaction(db,async tx=>{
        const ref=sdk.doc(db,"users",uid),snap=await tx.get(ref),data=snap.data()||{};
        const own={...clean(data.monsterBotAttemptDevices?.[device])};
        for(const [key,n] of Object.entries(s.own))own[key]=Math.max(own[key]||0,n);
        const devices={...(data.monsterBotAttemptDevices||{}),[device]:own};
        tx.update(ref,{monsterBotAttemptDevices:devices});
        s.devices=devices;
      });
    };
    const promise=(queues.get(uid)||Promise.resolve()).catch(()=>{}).then(run);
    queues.set(uid,promise);return promise;
  }
  return {load,counts,start,sync};
});
