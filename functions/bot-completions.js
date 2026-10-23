"use strict";
const validWins = new Set(Array.from({ length: 10 }, (_, i) => [1, 3, 5, 7, 9].map(mode => `${i + 1}-${mode}`)).flat());
function displayName(user,profile) {
  if (typeof profile?.publicName === "string" && profile.publicName.trim()) return profile.publicName.trim().slice(0,80);
  return typeof user.firstName === "string" && user.firstName.trim() ? user.firstName.trim().slice(0,80) : "Player";
}
function buildCompletions(users, profiles) {
  const groups = new Map([...validWins].map(key => [key, new Map()]));
  for (let level = 1; level <= 10; level++) groups.set(`level-${level}`, new Map());
  for (const user of users) {
    const profile = profiles.get(user.linkedPlayerKey);
    const name = displayName(user,profile);
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
function buildLeaderboard(users, profiles) {
  const players = new Map(), modes = [1,3,5,7,9];
  for (const user of users) {
    const wins = (Array.isArray(user.monsterBotWins) ? user.monsterBotWins : []).filter(k => validWins.has(k));
    if (!user.monsterBotStarted && !wins.length) continue;
    const profile = profiles.get(user.linkedPlayerKey);
    const identity = profile ? `player:${user.linkedPlayerKey}` : `account:${user.id}`;
    const name = displayName(user,profile);
    const row = players.get(identity) || { name, wins:new Set(), scores:{} };
    for (const key of wins) {
      row.wins.add(key);
      const mode = Number(key.split("-")[1]), needed = mode === 9 ? 1 : (mode+1)/2, score = user.monsterBotBestScores?.[key];
      if (score?.won === needed && Number.isInteger(score.lost) && score.lost >= 0 && score.lost < needed && (!row.scores[key] || score.lost < row.scores[key].lost)) row.scores[key] = {won:score.won,lost:score.lost};
    }
    players.set(identity,row);
  }
  return [...players.values()].map(row => {
    const won = (level, formats) => formats.every(mode => row.wins.has(`${level}-${mode}`));
    const flawless = Object.values(row.scores).filter(score => score.lost === 0).length;
    let level=1;
    for (let next=2;next<=10;next++) {
      if (modes.filter(mode => row.wins.has(`${next-1}-${mode}`)).length < 2 || next>=3 && !won(next-2,[1,3,5,7]) || next>=4 && !won(next-3,modes) || next>=5 && !modes.every(mode => row.wins.has(`${next-4}-${mode}`) && row.scores[`${next-4}-${mode}`]?.lost === 0)) break;
      if (next >= 4 && flawless < 10 + (next - 4) * 4) break;
      level=next;
    }
    return {name:row.name,level,completed:row.wins.size,flawless};
  }).sort((a,b) => b.completed-a.completed || b.level-a.level || a.name.localeCompare(b.name));
}
module.exports = { buildCompletions, buildLeaderboard };
