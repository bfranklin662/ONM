(function (root) {
  "use strict";
  // 9 is a stable progress identifier, not a best-of-nine match.
  const STANDARD_MODES = [1, 3, 5, 7], BULL_MODE = 9;
  const MODES = [...STANDARD_MODES, BULL_MODE];
  const modeLabel = mode => mode === BULL_MODE ? "Bull or Bust" : `BO${mode}`;
  const legsNeeded = mode => mode === BULL_MODE ? 1 : (mode + 1) / 2;
  const startScore = (level,mode) => mode === BULL_MODE ? 301 : 501;
  const NAMES = ["Billy Bot", "Croft Bot", "Venton Bot", "Istan Bot", "Nick Bot", "Ricky Bot", "Aussie Bot", "Andre Bot", "Bailey Bot", "Filip Bot"];
  const LEVELS = Array.from({ length: 10 }, (_, i) => ({
    level: i + 1, name: NAMES[i], average: 35 + i * 5, firstNine: [40 + i * 5, 45 + i * 5],
    checkout: [7 + i, 15 + i], middle: [39.8, 46.7, 57.4, 68.7, 81.6, 95.2, 114.4, 139, 175, 165][i]
  }));
  const singles = Array.from({ length: 20 }, (_, i) => i + 1);
  const scores = [...new Set([0, ...singles, ...singles.map(n => n * 2), ...singles.map(n => n * 3), 25, 50])];
  const doubles = new Set([...singles.map(n => n * 2), 50]);
  const reachable = [new Set([0])];
  for (let darts = 1; darts <= 3; darts++) reachable[darts] = new Set([...reachable[darts - 1]].flatMap(n => scores.map(s => n + s)));
  function checkoutPossible(total, darts) {
    return Number.isInteger(total) && darts >= 1 && darts <= 3 && [...doubles].some(d => reachable[darts - 1].has(total - d));
  }
  function validateVisit(remaining, score, darts = 3) {
    if (!Number.isInteger(score) || score < 0 || score > 180 || !reachable[3].has(score)) return "Enter a possible three-dart score from 0 to 180.";
    const left = remaining - score;
    if (left < 0 || left === 1) return "That is a bust. Use the Bust button.";
    if (left === 0 && !checkoutPossible(score, darts)) return "That finish is not possible on a double with those darts.";
    return "";
  }
  const bullCheckoutPossible = (total, darts) => Number.isInteger(darts) && darts >= 1 && darts <= 3 && reachable[darts - 1].has(total - 50);
  const possibleScore = score => Number.isInteger(score) && score >= 0 && score <= 180 && reachable[3].has(score);
  const COMMON_SCORES = [180,140,135,121,105,95,85,60,45,37,26,25,15,11,7];
  // User-requested bot exclusions also include several legal scoring totals
  // which are bogey checkouts. Human score validation remains board-accurate.
  const BOT_EXCLUDED_SCORES = [159,162,163,165,166,168,169,172,173,175,176,178,179];
  const common = new Set(COMMON_SCORES), excluded = new Set(BOT_EXCLUDED_SCORES);
  const scoringTotals = [...reachable[3]].filter(s=>!excluded.has(s)).sort((a,b)=>a-b);
  const scoringCache = new Map();
  const commonHits = {180:[60,60,60],140:[60,60,20],135:[60,60,15],121:[60,60,1],105:[60,25,20],95:[60,20,15],85:[60,20,5],60:[20,20,20],45:[15,15,15],37:[20,16,1],26:[20,5,1],25:[20,5,0],15:[5,5,5],11:[5,5,1],7:[5,1,1]};
  const visitHits = new Map(Object.entries(commonHits).map(([s,hits])=>[Number(s),hits]));
  for (const total of scoringTotals) {
    if (visitHits.has(total)) continue;
    outer: for (const a of scores) for (const b of scores) {
      const c=total-a-b;
      if (scores.includes(c)) {visitHits.set(total,[a,b,c]);break outer;}
    }
  }
  function scoringDistribution(target, level) {
    target = Math.max(1,Math.min(175,target));
    const key=`${target}-${level}`;
    if (scoringCache.has(key)) return scoringCache.get(key);
    const spread=20+level*1.6;
    const weights = tilt => scoringTotals.map(score => Math.exp(-Math.pow((score-target)/spread,2)/2 + tilt*(score-target))*(common.has(score)?14:1));
    let low=-1,high=1;
    // Preserve the requested mean while favouring common totals, rather than
    // inflating a weak bot's average with a fixed chance of hitting 180.
    for(let i=0;i<42;i++) {
      const tilt=(low+high)/2,w=weights(tilt),sum=w.reduce((a,b)=>a+b,0);
      const mean=w.reduce((a,b,i)=>a+b*scoringTotals[i],0)/sum;
      if(mean<target)low=tilt;else high=tilt;
    }
    const w=weights((low+high)/2),sum=w.reduce((a,b)=>a+b,0);
    const result=scoringTotals.map((score,i)=>({score,probability:w[i]/sum}));
    scoringCache.set(key,result);return result;
  }
  function scoringVisit(remaining,dartsThrown,profile,random) {
    const target=dartsThrown<9?(profile.firstNine[0]+profile.firstNine[1])/2:profile.middle;
    const distribution=scoringDistribution(target,profile.level);
    const allowed=distribution.filter(row=>remaining-row.score>=2);
    let pick=random()*allowed.reduce((sum,row)=>sum+row.probability,0),total=0;
    for(const row of allowed) {pick-=row.probability;if(pick<=0){total=row.score;break;}}
    return {score:total,remaining:remaining-total,darts:3,bust:false,attempts:0,hits:[...visitHits.get(total)]};
  }
  function botVisit(remaining, dartsThrown, profile, random = Math.random) {
    if (remaining>180) return scoringVisit(remaining,dartsThrown,profile,random);
    const before = remaining, hits = [];
    let attempts = 0;
    for (let dart = 0; dart < 3; dart++) {
      let hit;
      if (doubles.has(remaining) && remaining <= 40 || remaining === 50) {
        attempts++;
        const chance = profile.level === 10 ? 0.23 : profile.checkout[0] / 100 + random() * (profile.checkout[1] - profile.checkout[0]) / 100;
        if (random() < chance) hit = remaining;
        else hit = random() < 0.55 ? 0 : remaining / 2;
      } else if (remaining <= 61) {
        // Set up a favourite double; misses can leave a different finish.
        let target = remaining % 2 ? 1 : Math.min(20, remaining - 32);
        if (target < 1) target = 2;
        hit = random() < 0.75 ? target : (random() < 0.5 ? 0 : 1);
      } else if (remaining <= 120) {
        const setups = scores.filter(s => s > 0 && doubles.has(remaining - s));
        const target = setups.sort((a, b) => Math.abs(remaining - a - 32) - Math.abs(remaining - b - 32))[0];
        hit = target !== undefined && random() < 0.8 ? target : singles[Math.floor(random() * singles.length)];
      } else {
        const target = dartsThrown + dart < 9 ? (profile.firstNine[0] + profile.firstNine[1]) / 2 - Math.max(0, 4 - profile.level * 0.4) : profile.middle;
        const normal = Math.sqrt(-2 * Math.log(Math.max(1e-10, random()))) * Math.cos(2 * Math.PI * random());
        const desired = Math.max(0, Math.min(60, target / 3 + normal * 13));
        hit = scores.reduce((best, value) => Math.abs(value - desired) < Math.abs(best - desired) ? value : best, 0);
      }
      hits.push(hit);
      const left = remaining - hit;
      if (left < 0 || left === 1 || left === 0 && !doubles.has(remaining)) return { score: 0, remaining: before, darts: 3, bust: true, attempts, hits };
      remaining = left;
      if (remaining === 0) return { score: before, remaining: 0, darts: dart + 1, bust: false, attempts, hits };
    }
    return { score: before - remaining, remaining, darts: 3, bust: false, attempts, hits };
  }
  function simulate(profile, legs = 250, random = Math.random) {
    let darts = 0, attempts = 0, firstNine = 0;
    for (let leg = 0; leg < legs; leg++) {
      let left = 501, thrown = 0;
      while (left > 0 && thrown < 600) {
        const visit = botVisit(left, thrown, profile, random);
        if (thrown < 9) firstNine += visit.score;
        left = visit.remaining; thrown += visit.darts; attempts += visit.attempts;
      }
      darts += thrown;
    }
    return { average: legs * 501 * 3 / darts, firstNine: firstNine / legs / 3, checkout: legs / attempts * 100 };
  }
  function isUnlocked(level, wins, bestScores = {}) {
    return level === 1 || MODES.filter(mode => wins.has(`${level - 1}-${mode}`)).length >= 2
      && (level === 2 || STANDARD_MODES.every(mode => wins.has(`${level - 2}-${mode}`)))
      && (level < 4 || MODES.every(mode => wins.has(`${level - 3}-${mode}`)))
      && (level < 5 || MODES.every(mode => {
        const key = `${level - 4}-${mode}`, score = bestScores[key];
        return wins.has(key) && validWinningScore(key, score) && score.lost === 0;
      })) && (level < 3 || goldStars(wins, bestScores) >= 5 + (level - 3) * 4);
  }
  function goldStars(wins, scores = {}) {
    return [...wins].filter(key => validWinningScore(key, scores[key]) && scores[key].lost === 0).length;
  }
  function isFormatUnlocked(level, mode, wins) {
    return MODES.includes(mode) && (mode !== BULL_MODE || STANDARD_MODES.every(format => wins.has(`${level}-${format}`)));
  }
  function validWinningScore(key, score) {
    const [level, mode] = key.split("-").map(Number), needed = legsNeeded(mode);
    return level >= 1 && level <= 10 && MODES.includes(mode) && score && score.won === needed && Number.isInteger(score.lost) && score.lost >= 0 && score.lost < needed;
  }
  function highestUnlocked(wins, scores = {}) {
    let level = 1;
    while (level < 10 && isUnlocked(level + 1, wins, scores)) level++;
    return level;
  }
  const bestScore = (current, next) => !current || next.lost < current.lost ? next : current;
  const api = { MODES, STANDARD_MODES, BULL_MODE, modeLabel, legsNeeded, bullCheckoutPossible, possibleScore, COMMON_SCORES, BOT_EXCLUDED_SCORES, scoringDistribution, LEVELS, isUnlocked, isFormatUnlocked, highestUnlocked, goldStars, validWinningScore, bestScore, checkoutPossible, validateVisit, botVisit, simulate };
  api.startScore = startScore;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MonsterBotEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
