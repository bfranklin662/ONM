const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
function nav(mode="ladder"){
  const events={},mount={innerHTML:""},board={innerHTML:""},location={pathname:mode==="survival"?"/monster-survival.html":"/monster-bot.html",hash:mode==="casual"?"#casual":mode==="leaderboard"?"#leaderboard":"#game",href:""};
  const ctx={document:{getElementById:id=>id==="modeNavigation"?mount:board,querySelector:()=>({addEventListener:(name,fn)=>events[name]=fn})},window:{location,addEventListener(){},getSelection:()=>({toString:()=>""})}};
  vm.runInNewContext(fs.readFileSync(require.resolve("../scripts/monster-game-navigation.js"),"utf8"),ctx);
  const swipe=(dx,dy=0,interactive=false)=>{events.touchstart({touches:[{clientX:200,clientY:200}],target:{closest:()=>interactive?{}:null}});events.touchend({changedTouches:[{clientX:200+dx,clientY:200+dy}]});};return{mount,board,location,swipe};
}
test("the same five accessible top tabs highlight the current mode or leaderboard",()=>{
  for(const mode of ["ladder","survival","casual","leaderboard"]){const g=nav(mode);assert.equal((g.mount.innerHTML.match(/<a /g)||[]).length,5);assert.equal((g.mount.innerHTML.match(/aria-current="page"/g)||[]).length,1);}
});
test("leaderboard has only Ladder and Survival subtabs, with no Casual leaderboard",()=>{
  const g=nav("leaderboard");assert.equal((g.board.innerHTML.match(/<a /g)||[]).length,3);assert.match(g.board.innerHTML,/#leaderboard/);assert.doesNotMatch(g.board.innerHTML,/Casual/);
});
test("top tabs use matching line icons without a Survival NEW badge",()=>{
  const g=nav();assert.equal((g.mount.innerHTML.match(/<svg /g)||[]).length,5);assert.doesNotMatch(g.mount.innerHTML,/modeNewBadge|>NEW</);assert.doesNotMatch(g.mount.innerHTML,/⚡/);
});
test("every mode has a shared full-width frame and compact Survival layout",()=>{
  const css=fs.readFileSync(require.resolve("../styles/monster-game-layout.css"),"utf8");
  assert.match(css,/main,main\.survivalShell/);assert.match(css,/\.survivalPromo[^}]*max-width:none/);assert.match(css,/min-height:38px;grid-template-columns:38px/);
  for(const page of ["monster-bot.html","monster-survival.html"]){const html=fs.readFileSync(require.resolve("../"+page),"utf8");assert.match(html,/monster-game-layout.css/);}
  const survival=fs.readFileSync(require.resolve("../monster-survival.html"),"utf8");assert.doesNotMatch(survival,/class="survivalHeroBots"|How far can you survive/);
});
test("ladder and Survival cards share one visual style including completed and locked states",()=>{
  const css=fs.readFileSync(require.resolve("../styles/monster-game-layout.css"),"utf8");
  assert.match(css,/:is\(\.botLevel,\.survivalHero,\.survivalRoute li\)/);
  assert.match(css,/\.botLevel\.unlocked\.beatenComplete,\.survivalRoute li\.defeated/);
  assert.match(css,/\.botLevel\.locked,\.survivalRoute li\.survivalMystery/);
  assert.match(css,/--game-card-radius:12px/);
});
test("all game containers use the green palette while flawless rewards retain gold",()=>{
  const css=fs.readFileSync(require.resolve("../styles/monster-game-layout.css"),"utf8");
  assert.match(css,/--game-card-bg:#142b23/);assert.match(css,/--game-card-border:#355d48/);
  assert.match(css,/#casualPanel,\.playerSummary,\.guestLanding,\.modeHelpDialog,\.completionDialog,\.survivalChampion/);
  assert.match(css,/\.botLevel\.unlocked\.flawlessComplete\{background:#332c13;border-color:#c4a33d/);
});
test("horizontal swipes change modes, while scrolling and interactive controls do not",()=>{
  const ladder=nav();ladder.swipe(-120);assert.equal(ladder.location.href,"monster-survival.html");
  const survival=nav("survival");survival.swipe(-120);assert.equal(survival.location.href,"ton-outs.html");
  const casual=nav("casual");casual.swipe(120);assert.equal(casual.location.href,"ton-outs.html");
  for(const args of [[30,0,false],[120,150,false],[120,0,true]]){const g=nav();g.swipe(...args);assert.equal(g.location.href,"");}
});
test("Ton+ Outs belongs inside Monster Bot Game directly after Survival, not on the main Play menu",()=>{
 const g=nav();assert.ok(g.mount.innerHTML.indexOf('>Survival<')<g.mount.innerHTML.indexOf('>Ton+ Outs<'));assert.ok(g.mount.innerHTML.indexOf('>Ton+ Outs<')<g.mount.innerHTML.indexOf('>Casual<'));
 assert.doesNotMatch(fs.readFileSync(require.resolve("../games.html"),"utf8"),/href="ton-outs.html"/);
});
test("Ton+ Outs uses the same full-width game frame and mobile leaderboard tabs share equal widths",()=>{
 const html=fs.readFileSync(require.resolve("../ton-outs.html"),"utf8"),css=fs.readFileSync(require.resolve("../styles/monster-game-navigation.css"),"utf8");
 assert.match(html,/monster-game-layout.css/);assert.match(css,/nav\.boardNavigation\.boardNavigation\{width:100%;max-width:100%;box-sizing:border-box/);assert.match(css,/nav\.boardNavigation\.boardNavigation a\{flex:1 1 0;min-width:0/);
});
