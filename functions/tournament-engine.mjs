export const structures = {
  knockout: "Knockout",
  groups: "Group (Round-Robin)",
  combined: "Groups & Knockout"
};

export const playModes = { online: "Online", inPerson: "In person" };
export const maxBoards = 64;
export const maxDummyEntrants = 512;
export const laterRoundLegs = { 8: "quarterFinalLegs", 4: "semiFinalLegs", 2: "finalLegs" };

export const bracketSizes = [4, 8, 16, 32, 64, 128];
export const statFields = [
  "legs", "totalScored", "dartsThrown", "firstNineScored", "firstNineDarts",
  "checkoutHits", "checkoutAttempts", "highestOut", "oneEightys", "bullOuts"
];

export function bracketSize(count) {
  return Number.isSafeInteger(count) && count >= 2 ? 2 ** Math.ceil(Math.log2(count)) : undefined;
}

export function entryCapacity(settings) {
  return settings.playMode === "inPerson" ? null : settings.capacity;
}

export function tournamentStartTime(tournament) {
  const startedAt = tournament.startedAt?.toMillis?.() ?? 0;
  const delay = tournament.settings.playMode === "online" ? tournament.settings.startDelayMinutes ?? 0 : 0;
  if (startedAt) return startedAt + delay * 60_000;
  return delay && tournament.status === "live" ? Infinity : 0;
}

