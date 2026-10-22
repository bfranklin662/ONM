"use strict";
const validWins = new Set(Array.from({ length: 10 }, (_, i) => [1, 3, 5, 7].map(mode => `${i + 1}-${mode}`)).flat());
function buildCompletions(users, profiles) {
  const groups = new Map([...validWins].map(key => [key, new Map()]));
  for (let level = 1; level <= 10; level++) groups.set(`level-${level}`, new Map());
  for (const user of users) {
    const profile = profiles.get(user.linkedPlayerKey);
    const name = typeof profile?.publicName === "string" && profile.publicName.trim() ? profile.publicName.trim().slice(0, 80) : "Player without a linked profile";
    const identity = profile ? `player:${user.linkedPlayerKey}` : `account:${user.id}`;
    for (const win of new Set(Array.isArray(user.monsterBotWins) ? user.monsterBotWins : [])) {
      if (validWins.has(win)) {
        groups.get(win).set(identity, name);
        groups.get(`level-${win.split("-")[0]}`).set(identity, name);
      }
    }
  }
  return Object.fromEntries([...groups].map(([key, names]) => [key, [...names.values()].sort((a, b) => a.localeCompare(b))]));
}
module.exports = { buildCompletions };
