"use strict";
const validWins = new Set(Array.from({ length: 10 }, (_, i) => [1, 3, 5, 7, 9].map(mode => `${i + 1}-${mode}`)).flat());
function buildCompletions(users, profiles) {
  const groups = new Map([...validWins].map(key => [key, new Map()]));
  for (let level = 1; level <= 10; level++) groups.set(`level-${level}`, new Map());
  for (const user of users) {
    const profile = profiles.get(user.linkedPlayerKey);
    const name = typeof profile?.publicName === "string" && profile.publicName.trim() ? profile.publicName.trim().slice(0, 80) : "Player without a linked profile";
    const identity = profile ? `player:${user.linkedPlayerKey}` : `account:${user.id}`;
    for (const win of new Set(Array.isArray(user.monsterBotWins) ? user.monsterBotWins : [])) {
      if (validWins.has(win)) {
        const mode = Number(win.split("-")[1]), needed = mode === 9 ? 1 : (mode + 1) / 2;
        const score = user.monsterBotBestScores?.[win];
        const valid = score?.won === needed && Number.isInteger(score.lost) && score.lost >= 0 && score.lost < needed;
        for (const groupKey of [win, `level-${win.split("-")[0]}`]) {
          const row = groups.get(groupKey).get(identity) || { name, results: [] };
          const previous = row.results.find(r => r.mode === mode);
          const result = { mode, won: valid ? score.won : null, lost: valid ? score.lost : null, flawless: valid && score.lost === 0 };
          if (!previous) row.results.push(result);
          else if (valid && (previous.lost === null || result.lost < previous.lost)) Object.assign(previous, result);
          row.results.sort((a,b) => a.mode - b.mode);
          groups.get(groupKey).set(identity, row);
        }
      }
    }
  }
  return Object.fromEntries([...groups].map(([key, names]) => [key, [...names.values()].sort((a, b) => a.name.localeCompare(b.name))]));
}
module.exports = { buildCompletions };
