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

async function gameHarness(stored = new Map(), account = { uid: "test-member" }) {
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
    window: { MonsterBotEngine: { ...E, botVisit: (remaining) => ({ remaining, score: 0, darts: 3, attempts: 0, hits: [0, 0, 0] }) }, ONMFirebase: {
      currentFirebaseUser: async () => { if (account?.authError) throw new Error("Auth unavailable"); return account; },
      loadOwnUser: async () => { throw new Error("Profile could not be loaded"); },
      ready: Promise.resolve({ auth: {}, authSdk: { onAuthStateChanged: (_auth, fn) => { authCallback = fn; } }, db: {}, firestoreSdk: {
        doc: (_db, collection, uid) => `${collection}/${uid}`,
        getDoc: async () => ({ data: () => ({ monsterBotWins: account?.seedWins || [] }) }),
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
  }
});
test("cards show flawless format counts beside wins, excluding missing and invalid scores",async()=>{
  const wins=["1-1","1-3","1-5","1-7"];
  const scores={"1-1":{won:1,lost:0},"1-3":{won:2,lost:0},"1-5":{won:3,lost:1},"1-7":{won:99,lost:0},"1-9":{won:1,lost:0}};
  const stored=new Map([["onm-monster-bot-test-member",JSON.stringify(wins)],["onm-monster-bot-test-member-scores",JSON.stringify(scores)]]);
  const g=await gameHarness(stored);
  assert.match(g.element("botLevels").innerHTML,/✓ Beaten 4\/5<\/span><span class="gold flawlessCount">★ Flawless 2\/5/);
  const noScores=await gameHarness(new Map([["onm-monster-bot-test-member",JSON.stringify(["1-3"])]]));
  assert.match(noScores.element("botLevels").innerHTML,/✓ Beaten 1\/5<\/span><span class="gold flawlessCount">★ Flawless 0\/5/);
});
test("dropdown selects the next unbeaten format and ticks completed formats",async()=>{
  for (let count=0;count<=E.MODES.length;count++) {
    const wins=E.MODES.slice(0,count).map(mode=>`1-${mode}`);
    const g=await gameHarness(new Map([["onm-monster-bot-test-member",JSON.stringify(wins)]]));
    const select=g.element("botLevels").innerHTML.match(/<select id="bot-mode-1"[^>]*>(.*?)<\/select>/)[1];
    const next=E.MODES[count]||E.MODES[0];
    assert.match(select,new RegExp(`<option value="${next}" selected[^>]*>`));
    if(count<4) assert.match(select,/<option value="9"[^>]*disabled>Bull or Bust 🔒/);
    if(count===4) assert.match(g.element("botLevels").innerHTML,/<p id="bot-mode-rules-1" class="bullModeRules" >Bull or Bust/);
    for (const mode of E.MODES.slice(0,count)) assert.match(select,new RegExp(`>✓ ${E.modeLabel(mode)}</option>`));
  }
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

test("requirements remain visible after unlocking and signing out stops play", async () => {
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
  assert.match(html,/Venton Bot/); assert.doesNotMatch(html,/Istan Bot/);
  assert.equal((html.match(/Requirements to play/g)||[]).length,2);
  g.click("leaderboardTab");
  assert.equal(g.element("ladderPanel").hidden,true);
  assert.equal(g.element("leaderboardPanel").hidden,false);
  assert.equal(g.element("leaderboardTab")["aria-selected"],"true");
  g.click("ladderTab");assert.equal(g.element("ladderPanel").hidden,false);
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
  assert.match(g.element("progressSummary").textContent, /4 \/ 50 formats won · 0 \/ 10 levels complete/);
  const reloaded = await gameHarness(g.stored);
  assert.match(reloaded.element("progressSummary").textContent, /4 \/ 50 formats won · 0 \/ 10 levels complete/);
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
test("rules popup opens and closes, and obsolete introductory controls are removed", async () => {
  const g=await gameHarness();g.click("openRules");
  assert.equal(g.element("rulesDialog").open,true);g.click("closeRules");
  assert.equal(g.element("rulesDialog").open,false);
  const html=fs.readFileSync(require.resolve("../monster-bot.html"),"utf8");
  assert.match(html,/Monster Bot Ladder/);assert.match(html,/Bull or Bust/);
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
  assert.ok(html.indexOf("Croft Bot") < html.indexOf("Billy Bot"));
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
    assert.equal(E.isUnlocked(level,wins,scores), true);
    wins.delete(`${level-1}-3`); assert.equal(E.isUnlocked(level,wins,scores), false);
  }
});
test("levels 5–10 require valid flawless scores in all five formats four levels below", async () => {
  const wins = new Set(E.LEVELS.flatMap(p => E.MODES.map(mode => `${p.level}-${mode}`)));
  for (let level=5;level<=10;level++) {
    const scores = Object.fromEntries(E.MODES.map(mode => [`${level-4}-${mode}`,{won:E.legsNeeded(mode),lost:0}]));
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
  assert.match(g.element("botLevels").innerHTML,/flawless wins in all five Billy Bot formats/);
  const scores = Object.fromEntries(E.MODES.map(mode => [`1-${mode}`,{won:E.legsNeeded(mode),lost:0}]));
  stored.set("onm-monster-bot-test-member-scores",JSON.stringify(scores));
  const reloaded = await gameHarness(stored); reloaded.start(5);
  assert.equal(reloaded.element("matchTitle").textContent,"You vs Nick Bot");
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
