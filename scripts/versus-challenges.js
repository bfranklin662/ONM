(function (root) {
  "use strict";

  const cooldown = 24 * 60 * 60 * 1000;
  const monthFormat = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", timeZone: "Europe/London"
  });
  const pools = {
    Easy: [
      ["win1", "Win an online match", "wins", 1],
      ["invite4", "Challenge 4 different players", "invites", 4],
      ["out60", "Hit a 60+ checkout", "checkout", 60],
      ["score100", "Score 100+", "score", 100]
    ],
    Medium: [
      ["streak2", "Win 2 online matches in a row", "streak", 2],
      ["win3", "Win 3 online matches", "wins", 3],
      ["out80", "Hit an 80+ checkout", "checkout", 80]
    ],
    Hard: [
      ["streak3", "Win 3 online matches in a row", "streak", 3],
      ["out100", "Hit a ton+ checkout", "checkout", 100],
      ["bull", "Hit a bull-out", "bull", 1],
      ["score180", "Hit a 180", "score", 180],
      ["win5", "Win 5 online matches", "wins", 5]
    ]
  };

  function monthKey(time) {
    const parts = monthFormat.formatToParts(time);
    return parts.find(part => part.type === "year").value + "-" + parts.find(part => part.type === "month").value;
  }

  function hash(value) {
    let number = 2166136261;
    for (const char of value) number = Math.imul(number ^ char.charCodeAt(0), 16777619);
    return (number ^ (number >>> 16)) >>> 0;
  }

  function eventsFor(playerKey, matches, invites, now) {
    const matchesSeen = new Set();
    const events = [];
    for (const match of matches) {
      if (match.matchMode !== "online" || match.mode === "bot" || match.botMode || match.casual || match.forfeitByKey) continue;
      const first = match.playerOneId === playerKey;
      if (!first && match.playerTwoId !== playerKey) continue;
      const time = Date.parse(match.dateTime || "") || Number(match.createdAt?.toMillis?.() ?? match.createdAt);
      const won = String(match.playerOneWon).toLowerCase() === "true";
      const otherWon = String(match.playerTwoWon).toLowerCase() === "true";
      if (!Number.isFinite(time) || time > now || won === otherWon || match.playerOneId === match.playerTwoId) continue;
      if (match.matchId && matchesSeen.has(match.matchId)) continue;
      if (match.matchId) matchesSeen.add(match.matchId);
      const prefix = first ? "playerOne" : "playerTwo";
      events.push({ time, won: first ? won : otherWon, checkout: Number(match[prefix + "HighestOut"]) || 0,
        score: Number(match[prefix + "HighScore"]) || 0, bull: Number(match[prefix + "BullOuts"]) || 0 });
    }
    for (const invite of invites) {
      const time = Number(invite.createdAt);
      if (invite.fromPlayerKey === playerKey && invite.toPlayerKey && invite.toPlayerKey !== playerKey &&
          Number.isFinite(time) && time > 0 && time <= now) events.push({ time, opponent: invite.toPlayerKey });
    }
    return events.sort((a, b) => a.time - b.time);
  }

  function tierState(difficulty, challenges, events, now, reward) {
    let index = 0;
    let availableAt = 0;
    let value = 0;
    const opponents = new Set();
    for (const event of events) {
      const challenge = challenges[index];
      if (!challenge) break;
      if (event.time < availableAt) continue;
      const [, , metric, target] = challenge;
      if (metric === "invites") {
        if (event.opponent) opponents.add(event.opponent);
        value = opponents.size;
      } else if (!event.opponent) {
        if (metric === "wins") value += Number(event.won);
        else if (metric === "streak") value = event.won ? value + 1 : 0;
        else value = Math.max(value, event[metric]);
      }
      if (value >= target) {
        index++;
        availableAt = event.time + cooldown;
        value = 0;
        opponents.clear();
      }
    }
    const active = now >= availableAt ? challenges[index] : null;
    return {
      difficulty, reward, completed: index, availableAt: index < challenges.length && !active ? availableAt : 0,
      active: active ? { label: active[1], target: active[3], value } : null
    };
  }

  function challengesFor(playerKey, matches = [], invites = [], now = Date.now()) {
    const currentMonth = monthKey(now);
    const grouped = new Map([[currentMonth, []]]);
    for (const event of eventsFor(playerKey, matches, invites, now)) {
      const month = monthKey(event.time);
      if (month < "2026-11") continue;
      if (!grouped.has(month)) grouped.set(month, []);
      grouped.get(month).push(event);
    }
    let coins = 0;
    let tiers = [];
    for (const [month, events] of grouped) {
      const states = Object.entries(pools).map(([difficulty, pool], index) => {
        const seed = playerKey + "/" + month + "/" + difficulty;
        const selected = [...pool].sort((a, b) => hash(a[0] + "/" + seed) - hash(b[0] + "/" + seed)).slice(0, 3);
        return tierState(difficulty, selected, events, now, index + 1);
      });
      coins += states.reduce((total, state) => total + state.completed * state.reward, 0);
      if (month === currentMonth) tiers = states;
    }
    return { coins, tiers, completed: tiers.reduce((total, tier) => total + tier.completed, 0) };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { challengesFor };
  else root.ONMVersusChallenges = { challengesFor };
})(typeof window !== "undefined" ? window : globalThis);
