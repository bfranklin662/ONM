export const structures = {
  knockout: "Knockout",
  groups: "Group (Round-Robin)",
  combined: "Groups & Knockout"
};

export const bracketSizes = [4, 8, 16, 32, 64, 128];
export const statFields = [
  "legs", "totalScored", "dartsThrown", "firstNineScored", "firstNineDarts",
  "checkoutHits", "checkoutAttempts", "highestOut", "oneEightys", "bullOuts"
];

export function bracketSize(count) {
  return bracketSizes.find(size => size >= count);
}

export function validateSettings(settings) {
  const { structure, capacity, gameType, legsCount, startScore, inMode, groupSize, qualifiers, drawMode } = settings;
  const integerIn = (number, min, max) => Number.isInteger(number) && number >= min && number <= max;
  if (!Object.hasOwn(structures, structure) || !integerIn(capacity, 4, 128) ||
      (structure === "knockout" && !bracketSizes.includes(capacity)) ||
      !["bestOf", "firstTo"].includes(gameType) || !integerIn(legsCount, 1, 19) ||
      (gameType === "bestOf" && legsCount % 2 === 0) ||
      !integerIn(startScore, 2, 9999) || !["straight", "double"].includes(inMode) ||
      (inMode === "double" && startScore < 4) ||
      !["random", "ability"].includes(drawMode)) {
    throw new Error("Check the match settings. Best of needs an odd number of legs.");
  }
  if (structure !== "knockout" && !integerIn(groupSize, 3, 8)) {
    throw new Error("Choose a group size between 3 and 8.");
  }
  if (structure === "combined" && !integerIn(qualifiers, 4, capacity)) {
    throw new Error("Choose between 4 and the player limit for knockout qualifiers.");
  }
}

