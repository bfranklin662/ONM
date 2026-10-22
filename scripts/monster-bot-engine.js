(function (root) {
  "use strict";
  const MODES = [1, 3, 5, 7];
  const NAMES = ["Billy Bot", "Croft Bot", "Venton Bot", "Istan Bot", "Nick Bot", "Ricky Bot", "Aussie Bot", "Andre Bot", "Bailey Bot", "Filip Bot"];
  const LEVELS = Array.from({ length: 10 }, (_, i) => ({
    level: i + 1, name: NAMES[i], average: 35 + i * 5, firstNine: [40 + i * 5, 45 + i * 5],
    checkout: [7 + i, 15 + i], middle: [37.3, 46.7, 57.4, 68.7, 81.6, 95.2, 114.4, 139, 191, 165][i]
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
  function botVisit(remaining, dartsThrown, profile, random = Math.random) {
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
  const isUnlocked = (level, wins) => level === 1 || wins.has(`${level - 1}-1`) && wins.has(`${level - 1}-3`) && (level === 2 || MODES.every(mode => wins.has(`${level - 2}-${mode}`)));
  function validWinningScore(key, score) {
    const [level, mode] = key.split("-").map(Number), needed = (mode + 1) / 2;
    return level >= 1 && level <= 10 && MODES.includes(mode) && score && score.won === needed && Number.isInteger(score.lost) && score.lost >= 0 && score.lost < needed;
  }
  const bestScore = (current, next) => !current || next.lost < current.lost ? next : current;
  const api = { MODES, LEVELS, isUnlocked, validWinningScore, bestScore, checkoutPossible, validateVisit, botVisit, simulate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MonsterBotEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
