const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../scripts/fixture-photos.js'),'utf8');
function harness(loader, timers = { setTimeout, clearTimeout }) {
  const container = { innerHTML:'' }, events = {};
  const context = { ...timers, document:{getElementById:()=>container,addEventListener:(event,handler)=>{events[event]=handler}}, window:{ONMResultPhotos:{thumbnail:url=>url,loadMatchPhotos:loader}} };
  vm.createContext(context);vm.runInContext(source,context);
  return {api:context.window.ONMFixturePhotos,container,events};
}
test('fixture popup previews at most eight photos and offers the shared uploader for its result',async()=>{
 const h=harness(async()=>({urls:Array.from({length:18},(_,i)=>`https://example.test/${i}.jpg`),partial:false}));
 await h.api.show({completed:true,resultRow:{_resultId:'saved-match'}});
 assert.equal((h.container.innerHTML.match(/data-fixture-photo=/g)||[]).length,8);
 assert(h.container.innerHTML.includes('data-photo-count="18"'));
 assert(h.container.innerHTML.includes('data-extra="+10"'));
 assert(h.container.innerHTML.includes('data-add-result-photos="saved-match" hidden'));
 assert(h.container.innerHTML.includes('Add more'));
});
test('late photos from the previous match never replace the newly opened match',async()=>{
 let finish;
 const h=harness(row=>row._resultId==='old'?new Promise(resolve=>{finish=resolve}):Promise.resolve({urls:['https://example.test/new.jpg'],partial:false}));
 const pending=h.api.show({completed:true,resultRow:{_resultId:'old'}});
 await h.api.show({completed:true,resultRow:{_resultId:'new'}});
 finish({urls:['https://example.test/old.jpg'],partial:false});await pending;
 assert(h.container.innerHTML.includes('new.jpg'));assert(!h.container.innerHTML.includes('old.jpg'));
});
test('an upload refreshes only its own open match',async()=>{
 const requests=[];const h=harness(async(row,force)=>{requests.push({id:row._resultId,force});return {urls:[],partial:false}});
 await h.api.show({completed:true,resultRow:{_resultId:'current'}});
 h.events['onm-result-photos-changed']({detail:{resultId:'another'}});
 assert.equal(requests.length,1);
 h.events['onm-result-photos-changed']({detail:{resultId:'current'}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(requests.at(-1),{id:'current',force:true});
});

test('a stalled photo request shows the spinner and uploader, then allows retry',async()=>{
 let expire;
 const h=harness(()=>new Promise(()=>{}),{setTimeout:fn=>{expire=fn;return 1;},clearTimeout(){}});
 const pending=h.api.show({completed:true,resultRow:{_resultId:'saved-match'}});
 assert.match(h.container.innerHTML,/fixturePhotosSpinner/);
 assert.match(h.container.innerHTML,/Add photos/);
 expire();
 await pending;
 assert.doesNotMatch(h.container.innerHTML,/fixturePhotosSpinner/);
 assert.match(h.container.innerHTML,/data-retry-fixture-photos/);
 assert.match(h.container.innerHTML,/Add photos/);
});