export function countdownLabel(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function validateSettings(settings) {
  const { structure, capacity, gameType, legsCount, startScore, inMode, groupSize, qualifiers, drawMode, playMode } = settings;
  if (playMode !== undefined && (typeof playMode !== "string" || !Object.hasOwn(playModes, playMode))) {
    throw new Error("Choose Online or In person.");
  }
  const integerIn = (number, min, max) => Number.isInteger(number) && number >= min && number <= max;
  if (settings.firstThrow !== undefined && !["bull", "coin", "random"].includes(settings.firstThrow)) {
    throw new Error("Choose how to decide the first throw.");
  }
  if (settings.startDelayMinutes !== undefined &&
      (playMode !== "online" || !integerIn(settings.startDelayMinutes, 0, 60))) {
    throw new Error("Choose an online start countdown between 0 and 60 minutes.");
  }
  if (settings.boardCount !== undefined && (playMode === "online" || !integerIn(settings.boardCount, 1, maxBoards))) {
    throw new Error(`Choose between 1 and ${maxBoards} boards for an in-person tournament.`);
  }
  if (!Object.hasOwn(structures, structure) || (capacity === null ? playMode !== "inPerson" : !integerIn(capacity, 4, 128)) ||
      (structure === "knockout" && capacity !== null && !bracketSizes.includes(capacity)) ||
      !["bestOf", "firstTo"].includes(gameType) || !integerIn(legsCount, 1, 19) ||
      (gameType === "bestOf" && structure !== "groups" && legsCount % 2 === 0) ||
      !integerIn(startScore, 2, 9999) || !["straight", "double"].includes(inMode) ||
      (inMode === "double" && startScore < 4) ||
      !["random", "ability"].includes(drawMode)) {
    throw new Error("Check the match settings. Best of needs an odd number of legs.");
  }
  if (settings.groupLegs !== undefined && (structure === "knockout" || !integerIn(settings.groupLegs, 1, 19))) {
    throw new Error("Choose between 1 and 19 legs for group matches.");
  }
  for (const field of Object.values(laterRoundLegs)) {
    const count = settings[field];
    if (count !== undefined && (structure === "groups" || !integerIn(count, 1, 19) || (gameType === "bestOf" && count % 2 === 0))) {
      throw new Error("Choose valid legs for the knockout rounds. Best of needs an odd number.");
    }
  }
  if (structure !== "knockout" && !integerIn(groupSize, 3, 8)) {
    throw new Error("Choose a group size between 3 and 8.");
  }
  if (settings.plate !== undefined && (typeof settings.plate !== "boolean" || (settings.plate && structure !== "combined"))) {
    throw new Error("The Plate requires Groups & Knockout.");
  }
  if (structure === "combined" && !integerIn(qualifiers, 4, entryCapacity(settings) ?? Number.MAX_SAFE_INTEGER)) {
    throw new Error("Choose between 4 and the player limit for knockout qualifiers.");
  }
  const limit = entryCapacity(settings);
  if (settings.plate && limit !== null && qualifiers + 2 > limit) {
    throw new Error("Leave room for at least two Plate players within the player limit.");
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
  const capacity = entryCapacity(settings);
  if (players.length < 4 || (capacity !== null && players.length > capacity)) {
    throw new Error("The tournament needs at least 4 players within the player limit.");
  }
  if (settings.structure === "combined" && settings.qualifiers > players.length) {
    throw new Error("There are fewer entrants than knockout places.");
  }
  if (settings.plate && players.length - settings.qualifiers < 2) {
    throw new Error("The Plate needs at least two players who do not qualify for the main bracket.");
  }
  if (settings.drawMode === "ability") {
    players.sort((a, b) => (seeds[a] ?? Infinity) - (seeds[b] ?? Infinity));
  }
  if (settings.structure === "knockout") {
    return { order: players, groups: {}, bracketSize: capacity ?? bracketSize(players.length) };
  }

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

function knockoutRounds(size, order, results, prefix = "k", openingLabels = []) {
  const seeds = seedSlots(size);
  let sources = seeds.map(seed => order ? order[seed - 1] ?? null : undefined);
  const rounds = [];
  while (sources.length > 1) {
    const matches = [];
    const next = [];
    for (let i = 0; i < sources.length; i += 2) {
      const id = `${prefix}${rounds.length + 1}-${i / 2 + 1}`;
      const [a, b] = sources.slice(i, i + 2);
      const result = results[id];
      const ready = Boolean(a && b);
      const bye = a !== undefined && b !== undefined && !ready;
      const winner = result ? (result.winnerIndex === 0 ? a : b) : bye ? a || b : undefined;
      matches.push({ id, a, b, ready, bye, winner, result, roundSize: sources.length,
        openingLabels: rounds.length === 0 ? seeds.slice(i, i + 2).map(seed => openingLabels[seed - 1]) : undefined });
      next.push(winner);
    }
    rounds.push(matches);
    sources = next;
  }
  return rounds;
}

function crossoverOrder(entries, groupCount) {
  const size = bracketSize(entries.length);
  const order = [...entries].sort((a, b) => a.place - b.place || a.groupIndex - b.groupIndex);
  const opponents = order.slice(size / 2);
  for (let seed = 1; seed <= size / 2; seed++) {
    const opponentSeed = size + 1 - seed;
    if (opponentSeed > entries.length) continue;
    const group = order[seed - 1].groupIndex;
    const nextGroup = (group + 1) % groupCount;
    let index = opponents.findIndex(entry => entry.groupIndex === nextGroup);
    if (index < 0) index = opponents.findIndex(entry => entry.groupIndex !== group);
    order[opponentSeed - 1] = opponents.splice(Math.max(0, index), 1)[0];
  }
  return order;
}

function openingSlotLabel(entry) {
  if (entry.wildcard) return "Best remaining qualifier";
  if (entry.group == null) return "Remaining group player";
  if (entry.place === 1) return `Winner G${entry.group}`;
  if (entry.place === 2) return `Runner-up G${entry.group}`;
  return `G${entry.group} · Place ${entry.place}`;
}

export const groupPoints = row => 3 * row.wins + row.draws;
const legDifference = row => row.legsFor - row.legsAgainst;
const scoringAverage = row => row.dartsThrown ? 3 * row.totalScored / row.dartsThrown : 0;
const legacyPoints = row => 2 * row.wins + row.draws;

function compareRows(a, b) {
  return groupPoints(b) - groupPoints(a) || legDifference(b) - legDifference(a) ||
    scoringAverage(b) - scoringAverage(a) || a.drawIndex - b.drawIndex;
}

export function tournamentView(tournament) {
  const { settings, draw, results = {} } = tournament;
  if (!draw) return null;

  const players = Object.fromEntries(draw.order.map((id, drawIndex) => [id, {
    id, drawIndex, played: 0, wins: 0, draws: 0, legsFor: 0, legsAgainst: 0,
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
      row.draws += Number(result.winnerIndex === -1);
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
  let plateRounds = [];
  let qualified = [];
  let projectedQualified = [];
  const groupOrigins = {};
  if (settings.structure === "knockout") {
    rounds = knockoutRounds(draw.bracketSize ?? settings.capacity ?? bracketSize(draw.order.length), draw.order, results);
  } else if (settings.structure === "combined") {
    let plateOrder;
    let mainOrder;
    const savedKnockout = Object.entries(results).filter(([id]) => /^[kp]/.test(id));
    const keepOldPairings = savedKnockout.some(([, result]) => result.pairingVersion !== 1);
    if (groupsDone || groups.some(group => group.matches.some(match => match.result))) {
      // Earlier results did not record the new standings version. Keep their knockout pairings intact.
      const legacyDraw = savedKnockout.some(([, result]) => result.standingsVersion !== 2);
      const points = legacyDraw ? legacyPoints : groupPoints;
      const ranked = groups.flatMap(group => {
        const rows = legacyDraw ? [...group.rows].sort((a, b) => points(b) - points(a) ||
          legDifference(b) - legDifference(a) || b.legsFor - a.legsFor || a.drawIndex - b.drawIndex) : group.rows;
        return rows.map((row, place) => {
          if (groupsDone) groupOrigins[row.id] = { group: group.name, place: place + 1 };
          return { ...row, place };
        });
      })
        .sort((a, b) => a.place - b.place || points(b) / (b.played || 1) - points(a) / (a.played || 1) ||
          legDifference(b) / (b.played || 1) - legDifference(a) / (a.played || 1) ||
          (legacyDraw ? b.legsFor / b.played - a.legsFor / a.played : scoringAverage(b) - scoringAverage(a)) ||
          a.drawIndex - b.drawIndex)
        .map(row => row.id);
      if (groupsDone) {
        qualified = ranked.slice(0, settings.qualifiers);
        mainOrder = qualified;
        plateOrder = ranked.slice(settings.qualifiers);
      } else {
        projectedQualified = ranked.slice(0, settings.qualifiers);
      }
    }
    const slots = groups.flatMap((group, groupIndex) =>
      group.rows.map((_, index) => ({ group: group.name, groupIndex, place: index + 1 })))
      .sort((a, b) => a.place - b.place || a.groupIndex - b.groupIndex);
    const cutoff = slots[settings.qualifiers - 1]?.place;
    const partial = slots[settings.qualifiers]?.place === cutoff;
    const projectedSlots = slots.map((slot, index) => partial && slot.place === cutoff
      ? { place: slot.place, groupIndex: groups.length, wildcard: index < settings.qualifiers }
      : slot);
    const bracket = (count, players, positions, prefix) => {
      if (keepOldPairings) return knockoutRounds(bracketSize(count), players, results, prefix);
      const order = crossoverOrder(positions, groups.length);
      const remaining = groupsDone && partial ? players.filter(id => groupOrigins[id].place === cutoff)
        .sort((a, b) => Number(groupOrigins[a].group) - Number(groupOrigins[b].group)) : [];
      const confirmed = groupsDone ? order.map(entry => entry.group == null ? remaining.shift() :
        players.find(id => groupOrigins[id].group === entry.group && groupOrigins[id].place === entry.place)) : null;
      return knockoutRounds(bracketSize(count), confirmed, results,
        prefix, groupsDone ? [] : order.map(openingSlotLabel));
    };
    rounds = bracket(settings.qualifiers, mainOrder, projectedSlots.slice(0, settings.qualifiers), "k");
    if (settings.plate) plateRounds = bracket(draw.order.length - settings.qualifiers, plateOrder,
      projectedSlots.slice(settings.qualifiers), "p");
  }

  const knockoutMatches = [...rounds.flat(), ...plateRounds.flat()];
  knockoutMatches.forEach(match => tally(match, players));
  const winners = rounds.length
    ? [rounds.at(-1)[0].winner].filter(Boolean)
    : groupsDone ? groups.map(group => group.rows[0].id) : [];
  const plateWinner = plateRounds.at(-1)?.[0].winner;
  return {
    groups, groupsDone, groupOrigins, rounds, plateRounds, winners, plateWinner, qualified, projectedQualified, players: Object.values(players),
    matches: [...groups.flatMap(group => group.matches), ...knockoutMatches],
    complete: winners.length > 0 && (!plateRounds.length || Boolean(plateWinner))
  };
}

export function fixtureSchedule(view, settings) {
  const boardCount = settings.playMode === "online" ? 0 : settings.boardCount ?? 1;
  const fixtures = [];
  const waves = [];
  const lastWave = new Map();
  for (const group of view.groups) {
    for (const match of group.matches) {
      let wave = 1 + Math.max(lastWave.get(match.a) ?? -1, lastWave.get(match.b) ?? -1);
      while (boardCount && waves[wave] === boardCount) wave++;
      waves[wave] = (waves[wave] ?? 0) + 1;
      const fixture = { match, stage: `Group ${group.name}`, wave: wave + 1 };
      if (boardCount) fixture.board = waves[wave];
      lastWave.set(match.a, wave);
      lastWave.set(match.b, wave);
      fixtures.push(fixture);
    }
  }
  let nextWave = waves.length + 1;
  const entrants = settings.structure === "combined" ? settings.qualifiers : view.players.length;
  function scheduleBracket(rounds, count, prefix) {
    if (!rounds.length) return;
    let occupied = seedSlots(rounds[0].length * 2).map(seed => seed <= count);
    for (const round of rounds) {
      const stage = prefix + (round.length === 1 ? "Final" : `Round of ${2 * round.length}`);
      const playable = round.filter((_, index) => occupied[2 * index] && occupied[2 * index + 1]);
      playable.forEach((match, index) => {
        const assignment = boardCount
          ? { wave: nextWave + Math.floor(index / boardCount), board: index % boardCount + 1 }
          : { wave: nextWave };
        fixtures.push({ match, stage, ...assignment });
      });
      if (playable.length) nextWave += boardCount ? Math.ceil(playable.length / boardCount) : 1;
      occupied = round.map((_, index) => occupied[2 * index] || occupied[2 * index + 1]);
    }
  }
  scheduleBracket(view.rounds, entrants, "");
  scheduleBracket(view.plateRounds, view.players.length - entrants, "Plate · ");
  fixtures.sort((a, b) => (a.wave ?? 0) - (b.wave ?? 0) || (a.board ?? 0) - (b.board ?? 0));
  const queuedBoards = new Set();
  const queuedPlayers = new Set();
  return fixtures.map(fixture => {
    const { match, board } = fixture;
    if (match.result) return fixture;
    const players = [match.a, match.b].filter(Boolean);
    const waitingFor = !match.ready ? "players"
      : queuedBoards.has(board) ? "board"
      : players.some(id => queuedPlayers.has(id)) ? "previous match"
      : null;
    if (board) queuedBoards.add(board);
    players.forEach(id => queuedPlayers.add(id));
    return { ...fixture, available: waitingFor === null, waitingFor };
  });
}

function legsToWin(settings) {
  return settings.gameType === "bestOf" ? Math.floor(settings.legsCount / 2) + 1 : settings.legsCount;
}

export function matchSettings(settings, match, playedFormat) {
  const group = match.id.startsWith("g");
  const gameType = playedFormat ? playedFormat.gameType : settings.gameType;
  const legsCount = playedFormat ? playedFormat.legsCount :
    (group ? settings.groupLegs : settings[laterRoundLegs[match.roundSize]]) ?? settings.legsCount;
  if (playedFormat && (!["bestOf", "firstTo"].includes(gameType) || !Number.isInteger(legsCount) ||
    legsCount < 1 || legsCount > 19 || (!group && gameType === "bestOf" && legsCount % 2 === 0))) {
    throw new Error("The saved match format is invalid.");
  }
  return { ...settings, gameType, legsCount, allowDraw: group && gameType === "bestOf" && legsCount % 2 === 0 };
}

export function matchOutcome(settings, players) {
  const target = legsToWin(settings);
  const [left, right] = players.map(player => player.legs);
  const winner = left === target && right < target ? 0 : right === target && left < target ? 1 : null;
  if (settings.gameType === "bestOf" && left + right > settings.legsCount) return null;
  if (settings.allowDraw && left === right && left + right === settings.legsCount) return -1;
  return winner;
}

export function simulateTournamentResults(tournament, random = Math.random, limit = Infinity) {
  const { settings } = tournament;
  const simulated = {};
  const results = { ...tournament.results };
  const skill = Object.fromEntries(Object.keys(tournament.entries).map(id => [id, 35 + random() * 42]));
  while (limit > 0) {
    const view = tournamentView({ ...tournament, results });
    if (!view) return simulated;
    const ready = (limit === 1
      ? fixtureSchedule(view, settings).filter(fixture => fixture.available).map(fixture => fixture.match)
      : view.matches.filter(match => match.ready && !match.result)).slice(0, limit);
    if (!ready?.length) return simulated;
    for (const match of ready) {
      const format = matchSettings(settings, match);
      const target = legsToWin(format);
      const ratings = [skill[match.a], skill[match.b]];
      const winner = format.allowDraw && random() < 0.25 ? -1 : Number(random() >= ratings[0] / (ratings[0] + ratings[1]));
      const maxLoss = format.gameType === "bestOf" ? format.legsCount - target : target - 1;
      const legs = [0, 1].map(index => winner === -1 ? format.legsCount / 2
        : index === winner ? target : Math.floor(random() * (maxLoss + 1)));
      const totalLegs = legs[0] + legs[1];
      const stats = legs.map((wins, index) => {
        const points = wins * settings.startScore + (totalLegs - wins) * Math.floor(settings.startScore * (0.5 + random() * 0.42));
        const darts = Math.max(totalLegs, Math.round(3 * points / (ratings[index] + random() * 12 - 6)));
        const firstNineDarts = Math.min(darts, totalLegs * 9);
        const highestOut = wins ? Math.min(settings.startScore, 2 + 2 * Math.floor(random() * 60)) : 0;
        return {
          legs: wins, totalScored: points, dartsThrown: darts, firstNineDarts,
          firstNineScored: Math.round(points * firstNineDarts / darts),
          checkoutHits: wins, checkoutAttempts: Math.min(darts, wins + Math.floor(random() * totalLegs * 3)),
          highestOut, bullOuts: Number(highestOut === 50),
          oneEightys: Math.floor(random() * Math.min(points / 180, darts / 3, totalLegs / 2))
        };
      });
      simulated[match.id] = results[match.id] = makeResult(format, winner, stats, `simulated-${match.id}`);
    }
    limit -= ready.length;
  }
  return simulated;
}

export function makeResult(settings, winnerIndex, players, submissionId) {
  if (players.length !== 2 || winnerIndex === null || matchOutcome(settings, players) !== winnerIndex) {
    throw new Error("The match must be completed before saving.");
  }
  const [left, right] = players.map(player => Object.fromEntries(statFields.map(field => {
    const value = player[field];
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid match statistics.");
    return [field, value];
  })));
  return { winnerIndex, left, right, submissionId, standingsVersion: 2, pairingVersion: 1 };
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
