const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../scripts/monster-bot-engine.js");
const fs = require("node:fs");
const vm = require("node:vm");
function seeded(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
test("only possible scores and double-out finishes are accepted", () => {
  assert.equal(E.validateVisit(501, 180), "");
  assert.notEqual(E.validateVisit(501, 179), "");
  assert.notEqual(E.validateVisit(20, 19), "");
  assert.notEqual(E.validateVisit(20, 21), "");
  assert.equal(E.validateVisit(170, 170, 3), "");
  assert.notEqual(E.validateVisit(169, 169, 3), "");
  assert.equal(E.validateVisit(50, 50, 1), "");
  assert.notEqual(E.validateVisit(60, 60, 1), "");
});

async function gameHarness(stored = new Map(), account = { uid: "test-member" }, communityFetch = async()=>{throw new Error("Offline test");}) {
  const elements = new Map(), writes = []; let callback, authCallback;
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: "", hidden: false, disabled: false, textContent: "", innerHTML: "", listeners: {},
      scrollIntoView(options) { this.scrolledIntoView = options; }, setAttribute(name,value) { this[name] = value; }, showModal() { this.open = true; }, close() { this.open = false; }, classList: { toggle() {} }, focus() {}, querySelectorAll() { return []; },
      addEventListener(event, fn) { this.listeners[event] = fn; }
    });
    return elements.get(id);
  }
  element("bestOf").value = "1"; element("firstThrow").value = "player"; element("checkoutDarts").value = "3";
  const context = {
    window: { ONMBotData:{withTimeout:(promise,ms)=>require("../scripts/monster-bot-data").withTimeout(promise,account?.authPending?5:ms),fetchCommunity:communityFetch},MonsterBotEngine: { ...E, botVisit: (remaining) => ({ remaining, score: 0, darts: 3, attempts: 0, hits: [0, 0, 0] }) }, ONMFirebase: {
      config:{projectId:"oche-ness-monsters"},
      currentFirebaseUser: async () => { if (account?.authError) throw new Error("Auth unavailable"); if(account?.authPending)return new Promise(()=>{});return account; },
      loadOwnUser: async () => { throw new Error("Profile could not be loaded"); },
      ready: Promise.resolve({ auth: {}, authSdk: { onAuthStateChanged: (_auth, fn) => { authCallback = fn; } }, db: {}, firestoreSdk: {
        doc: (_db, collection, uid) => `${collection}/${uid}`,
        getDoc: async () => account?.docPromise ? await account.docPromise : ({ data: () => ({ monsterBotWins: account?.seedWins || [], monsterBotBestScores: account?.seedScores || {} }) }),
        arrayUnion: (...values) => values,
        runTransaction: async (_db, fn) => fn({ get: async () => ({ data: () => ({ monsterBotBestScores: {} }) }), update: (path, data) => writes.push({ path, data }) }),
        updateDoc: async (path, data) => writes.push({ path, data })
      } })
    }, location: {href:""}, addEventListener() {} },
    document: { getElementById: element },
    localStorage: { getItem: k => stored.get(k) || null, setItem: (k, v) => stored.set(k, v) },
    requestAnimationFrame: fn => fn(), setTimeout: fn => { callback = fn; return 1; }, clearTimeout: () => { callback = null; }, confirm: () => true, Math
  };
  // Retain coverage of the original scoring/progress implementation while
  // separately checking that real ladder clicks route to the shared scorer.
  vm.runInNewContext(fs.readFileSync(require.resolve("../scripts/monster-bot.js"), "utf8").replace("  loadProgress().then", "  window.testBegin = begin;\n  loadProgress().then"), context);
  await new Promise(resolve => setImmediate(resolve));
  const click = id => element(id).listeners.click();
  const start = (level = 1, mode = 1) => {
    element(`bot-mode-${level}`).value = String(mode);
    context.window.testBegin(level,mode);
  };
  const bot = () => { const fn = callback; callback = null; if (fn) fn(); };
  const score = n => { element("visitScore").value = String(n); element("scoreForm").listeners.submit({ preventDefault() {} }); };
  const signOut = async () => { account = null; authCallback(null); await new Promise(resolve => setImmediate(resolve)); };
  const playButton = (level=1,mode=1) => {element(`bot-mode-${level}`).value=String(mode);element("botLevels").listeners.click({target:{closest:selector=>selector==="[data-play-level]"?{dataset:{playLevel:String(level)}}:null}});return context.window.location.href;};
  return { element, click, bot, score, stored, writes, start, signOut, playButton };
}
test("real play buttons open the league scorer in bot mode and respect locks",async()=>{
  const g=await gameHarness();assert.equal(g.playButton(2),"");
  assert.equal(g.playButton(1,7),"dart-scorer.html?mode=bot&level=1&format=7");
  const visitor=await gameHarness(new Map(),null);assert.equal(visitor.playButton(),"");
});
test("leaderboard loads while account verification is pending and account timeout offers Retry",async()=>{
  const g=await gameHarness(new Map(),{authPending:true},async()=>({completions:{},leaderboard:[{name:"Public player",level:2,completed:2,flawless:1}]}));
  g.click("leaderboardTab");
  assert.match(g.element("leaderboardRows").innerHTML,/Public player/);
  assert.equal(g.playButton(),"");
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(g.element("retryAccount").hidden,false);
  assert.match(g.element("leaderboardRows").innerHTML,/Public player/);
});
test("a failed leaderboard request can be retried successfully",async()=>{
  let calls=0;
  const g=await gameHarness(new Map(),{authPending:true},async()=>{calls++;if(calls===1)throw Error("Service unavailable");return{completions:{},leaderboard:[{name:"Recovered player",level:1,completed:1,flawless:1}]};});
  assert.equal(g.element("retryLeaderboard").hidden,false);
  g.click("retryLeaderboard");await new Promise(resolve=>setImmediate(resolve));
  assert.match(g.element("leaderboardRows").innerHTML,/Recovered player/);
  assert.equal(g.element("retryLeaderboard").hidden,true);
});
test("ladder waits for Firebase progress then focuses the highest unlocked bot",async()=>{
  let resolve;
  const docPromise = new Promise(done=>{resolve=done;});
  const g = await gameHarness(new Map(),{uid:"test-member",docPromise});
  assert.equal(g.element("botLevels").hidden,true);
  assert.equal(g.element("botLevels").innerHTML,"");
  assert.equal(g.element("accountLoading").hidden,false);
  resolve({data:()=>({monsterBotWins:["1-1","1-3"]})});
  await new Promise(done=>setImmediate(done));
  assert.equal(g.element("accountLoading").hidden,true);
  assert.equal(g.element("botLevels").hidden,false);
  assert.equal(g.element("bot-level-2").scrolledIntoView.block,"start");
  assert.match(g.element("botLevels").innerHTML,/Level 3 · Mystery Bot/);
  assert.doesNotMatch(g.element("botLevels").innerHTML,/Venton Bot|Beat Billy Bot in 2 modes/);
});
test("failed Firebase progress keeps bots hidden and offers retry",async()=>{
  const docPromise = Promise.reject(new Error("Unavailable"));
  const g = await gameHarness(new Map(),{uid:"test-member",docPromise});
  assert.equal(g.element("botLevels").hidden,true);
  assert.equal(g.element("retryAccount").hidden,false);
  assert.equal(g.element("accountSpinner").hidden,true);
  assert.equal(g.playButton(),"");
});
test("completed requirements remain ticked on locked bots and disappear after unlock",async()=>{
  const wins=[...E.MODES.map(mode=>`1-${mode}`),"2-1"];
  const scores=Object.fromEntries(wins.map(key=>[key,{won:E.legsNeeded(Number(key.split("-")[1])),lost:0}]));
  const stored=new Map([["onm-monster-bot-test-member",JSON.stringify(wins)],["onm-monster-bot-test-member-scores",JSON.stringify(scores)]]);
  const locked=await gameHarness(stored);
  assert.match(locked.element("botLevels").innerHTML,/<li class="met"><span aria-label="Met">✓<\/span> Collect 6 gold stars \(6\/6\)/);
  assert.match(locked.element("botLevels").innerHTML,/Beat Billy Bot in BO1, BO3, BO5 and BO7/);
  wins.push("2-3");stored.set("onm-monster-bot-test-member",JSON.stringify(wins));
  const unlocked=await gameHarness(stored);
  const card=unlocked.element("botLevels").innerHTML.split('id="bot-level-3"')[1].split("</article>")[0];
  assert.match(card,/Venton Bot/);assert.doesNotMatch(card,/Requirements to play/);
});
test("completion modal Play respects bot and format locks",async()=>{
  const g=await gameHarness();
  const open=key=>g.element("botLevels").listeners.click({target:{closest:s=>s==="[data-community-key]"?{dataset:{communityKey:key}}:null}});
  const play=(level,format)=>g.element("completionDialog").listeners.click({target:{closest:()=>({dataset:{completionLevel:String(level),completionFormat:String(format)}})}});
  open("1-9");assert.match(g.element("completionActions").innerHTML,/disabled>Play Bull or Bust/);
  assert.equal(g.element("completionModeRules").hidden,false);
  assert.match(g.element("completionModeRules").textContent,/must win with a Bullseye \(50\) checkout/);
  assert.match(g.element("completionModeRules").textContent,/Going below 50/);
  assert.match(g.element("completionPlayHint").textContent,/Beat BO1, BO3, BO5 and BO7/);
  play(1,9);assert.equal(g.playButton(1,9),"");
  open("2-1");assert.match(g.element("completionActions").innerHTML,/disabled>Play BO1/);
  play(2,1);assert.equal(g.playButton(2,1),"");
  open("1-3");assert.doesNotMatch(g.element("completionActions").innerHTML,/disabled/);
  assert.equal(g.element("completionModeRules").hidden,true);
  play(1,3);assert.equal(g.playButton(1,3),"dart-scorer.html?mode=bot&level=1&format=3");
  const unlocked=await gameHarness(new Map(),{uid:"test-member",seedWins:E.STANDARD_MODES.map(m=>`1-${m}`)});
  assert.equal(unlocked.playButton(1,9),"dart-scorer.html?mode=bot&level=1&format=9");
});
test("any two distinct formats unlock Croft and cards show completed counts",async()=>{
  for(const first of E.MODES) for(const second of E.MODES) {
    assert.equal(E.isUnlocked(2,new Set([`1-${first}`,`1-${second}`])),first!==second);
  }
  for(const count of [1,5]) {
    const wins=E.MODES.slice(0,count).map(mode=>`1-${mode}`);
    const g=await gameHarness(new Map([["onm-monster-bot-test-member",JSON.stringify(wins)]]));
    assert.match(g.element("botLevels").innerHTML,new RegExp(`✓ Beaten ${count}/5`));
    assert.match(g.element("botLevels").innerHTML,new RegExp(`class="won beatenCount">✓ Beaten ${count}/5`));
  }
});
test("bot cards display five-point average ranges for all ten levels",async()=>{
  const wins=E.LEVELS.flatMap(p=>E.MODES.map(mode=>`${p.level}-${mode}`));
  const scores=Object.fromEntries(E.LEVELS.flatMap(p=>E.MODES.map(mode=>[`${p.level}-${mode}`,{won:E.legsNeeded(mode),lost:0}])));
  const g=await gameHarness(new Map([["onm-monster-bot-test-member",JSON.stringify(wins)],["onm-monster-bot-test-member-scores",JSON.stringify(scores)]]));
  for(const p of E.LEVELS) assert.match(g.element("botLevels").innerHTML,new RegExp(`${p.average}–${p.average+5} average`));
});
test("cards show flawless format counts beside wins, excluding missing and invalid scores",async()=>{
  const wins=["1-1","1-3","1-5","1-7"];
  const scores={"1-1":{won:1,lost:0},"1-3":{won:2,lost:0},"1-5":{won:3,lost:1},"1-7":{won:99,lost:0},"1-9":{won:1,lost:0}};
  const stored=new Map([["onm-monster-bot-test-member",JSON.stringify(wins)],["onm-monster-bot-test-member-scores",JSON.stringify(scores)]]);
  const g=await gameHarness(stored);
  assert.match(g.element("botLevels").innerHTML,/✓ Beaten 4\/5<\/span><span class="gold flawlessCount">★ Flawless 2\/5/);
  assert.match(g.element("botLevels").innerHTML,/<div class="completionMedals">/);
  assert.doesNotMatch(g.element("botLevels").innerHTML,/Players who beat this bot|botCompletionTotal/);
  const noScores=await gameHarness(new Map([["onm-monster-bot-test-member",JSON.stringify(["1-3"])]]));
  assert.match(noScores.element("botLevels").innerHTML,/✓ Beaten 1\/5<\/span><span class="gold flawlessCount">★ Flawless 0\/5/);
});
test("completion modal highlights the player's own result independently of community loading",async()=>{
  for(const lost of [0,1]){
    const stored=new Map([["onm-monster-bot-test-member",JSON.stringify(["1-3"])],["onm-monster-bot-test-member-scores",JSON.stringify({"1-3":{won:2,lost}})]]);
    const g=await gameHarness(stored);
    const open=key=>g.element("botLevels").listeners.click({target:{closest:s=>s==="[data-community-key]"?{dataset:{communityKey:key}}:null}});
    open("1-3");assert.equal(g.element("completionYourResult").hidden,false);
    assert.match(g.element("completionYourResult").textContent,lost===0 ? /Flawless win · 2–0/ : /You've beaten this challenge · 2–1/);
    assert.match(g.element("completionYourResult").className,lost===0 ? /gold/ : /won/);
    open("1-5");assert.equal(g.element("completionYourResult").hidden,true);
    assert.equal(g.element("saveStatus").hidden,true);
  }
});
test("mode picker selects the next unbeaten format but ticks completed formats only",async()=>{
  for (let count=0;count<=E.MODES.length;count++) {
    const wins=E.MODES.slice(0,count).map(mode=>`1-${mode}`);
    const g=await gameHarness(new Map([["onm-monster-bot-test-member",JSON.stringify(wins)]]));
    const html=g.element("botLevels").innerHTML;
    const picker=html.match(/<details class="modePicker"[^>]*data-picker-level="1">(.*?)<\/details>/)[1];
    const next=E.MODES[count]||E.MODES[0];
    assert.match(html,new RegExp(`id="bot-mode-1" type="hidden" value="${next}"`));
    assert.match(picker,new RegExp(`data-choose-mode="${next}" aria-pressed="true"`));
    if(count<4) assert.match(picker,/data-choose-mode="9"[^>]*disabled/);
    if(count===4) assert.match(g.element("botLevels").innerHTML,/<p id="bot-mode-rules-1" class="bullModeRules" >Bull or Bust/);
    const options=picker.split('<div class="modeOptions"')[1];
    assert.equal((options.match(/class="modeCompletionTick won"/g)||[]).length,count);
    if(count<5) assert.doesNotMatch(picker.match(/<summary[^>]*>(.*?)<\/summary>/)[1],/modeCompletionTick/);
  }
});
test("mode completion ticks distinguish wins from flawless wins, never selection",async()=>{
  const stored=new Map([["onm-monster-bot-test-member",JSON.stringify(["1-1","1-3"])],["onm-monster-bot-test-member-scores",JSON.stringify({"1-1":{won:1,lost:0},"1-3":{won:2,lost:1}})]]);
  const g=await gameHarness(stored);
  const picker=g.element("botLevels").innerHTML.match(/<details class="modePicker"[^>]*data-picker-level="1">(.*?)<\/details>/)[1];
  assert.match(picker,/data-choose-mode="1"[^>]*><span>BO1<\/span><span class="modeCompletionTick gold"/);
  assert.match(picker,/data-choose-mode="3"[^>]*><span>BO3<\/span><span class="modeCompletionTick won"/);
  assert.match(picker,/data-choose-mode="5" aria-pressed="true"[^>]*><span>BO5<\/span><\/button>/);
  g.element("botLevels").listeners.click({target:{closest:s=>s==="[data-choose-mode]"?{dataset:{chooseLevel:"1",chooseMode:"3"}}:null}});
  assert.match(g.element("botLevels").innerHTML,/id="bot-mode-1" type="hidden" value="3"/);
});

test("visitors see only the first two levels and all modes but cannot play", async () => {
  const stored = new Map([["onm-monster-bot-guest",JSON.stringify(["1-1","1-3"])]]);
  const g = await gameHarness(stored,null);
  const html = g.element("botLevels").innerHTML;
  assert.equal((html.match(/Sign up to play/g)||[]).length,2);
  assert.equal((html.match(/Requirements to play/g)||[]).length,1);
  assert.doesNotMatch(html,/Filip Bot/); assert.match(html,/Bull or Bust/);
  assert.match(html,/auth.html\?mode=register/);
  assert.match(html,/redirect=monster-bot.html/);
  assert.match(g.element("saveStatus").innerHTML,/mode=login&redirect=monster-bot.html/);
  assert.equal(g.element("bot-level-1").scrolledIntoView.block,"start");
  assert.match(g.element("progressSummary").textContent,/0 \/ 50/);
  g.start(); g.score(180); g.bot();
  assert.equal(g.element("matchTitle").textContent,"");
  assert.equal(g.writes.length,0);
});

test("outstanding requirements stay visible and signing out stops play", async () => {
  const g = await gameHarness();
  assert.equal((g.element("botLevels").innerHTML.match(/Requirements to play/g)||[]).length,1);
  assert.doesNotMatch(g.element("botLevels").innerHTML,/Sign in with a registered account/);
  assert.match(g.element("botLevels").innerHTML,/Beat Billy Bot in 2 modes/);
  g.start(); g.score(180);
  await g.signOut(); g.bot(); g.score(180); g.start();
  assert.equal(g.element("matchPanel").hidden,true);
  assert.equal(g.element("challengeSetup").hidden,false);
  assert.equal((g.element("botLevels").innerHTML.match(/Sign up to play/g)||[]).length,2);
  assert.equal(g.writes.filter(w => w.data.monsterBotWins).length,0);
});

test("unlocking the next bot reveals exactly one more locked preview", async () => {
  const g = await gameHarness();
  assert.doesNotMatch(g.element("botLevels").innerHTML,/Venton Bot/);
  g.start(1,1); g.score(180); g.bot(); g.score(180); g.bot(); g.score(141);
  await new Promise(resolve => setImmediate(resolve));
  g.click("backToLevels"); g.start(1,3);
  for (let leg=0;leg<2;leg++) {
    if (leg) {g.click("nextLeg");g.bot();}
    g.score(180);g.bot();g.score(180);g.bot();g.score(141);
  }
  await new Promise(resolve => setImmediate(resolve));
  g.click("backToLevels");
  const html=g.element("botLevels").innerHTML;
  assert.match(html,/Level 3 · Mystery Bot/); assert.doesNotMatch(html,/Venton Bot/);
  assert.equal((html.match(/Requirements to play/g)||[]).length,1);
  assert.doesNotMatch(html,/Beat Billy Bot in 2 modes/);
  g.click("leaderboardTab");
  assert.equal(g.element("botPageTitle").textContent,"Leaderboard");
  assert.equal(g.element("ladderPanel").hidden,true);
  assert.equal(g.element("leaderboardPanel").hidden,false);
  assert.equal(g.element("leaderboardTab")["aria-selected"],"true");
  g.click("ladderTab");assert.equal(g.element("ladderPanel").hidden,false);
  assert.equal(g.element("botPageTitle").textContent,"Monster Bot Game");
});

test("available avatars appear in the ladder and scorer without leaking into other levels", async () => {
  const wins = E.LEVELS.flatMap(p => E.MODES.map(mode => `${p.level}-${mode}`));
  const scores = Object.fromEntries(E.LEVELS.flatMap(p => E.MODES.map(mode => [`${p.level}-${mode}`, {won:E.legsNeeded(mode),lost:0}])));
  const g = await gameHarness(new Map([["onm-monster-bot-test-member", JSON.stringify(wins)], ["onm-monster-bot-test-member-scores", JSON.stringify(scores)]]));
  assert.match(g.element("botLevels").innerHTML, /venton-bot.png/);
  for (const [level, name] of [[1,"billy"],[2,"croft"],[3,"venton"],[4,"istan"],[5,"nick"],[6,"ricky"],[7,"aussie"],[8,"andre"],[9,"bailey"]]) {
    g.start(level);
    assert.equal(g.element("scorerBotAvatar").src, `graphics/bots/${name}-bot.png?v=20261022-avatar`);
    assert.equal(g.element("scorerBotAvatar").hidden, false);
    g.click("leaveMatch");
  }
  g.start(10);
  assert.equal(g.element("scorerBotAvatar").hidden, false);
  assert.equal(g.element("scorerBotAvatar").src, "graphics/bots/filip-bot.png?v=20261022-avatar");
});

test("match lengths, alternating starters, wins and gold progress survive reload", async () => {
  const g = await gameHarness();
  for (const mode of E.STANDARD_MODES) {
    g.start(1, mode);
    for (let leg = 0; leg < (mode + 1) / 2; leg++) {
      if (leg) {
        g.click("nextLeg");
        assert.match(g.element("turnStatus").textContent,leg%2 ? /Monster is throwing/ : /Your throw/);
        if(leg%2) g.bot();
      }
      g.score(180); g.bot(); g.score(180); g.bot(); g.score(141);
    }
    await new Promise(resolve => setImmediate(resolve));
    assert.match(g.element("turnStatus").textContent, /You win/);
    g.click("backToLevels");
  }
  assert.deepEqual(JSON.parse(g.stored.get("onm-monster-bot-test-member")).sort(), ["1-1", "1-3", "1-5", "1-7"]);
  assert.doesNotMatch(g.element("botLevels").innerHTML, /☑ Complete/);
  assert.match(g.element("progressSummary").textContent, /4 \/ 50 formats won · ★ 4 gold stars/);
  const reloaded = await gameHarness(g.stored);
  assert.match(reloaded.element("progressSummary").textContent, /4 \/ 50 formats won · ★ 4 gold stars/);
});
test("a profile loading failure does not hide a verified signed-in account", async () => {
  const g=await gameHarness();
  assert.doesNotMatch(g.element("botLevels").innerHTML,/Sign up to play/);
  g.start(); assert.equal(g.element("matchTitle").textContent,"You vs Billy Bot");
});
test("auth failures offer retry, never an incorrect sign-up prompt", async () => {
  const g=await gameHarness(new Map(),{uid:"test-member",authError:true});
  assert.doesNotMatch(g.element("botLevels").innerHTML,/Sign up to play/);
  assert.equal(g.element("retryAccount").hidden,false);
  assert.match(g.element("saveStatus").textContent,/could not be checked/);
  g.start(); assert.equal(g.element("matchTitle").textContent,"");
});
test("help links to a separate rules page and obsolete introductory controls are removed", async () => {
  const html=fs.readFileSync(require.resolve("../monster-bot.html"),"utf8");
  assert.match(html,/Monster Bot Game/);assert.match(html,/Bull or Bust/);
  const card=fs.readFileSync(require.resolve("../games.html"),"utf8");
  assert.match(card,/<h2>Monster Bot Game<\/h2>/);
  assert.doesNotMatch(card,/Monster Bot Ladder/);
  assert.match(html,/<a id="openRules" href="monster-bot-help.html"/);
  assert.match(html,/<h2 class="srOnly">Leaderboard<\/h2>/);
  assert.doesNotMatch(html,/id="rulesDialog"|Monster leaderboard/);
  const help=fs.readFileSync(require.resolve("../monster-bot-help.html"),"utf8");
  assert.match(help,/<h1>Game Rules<\/h1>/);assert.match(help,/must finish on the Bullseye/);
  assert.match(help,/class="challengeIconMenu"/);assert.match(help,/href="monster-bot.html#leaderboard"/);
  assert.match(help,/aria-current="page"/);
  assert.match(help,/From Level 2: beat the previous bot in any two modes/);
  assert.match(help,/href="monster-bot.html"/);
  assert.doesNotMatch(html,/id="firstThrow"|10 monsters\. 5 match formats|Alternate first throw/);
});

test("signed-in progress loads and saves only on that user's account", async () => {
  const g = await gameHarness(new Map(), { uid: "test-member", seedWins: ["2-3"] });
  assert.match(g.element("progressSummary").textContent, /1 \/ 50/);
  g.start(); g.score(180); g.bot(); g.score(180); g.bot(); g.score(141);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(g.writes.at(-1).path, "users/test-member");
  assert.ok(Array.from(g.writes.at(-1).data.monsterBotWins).includes("1-1"));
  assert.equal(g.writes.at(-1).data.monsterBotBestScores["1-1"].lost, 0);
  assert.ok(g.stored.has("onm-monster-bot-test-member"));
  assert.equal(g.stored.has("onm-monster-bot-guest"), false);
});

test("invalid scores, busts, undo and abandoned matches never grant victories", async () => {
  const g = await gameHarness(); g.start();
  g.score(179); assert.match(g.element("scoreError").textContent, /possible/); assert.equal(g.element("playerRemaining").textContent, 501);
  g.click("bustVisit"); g.bot(); assert.equal(g.element("playerRemaining").textContent, 501);
  g.score(180); g.bot(); assert.equal(g.element("playerRemaining").textContent, 321);
  g.click("undoVisit"); assert.equal(g.element("playerRemaining").textContent, 501);
  g.click("leaveMatch"); assert.equal(g.stored.size, 0);
});

test("ladder requires any two previous-bot modes and all four formats two levels below", async () => {
  assert.equal(E.LEVELS[0].name, "Billy Bot"); assert.equal(E.LEVELS[9].name, "Filip Bot");
  for (const mode of E.STANDARD_MODES) {
    const wins = new Set([`1-${mode}`]);
    assert.equal(E.isUnlocked(2, wins), false);
    assert.equal(E.isUnlocked(3, wins), false);
  }
  const g = await gameHarness();
  const html = g.element("botLevels").innerHTML;
  assert.ok(html.indexOf("Level 2 · Mystery Bot") < html.indexOf("Billy Bot"));
  assert.doesNotMatch(html,/Croft Bot/);
  assert.equal(html.includes("First 9"), false); assert.equal(html.includes("Checkout:"), false);
  g.start(2);
  assert.equal(g.element("matchTitle").textContent, "");
  g.start(); g.score(180); g.bot(); g.score(180); g.bot(); g.score(141);
  await new Promise(resolve => setImmediate(resolve));
  g.click("backToLevels"); g.start(1, 3);
  for (let leg = 0; leg < 2; leg++) {
    if (leg) { g.click("nextLeg"); g.bot(); }
    g.score(180); g.bot(); g.score(180); g.bot(); g.score(141);
  }
  await new Promise(resolve => setImmediate(resolve));
  g.click("backToLevels"); g.start(2, 3);
  assert.equal(g.element("matchTitle").textContent, "You vs Croft Bot");
  assert.match(g.element("matchFormat").textContent, /Best of 3/);
  for (let level = 3; level <= 10; level++) {
    const wins = new Set([`${level-1}-1`, `${level-1}-3`]);
    assert.equal(E.isUnlocked(level,wins), false);
    for (const mode of E.STANDARD_MODES) wins.add(`${level-2}-${mode}`);
    if (level >= 4) {
      for (const mode of E.STANDARD_MODES) wins.add(`${level-3}-${mode}`);
      assert.equal(E.isUnlocked(level,wins), false);
      wins.add(`${level-3}-${E.BULL_MODE}`);
    }
    const scores = {};
    if (level >= 5) {
      for (const mode of E.MODES) {
        const key = `${level-4}-${mode}`;
        wins.add(key); scores[key] = {won:E.legsNeeded(mode),lost:0};
      }
      assert.equal(E.isUnlocked(level,wins), false);
    }
    if (level >= 3) {
      for (let bot=1;bot<level-1;bot++) for (const mode of E.MODES) wins.add(`${bot}-${mode}`);
      for (const key of [...wins]) scores[key] = {won:E.legsNeeded(Number(key.split("-")[1])),lost:0};
    }
    assert.equal(E.isUnlocked(level,wins,scores), true);
    wins.delete(`${level-1}-3`); assert.equal(E.isUnlocked(level,wins,scores), false);
  }
});
test("levels 5–10 require valid flawless scores in all five formats four levels below", async () => {
  const wins = new Set(E.LEVELS.flatMap(p => E.MODES.map(mode => `${p.level}-${mode}`)));
  for (let level=5;level<=10;level++) {
    const scores = Object.fromEntries(E.MODES.map(mode => [`${level-4}-${mode}`,{won:E.legsNeeded(mode),lost:0}]));
    for (const key of [...wins].slice(0,10+(level-4)*4)) scores[key] = {won:E.legsNeeded(Number(key.split("-")[1])),lost:0};
    assert.equal(E.isUnlocked(level,wins,scores),true);
    for (const mode of E.MODES) {
      const key = `${level-4}-${mode}`, saved = scores[key];
      delete scores[key]; assert.equal(E.isUnlocked(level,wins,scores),false);
      scores[key] = {won:99,lost:0}; assert.equal(E.isUnlocked(level,wins,scores),false);
      scores[key] = {...saved,lost:1}; assert.equal(E.isUnlocked(level,wins,scores),false);
      scores[key] = saved;
      wins.delete(key); assert.equal(E.isUnlocked(level,wins,scores),false); wins.add(key);
    }
  }
  const stored = new Map([["onm-monster-bot-test-member",JSON.stringify([...wins])]]);
  const g = await gameHarness(stored); g.start(5);
  assert.equal(g.element("matchTitle").textContent,"");
  assert.match(g.element("botLevels").innerHTML,/Collect 6 gold stars \(0\/6\)/);
  const scores = Object.fromEntries(E.MODES.map(mode => [`1-${mode}`,{won:E.legsNeeded(mode),lost:0}]));
  for (const key of [...wins].slice(0,14)) scores[key] = {won:E.legsNeeded(Number(key.split("-")[1])),lost:0};
  stored.set("onm-monster-bot-test-member-scores",JSON.stringify(scores));
  const reloaded = await gameHarness(stored); reloaded.start(5);
  assert.equal(reloaded.element("matchTitle").textContent,"You vs Nick Bot");
});
test("Nick Bot requires 14 unique flawless challenges as well as existing requirements", () => {
  const keys = E.LEVELS.slice(0,4).flatMap(p => E.MODES.map(mode => `${p.level}-${mode}`));
  const wins = new Set(keys), scores = {};
  for (const key of keys.slice(0,13)) scores[key] = {won:E.legsNeeded(Number(key.split("-")[1])),lost:0};
  assert.equal(E.goldStars(wins,scores),13);
  assert.equal(E.isUnlocked(5,wins,scores),false);
  scores[keys[13]] = {won:E.legsNeeded(Number(keys[13].split("-")[1])),lost:0};
  assert.equal(E.goldStars(wins,scores),14);
  assert.equal(E.isUnlocked(5,wins,scores),true);
  scores["99-1"] = {won:1,lost:0};
  assert.equal(E.goldStars(wins,scores),14);
  wins.delete("1-9");
  assert.equal(E.isUnlocked(5,wins,scores),false);
});
test("levels three to ten enforce their gold-star threshold on game and leaderboard", () => {
  const {buildLeaderboard} = require("../functions/bot-completions");
  const keys = E.LEVELS.flatMap(p => E.MODES.map(mode => `${p.level}-${mode}`)), wins = new Set(keys);
  for (let level=3;level<=10;level++) {
    const required = 10+(level-4)*4;
    const scores = Object.fromEntries(keys.slice(0,required-1).map(key => [key,{won:E.legsNeeded(Number(key.split("-")[1])),lost:0}]));
    const account = {id:"stars",monsterBotWins:keys,monsterBotBestScores:scores};
    assert.equal(E.isUnlocked(level,wins,scores),false);
    assert.equal(buildLeaderboard([account],new Map())[0].level,level-1);
    const key = keys[required-1]; scores[key] = {won:E.legsNeeded(Number(key.split("-")[1])),lost:0};
    assert.equal(E.isUnlocked(level,wins,scores),true);
    assert.equal(buildLeaderboard([account],new Map())[0].level,level);
  }
});
test("Bull or Bust requires a possible Bull finish and explicit confirmation", async () => {
  const g = await gameHarness(new Map(),{uid:"test-member",seedWins:E.STANDARD_MODES.map(m=>`1-${m}`)}); g.start(1, E.BULL_MODE);
  assert.match(g.element("matchFormat").textContent, /Bull or Bust/);
  g.score(180); g.bot(); g.score(180); g.bot(); g.score(91); g.bot();
  assert.equal(g.element("playerRemaining").textContent, 50);
  g.element("checkoutDarts").value = "1";
  g.score(50);
  assert.equal(g.element("bullCheckoutDialog").open, true);
  assert.equal(g.stored.has("onm-monster-bot-guest"), false);
  g.click("confirmBullCheckout");
  await new Promise(resolve => setImmediate(resolve));
  assert.match(g.element("turnStatus").textContent, /You win 1–0/);
  assert.ok(JSON.parse(g.stored.get("onm-monster-bot-test-member")).includes("1-9"));
  assert.equal(E.validWinningScore("1-9", {won:1,lost:0}), true);
  assert.equal(E.bullCheckoutPossible(100,1), false);
  assert.equal(E.bullCheckoutPossible(170,3), true);
  assert.equal(E.bullCheckoutPossible(180,3), false);
});

test("Bull or Bust below 50, bust and non-Bull checkouts lose without saving", async () => {
  for (const action of ["below", "other", "bust", "impossible", "cancel"]) {
    const g = await gameHarness(new Map(),{uid:"test-member",seedWins:E.STANDARD_MODES.map(m=>`1-${m}`)}); g.start(1, E.BULL_MODE);
    g.score(180); g.bot(); g.score(180); g.bot();
    if (action === "below") g.score(100);
    else if (action === "bust") g.click("bustVisit");
    else {
      g.element("checkoutDarts").value = action === "impossible" ? "1" : "3";
      g.score(141);
      if (action === "cancel") g.element("bullCheckoutDialog").listeners.cancel({preventDefault(){}});
      else g.click(action === "other" ? "otherCheckout" : "confirmBullCheckout");
    }
    assert.match(g.element("turnStatus").textContent, /wins 1–0/);
    assert.equal(g.stored.size, 0);
    assert.equal(g.element("undoVisit").disabled, true);
  }
});

test("best scores retain flawless gold and reject impossible results", () => {
  assert.equal(E.validWinningScore("1-7", {won:4,lost:0}), true);
  assert.equal(E.validWinningScore("1-7", {won:4,lost:1}), true);
  assert.equal(E.validWinningScore("1-7", {won:4,lost:4}), false);
  assert.equal(E.validWinningScore("1-3", {won:4,lost:0}), false);
  assert.deepEqual(E.bestScore({won:4,lost:0},{won:4,lost:1}), {won:4,lost:0});
  assert.deepEqual(E.bestScore({won:4,lost:1},{won:4,lost:0}), {won:4,lost:0});
});
test("common totals are favoured without making big scores common for weak bots", () => {
  const distribution=E.scoringDistribution(42.5,1), probability=score=>distribution.find(row=>row.score===score)?.probability || 0;
  for(const [common,uncommon] of [[60,59],[45,44],[37,36],[26,27],[15,14],[11,10],[7,8]]) assert.ok(probability(common)>probability(uncommon)*5,`${common} should be favoured over ${uncommon}`);
  for(const score of E.BOT_EXCLUDED_SCORES) assert.equal(probability(score),0);
  for(const row of distribution) assert.ok(row.probability>0 && E.possibleScore(row.score));
  const random=seeded(391);let common=0,high=0;
  for(let i=0;i<100000;i++) {
    const visit=E.botVisit(501,0,E.LEVELS[0],random);
    common+=E.COMMON_SCORES.includes(visit.score);high+=visit.score>=140;
    assert.equal(visit.hits.reduce((sum,hit)=>sum+hit,0),visit.score);
    assert.equal(E.BOT_EXCLUDED_SCORES.includes(visit.score),false);
  }
  assert.ok(common>50000);assert.ok(high<100,"Billy must very rarely score 140+");
  const averages=Array.from({length:40},()=>E.simulate(E.LEVELS[0],1,random).average);
  assert.ok(Math.max(...averages)-Math.min(...averages)>10,"individual legs must vary rather than being forced to exactly 35");
});
test("bogey checkouts stay valid as human scoring totals when physically possible",()=>{
  for(const score of [159,162,165,168]) {
    assert.equal(E.possibleScore(score),true);
    assert.equal(E.checkoutPossible(score,3),false);
  }
  for(const score of [163,166,169,172,173,175,176,178,179]) assert.equal(E.possibleScore(score),false);
});
test("each bot finishes legal legs with the requested long-run profile", () => {
  for (const profile of E.LEVELS) {
    const stats = E.simulate(profile, 6000, seeded(200 + profile.level));
    assert.ok(Math.abs(stats.average - profile.average) < 2, `Level ${profile.level}: average ${stats.average}`);
    assert.ok(stats.firstNine >= profile.firstNine[0] && stats.firstNine <= profile.firstNine[1], `First nine ${stats.firstNine}`);
    assert.ok(stats.checkout >= profile.checkout[0] && stats.checkout <= profile.checkout[1], `Checkout ${stats.checkout}`);
    const random = seeded(profile.level);
    for (let leg = 0; leg < 60; leg++) {
      let remaining = 501, thrown = 0;
      while (remaining && thrown < 600) {
        const visit = E.botVisit(remaining, thrown, profile, random);
        assert.equal(E.BOT_EXCLUDED_SCORES.includes(visit.score),false);
        assert.ok(visit.darts >= 1 && visit.darts <= 3);
        if (visit.bust) assert.equal(visit.remaining, remaining);
        else { assert.equal(E.validateVisit(remaining, visit.score, visit.darts), ""); assert.equal(remaining - visit.score, visit.remaining); }
        remaining = visit.remaining; thrown += visit.darts;
      }
      assert.equal(remaining, 0);
    }
  }
});