function shuffle(values, random) {
  const shuffled = [...values];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function makeDraw(tournament, random = Math.random) {
  const { settings, entries, seeds } = tournament;
  validateSettings(settings);
  const players = shuffle(Object.keys(entries), random);
  if (players.length < 4 || players.length > settings.capacity) {
    throw new Error("The tournament needs at least 4 players within the player limit.");
  }
  if (settings.structure === "combined" && settings.qualifiers > players.length) {
    throw new Error("There are fewer entrants than knockout places.");
  }
  if (settings.drawMode === "ability") {
    players.sort((a, b) => (seeds[a] ?? Infinity) - (seeds[b] ?? Infinity));
  }
  if (settings.structure === "knockout") return { order: players, groups: {} };

  const groupCount = Math.ceil(players.length / settings.groupSize);
  const groups = {};
  let offset = 0;
  for (let i = 0; i < groupCount; i++) {
    const size = Math.floor(players.length / groupCount) + Number(i < players.length % groupCount);
    groups[String(i + 1)] = players.slice(offset, offset + size);
    offset += size;
  }
  return { order: players, groups };
}

function groupMatches(group, players) {
  return players.flatMap((a, i) => players.slice(i + 1).map((b, j) => ({
    id: `g${group}-${i}-${i + j + 1}`, a, b
  })));
}

function seedSlots(size) {
  let slots = [1, 2];
  while (slots.length < size) {
    const mirror = slots.length * 2 + 1;
    slots = slots.flatMap(seed => [seed, mirror - seed]);
  }
  return slots;
}

function knockoutRounds(size, order, results) {
  let sources = seedSlots(size).map(seed => order ? order[seed - 1] ?? null : undefined);
  const rounds = [];
  while (sources.length > 1) {
    const matches = [];
    const next = [];
    for (let i = 0; i < sources.length; i += 2) {
      const id = `k${rounds.length + 1}-${i / 2 + 1}`;
      const [a, b] = sources.slice(i, i + 2);
      const result = results[id];
      const ready = Boolean(a && b);
      const bye = a !== undefined && b !== undefined && !ready;
      const winner = result ? (result.winnerIndex === 0 ? a : b) : bye ? a || b : undefined;
      matches.push({ id, a, b, ready, bye, winner, result });
      next.push(winner);
    }
    rounds.push(matches);
    sources = next;
  }
  return rounds;
}

function compareRows(a, b) {
  return b.wins - a.wins || (b.legsFor - b.legsAgainst) - (a.legsFor - a.legsAgainst) ||
    b.legsFor - a.legsFor || a.drawIndex - b.drawIndex;
}

export function tournamentView(tournament) {
  const { settings, draw, results = {} } = tournament;
  if (!draw) return null;

  const players = Object.fromEntries(draw.order.map((id, drawIndex) => [id, {
    id, drawIndex, played: 0, wins: 0, legsFor: 0, legsAgainst: 0,
    ...Object.fromEntries(statFields.map(field => [field, 0]))
  }]));

  function tally(match, table) {
    const { a, b, result } = match;
    if (!result) return;
    [a, b].forEach((id, index) => {
      const row = table[id];
      const stats = result[index === 0 ? "left" : "right"];
      row.played++;
      row.wins += Number(result.winnerIndex === index);
      row.legsFor += stats.legs;
      row.legsAgainst += result[index === 0 ? "right" : "left"].legs;
      for (const field of statFields) {
        row[field] = field === "highestOut" ? Math.max(row[field], stats[field]) : row[field] + stats[field];
      }
    });
  }

  const groups = Object.entries(draw.groups).map(([name, ids]) => {
    const table = Object.fromEntries(ids.map(id => [id, { ...players[id] }]));
    const matches = groupMatches(name, ids).map(match => ({
      ...match, ready: true, result: results[match.id]
    }));
    matches.forEach(match => {
      tally(match, table);
      tally(match, players);
    });
    return { name, matches, rows: Object.values(table).sort(compareRows) };
  });

  const groupsDone = groups.every(group => group.matches.every(match => match.result));
  let rounds = [];
  let qualified = [];
  if (settings.structure === "knockout") {
    rounds = knockoutRounds(settings.capacity, draw.order, results);
  } else if (settings.structure === "combined") {
    if (groupsDone) {
      qualified = groups.flatMap(group => group.rows.map((row, place) => ({ ...row, place })))
        .sort((a, b) => a.place - b.place || b.wins / b.played - a.wins / a.played ||
          (b.legsFor - b.legsAgainst) / b.played - (a.legsFor - a.legsAgainst) / a.played ||
          b.legsFor / b.played - a.legsFor / a.played || a.drawIndex - b.drawIndex)
        .slice(0, settings.qualifiers).map(row => row.id);
    }
    rounds = knockoutRounds(bracketSize(settings.qualifiers), groupsDone ? qualified : null, results);
  }

  rounds.flat().forEach(match => tally(match, players));
  const winners = rounds.length
    ? [rounds.at(-1)[0].winner].filter(Boolean)
    : groupsDone ? groups.map(group => group.rows[0].id) : [];
  return {
    groups, rounds, winners, qualified, players: Object.values(players),
    matches: [...groups.flatMap(group => group.matches), ...rounds.flat()],
    complete: winners.length > 0
  };
}

export function makeResult(settings, winnerIndex, players, submissionId) {
  const target = settings.gameType === "bestOf" ? Math.floor(settings.legsCount / 2) + 1 : settings.legsCount;
  if (![0, 1].includes(winnerIndex) || players.length !== 2 ||
      players[winnerIndex].legs !== target || players[1 - winnerIndex].legs >= target) {
    throw new Error("The match must be completed before saving.");
  }
  const [left, right] = players.map(player => Object.fromEntries(statFields.map(field => {
    const value = player[field];
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid match statistics.");
    return [field, value];
  })));
  return { winnerIndex, left, right, submissionId };
}

const doubles = [...Array.from({ length: 20 }, (_, i) => (i + 1) * 2), 50];
const dartScores = [0, 25, ...new Set([
  ...doubles, ...Array.from({ length: 20 }, (_, i) => i + 1),
  ...Array.from({ length: 20 }, (_, i) => (i + 1) * 3)
])];

export function validDoubleInVisit(score) {
  return score === 0 || doubles.some(first => dartScores.some(second => dartScores.includes(score - first - second)));
}

export function doubleInCheckout(score) {
  const twoDarts = doubles.some(first => doubles.includes(score - first));
  const threeDarts = doubles.some(first => doubles.some(last => dartScores.includes(score - first - last)));
  const bull = darts => doubles.some(first => darts === 2
    ? score === first + 50 : dartScores.includes(score - first - 50));
  const other = darts => doubles.slice(0, -1).some(last => doubles.some(first => darts === 2
    ? score === first + last : dartScores.includes(score - first - last)));
  return { darts: twoDarts ? [2, 3] : threeDarts ? [3] : [], bull, other };
}
