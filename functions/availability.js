"use strict";

const { archiveRecord } = require("./availability-roster");
const { createHash } = require("node:crypto");
const SPREADSHEET_ID = "1jrh1Ij_H2sidOam3mZY_lCwT-KC5qVp1QNUxxgrUzqQ";
const SHEET_ID = 1717914264;
const CHOICES = ["Available", "Unavailable", "Not sure"];

const STATUSES = [...CHOICES, "Selected"];

function problem(code, message) {
  return Object.assign(new Error(message), { code });
}

function normalise(value) {
  return String(value || "").replace(/\s*\((?:c|vc)\)\s*$/i, "").trim().replace(/\s+/g, " ").toLowerCase();
}

function columnName(index) {
  let text = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) text = String.fromCharCode(65 + (n - 1) % 26) + text;
  return text;
}

function todayLondon(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function parseFixture(header, opponent, side, venue) {
  const lines = String(header || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const dateLine = lines.find(line => /^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(line));
  if (!dateLine || !String(opponent || "").trim()) return null;
  const [day, month, year] = dateLine.split(/\s+/);
  const monthIndex = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(month.toLowerCase().slice(0, 3));
  if (monthIndex < 0) return null;
  const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  const league = lines[0];
  const time = lines.find(line => /^\d{2}:\d{2}$/.test(line)) || "18:30";
  const cancelled = /cancelled|canceled|postponed/i.test(`${header} ${opponent} ${venue}`);
  const id = createHash("sha256").update(JSON.stringify([date, normalise(league), normalise(opponent), normalise(side)])).digest("hex").slice(0, 24);
  return { id, date, league, opponent: String(opponent).trim(), side: String(side || "").trim(), venue: String(venue || "").trim(), time, cancelled };
}

function availabilityAliases(player) {
  const names = [player.fullName, player.publicName].map(normalise);
  if (names.some(name => ["gary hampshire", "gary hampshere", "gary hamshere"].includes(name))) return ["Gary Hampshere", "Gary Hamshere"];
  if (names.some(name => ["george m", "george mills"].includes(name))) return ["George Mills"];
  return [];
}

function findPlayerRow(values, player) {
  // Full names take precedence; public-name matching supports rows such as Billiams.
  const candidates = [player.availabilitySheetName, player.fullName, player.publicName, ...availabilityAliases(player), ...(player.aliases || [])].map(normalise).filter(Boolean);
  for (const candidate of candidates) {
    const matches = values.flatMap((row, index) => index >= 7 && normalise(row[0]) === candidate ? [index] : []);
    if (matches.length > 1) throw problem("failed-precondition", "Your player matches more than one sheet row. Please ask a club administrator to check it.");
    if (matches.length === 1) return matches[0];
  }
  throw problem("not-found", "Your linked player does not match a row in the availability sheet yet. Please ask a club administrator to check the spelling.");
}

function fixturesFor(values, rowIndex, today) {
  const fixtures = [];
  for (let column = 2; column < (values[0] || []).length; column += 1) {
    const fixture = parseFixture(values[0]?.[column], values[1]?.[column], values[2]?.[column], values[3]?.[column]);
    if (!fixture || fixture.cancelled || fixture.date < today) continue;
    const value = String(values[rowIndex]?.[column] || "").trim();
    const status = STATUSES.find(choice => normalise(choice) === normalise(value)) || "";
    fixtures.push({ ...fixture, column, status });
  }
  const counts = new Map();
  fixtures.forEach(fixture => counts.set(fixture.id, (counts.get(fixture.id) || 0) + 1));
  return fixtures.map(fixture => ({ ...fixture, editable: counts.get(fixture.id) === 1 }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.league.localeCompare(b.league));
}

function createAvailabilityService({ db, sheets, now = () => new Date(), withSheetLock = action => action() }) {
  async function readSheet() {
    const metadata = await sheets.metadata();
    const tab = (metadata.sheets || []).find(sheet => sheet.properties.sheetId === SHEET_ID)?.properties;
    if (!tab) throw problem("failed-precondition", "The availability tab could not be found.");
    const { rowCount, columnCount } = tab.gridProperties;
    if (rowCount > 500 || columnCount > 500) throw problem("failed-precondition", "The availability sheet layout needs checking by a club administrator.");
    const title = `'${tab.title.replace(/'/g, "''")}'`;
    const values = await sheets.values(`${title}!A1:${columnName(columnCount - 1)}${rowCount}`);
    return { title, values };
  }

  async function requireAdmin(uid) {
    if (!uid) throw problem("unauthenticated", "Sign in as an administrator.");
    const account = (await db.doc(`users/${uid}`).get()).data();
    if (account?.status !== "Active" || !["admin", "owner"].includes(account.role)) {
      throw problem("permission-denied", "Administrator access required.");
    }
  }

  async function getTeamSheet(uid) {
    await requireAdmin(uid);
    const { values } = await readSheet();
    // Keep fixture headings and player responses, excluding counts and the spare column.
    return {
      sheetTeamSync: true,
      sheetRosterSync: true,
      rows: values.map((row, index) => index >= 4 && index < 7 ? [] : [row[0] || "", "", ...row.slice(2)]),
      fixtureIds: Object.fromEntries(fixturesFor(values, 7, todayLondon(now()))
        .filter(fixture => fixture.editable).map(fixture => [fixture.column, fixture.id])),
      refreshedAt: now().toISOString()
    };
  }

  async function context(uid) {
    if (!uid) throw problem("unauthenticated", "Please sign in to set availability.");
    const userSnapshot = await db.doc(`users/${uid}`).get();
    const user = userSnapshot.data();
    if (!user || user.status !== "Active" || user.accountType === "supporter") throw problem("permission-denied", "Availability is for active player accounts.");
    if (!user.linkedPlayerKey || /\//.test(user.linkedPlayerKey)) throw problem("failed-precondition", "Link your account to an ONM player before setting availability.");
    return playerContext(user.linkedPlayerKey);
  }

  async function loadPlayer(playerKey) {
    if (typeof playerKey !== "string" || !playerKey || playerKey.includes("/")) {
      throw problem("invalid-argument", "Choose a club player.");
    }
    const playerSnapshot = await db.doc(`players/${playerKey}`).get();
    if (!playerSnapshot.exists && playerKey === "george-m") return { publicName: "George M", fullName: "George Mills" };
    if (!playerSnapshot.exists) {
      const publicSnapshot = await db.doc(`publicPlayers/${playerKey}`).get();
      if (!publicSnapshot.exists) throw problem("failed-precondition", "That player profile could not be found.");
      return publicSnapshot.data();
    }
    return playerSnapshot.data();
  }

  async function playerContext(playerKey) {
    const player = await loadPlayer(playerKey);
    const { title, values } = await readSheet();
    let rowIndex;
    try {
      rowIndex = findPlayerRow(values, player);
    } catch (error) {
      if (error.code === "not-found") throw problem("failed-precondition", error.message);
      throw error;
    }
    return { title, rowIndex, fixtures: fixturesFor(values, rowIndex, todayLondon(now())) };
  }

  async function rosterSnapshot() {
    const { title, values } = await readSheet();
    const notes = await sheets.rosterNotes(title);
    return { values, notes };
  }

  function existingRow(values, player) {
    try {
      return findPlayerRow(values, player);
    } catch (error) {
      if (error.code === "not-found") return -1;
      throw error;
    }
  }

  function findArchivedRow(notes, playerKey) {
    return [...notes.entries()].find(([, note]) => archiveRecord(note)?.key === playerKey);
  }

  function rosterInsertIndex(values, notes) {
    const occupied = values.reduce((last, row, index) => index >= 7 && row[0] ? index : last, 7);
    const lastArchived = [...notes].reduce((last, [index, note]) => archiveRecord(note) ? Math.max(last, index) : last, 7);
    return Math.max(occupied, lastArchived) + 1;
  }

  function fixtureColumns(values) {
    return Object.fromEntries(values[0].flatMap((header, column) => {
      if (column < 2) return [];
      const fixture = parseFixture(header, values[1]?.[column], values[2]?.[column], values[3]?.[column]);
      return fixture ? [[fixture.id, column]] : [];
    }));
  }

  async function changeRosterArchive({ values, notes }, player, playerKey, archived) {
    const entry = findArchivedRow(notes, playerKey);
    const ref = db.doc(`availabilityArchives/${playerKey}`);
    const index = entry?.[0] ?? existingRow(values, player);
    if (archived) {
      if (index < 0) return false;
      const legacy = entry && archiveRecord(entry[1]);
      const row = values[index] || [];
      const responses = Object.fromEntries(Object.entries(fixtureColumns(values))
        .filter(([, column]) => row[column]).map(([id, column]) => [id, row[column]]));
      await ref.set({ name: legacy?.name || row[0], note: legacy?.note ?? notes.get(index) ?? "", responses });
      await sheets.deleteRosterRow(index);
      return true;
    }

    if (entry) {
      const record = archiveRecord(entry[1]);
      if (values[index]?.[0]) throw problem("failed-precondition", "The archived row already has a name. Check it before restoring.");
      await sheets.setRosterName(index, record.name, record.note, false);
      return true;
    }
    const record = (await ref.get()).data();
    if (index >= 0) {
      await sheets.setRosterName(index, values[index][0], notes.get(index) || "", false);
      if (record) await ref.delete();
      return true;
    }
    if (!record) return false;
    const responses = Object.fromEntries(Object.entries(fixtureColumns(values))
      .flatMap(([id, column]) => record.responses[id] ? [[column, record.responses[id]]] : []));
    await sheets.addRosterRows(rosterInsertIndex(values, notes), [record.name], values[0].length, [{ note: record.note, responses }]);
    await ref.delete();
    return true;
  }

  async function archiveTeamPlayer(uid, payload) {
    await requireAdmin(uid);
    if (typeof payload?.archived !== "boolean") throw problem("invalid-argument", "Choose whether to archive or restore the player.");
    const player = await loadPlayer(payload.playerKey);
    return withSheetLock(async () => {
      const roster = await rosterSnapshot();
      const changed = await changeRosterArchive(roster, player, payload.playerKey, payload.archived);
      if (!changed && !payload.archived) await addMissingRows(roster, [player]);
      return { sheetRowChanged: changed };
    });
  }

  async function addMissingRows({ values, notes }, players) {
    const additions = [];
    const archivedNames = new Set([...notes.values()].map(note => normalise(archiveRecord(note)?.name)).filter(Boolean));
    for (const player of players) {
      const name = String(player.availabilitySheetName || player.fullName || player.publicName || "").trim();
      if (!name || name.length > 120 || archivedNames.has(normalise(name)) || existingRow(values, player) >= 0 || findArchivedRow(notes, player.playerKey)) continue;
      if (additions.some(added => normalise(added) === normalise(name))) continue;
      if (player.playerKey && (await db.doc(`availabilityArchives/${player.playerKey}`).get()).data()) continue;
      additions.push(name);
    }
    if (!additions.length) return 0;
    await sheets.addRosterRows(rosterInsertIndex(values, notes), additions, values[0].length);
    return additions.length;
  }

  async function archivedKeys() {
    const snapshot = await db.doc("seasons/26-27").get();
    return new Set(snapshot.data()?.pickTeamArchivedPlayerKeys || []);
  }

  async function syncRoster(uid, payload) {
    await requireAdmin(uid);
    const keys = payload?.playerKeys;
    if (!Array.isArray(keys) || keys.length > 150 || new Set(keys).size !== keys.length) {
      throw problem("invalid-argument", "Choose up to 150 club players.");
    }
    const archived = await archivedKeys();
    const players = await Promise.all(keys.map(async playerKey => ({ ...await loadPlayer(playerKey), playerKey })));
    return withSheetLock(async () => {
      let roster = await rosterSnapshot();
      let removed = 0;
      for (const player of players.filter(item => archived.has(item.playerKey))) {
        if (await changeRosterArchive(roster, player, player.playerKey, true)) {
          removed += 1;
          roster = await rosterSnapshot();
        }
      }
      const added = await addMissingRows(roster, players.filter(player => !archived.has(player.playerKey)));
      return { added, removed };
    });
  }

  async function addResultPlayers(before, after) {
    if (after?.season !== "26-27") return;
    const namesFor = result => Array.from({ length: 12 }, (_, index) =>
      String(result?.sheetRow?.[`Player${index + 1}`] || result?.sheetRow?.[`Player ${index + 1}`] || "").trim()).filter(Boolean);
    const previous = new Set(namesFor(before).map(normalise));
    const names = [...new Set(namesFor(after))].filter(name => !previous.has(normalise(name)));
    if (!names.length) return;
    const [directory, archived] = await Promise.all([db.collection("players").get(), archivedKeys()]);
    const records = directory.docs.map(doc => ({ ...doc.data(), playerKey: doc.id }));
    const players = names.flatMap(name => {
      const candidates = records.filter(player => [player.publicName, player.fullName, ...(player.aliases || [])].map(normalise).includes(normalise(name)));
      if (candidates.length > 1) return [];
      const player = candidates[0] || { publicName: name, playerKey: normalise(name).replace(/[^a-z0-9]+/g, "-") };
      return archived.has(player.playerKey) ? [] : [player];
    });
    if (players.length) await withSheetLock(async () => addMissingRows(await rosterSnapshot(), players));
  }

  async function selectTeamOnSheet(uid, payload) {
    await requireAdmin(uid);
    const keys = payload?.playerKeys;
    if (!Array.isArray(keys) || keys.length > 12 || new Set(keys).size !== keys.length || typeof payload.fixtureId !== "string") {
      throw problem("invalid-argument", "Choose up to 12 different players for an upcoming fixture.");
    }
    return withSheetLock(async () => {
      const { title, values } = await readSheet();
      const fixture = fixturesFor(values, 7, todayLondon(now())).find(item => item.id === payload.fixtureId && item.editable);
      if (!fixture) throw problem("failed-precondition", "That fixture has changed or is no longer upcoming. Refresh availability.");
      const players = await Promise.all(keys.map(loadPlayer));
      const rows = players.map(player => {
        try {
          return findPlayerRow(values, player);
        } catch (error) {
          throw problem("failed-precondition", `${player.publicName || player.fullName}: ${error.message}`);
        }
      });
      if (new Set(rows).size !== rows.length) throw problem("failed-precondition", "Two selected profiles match the same sheet row.");
      const entries = await Promise.all(rows.map(async rowIndex => {
        const cell = await sheets.cell(`${title}!${columnName(fixture.column)}${rowIndex + 1}`);
        const rule = dropdownRule(cell);
        return { rowIndex, columnIndex: fixture.column, rule };
      }));
      if (entries.length) await sheets.overrideSelections(entries);
      return { selected: entries.length };
    });
  }

  async function get(uid) {
    const data = await context(uid);
    return { fixtures: data.fixtures.map(({ column, ...fixture }) => fixture), choices: CHOICES, refreshedAt: now().toISOString() };
  }

  function validateResponse(payload, choices) {
    if (!payload || typeof payload.fixtureId !== "string" || !["", ...choices].includes(payload.status) || !["", ...STATUSES].includes(payload.previousStatus)) {
      throw problem("invalid-argument", "Choose a valid availability response.");
    }
  }

  async function set(uid, payload) {
    validateResponse(payload, CHOICES);
    return withSheetLock(async () => writeResponse(await context(uid), payload));
  }

  async function setTeamResponse(uid, payload) {
    await requireAdmin(uid);
    validateResponse(payload, STATUSES);
    if (typeof payload.playerKey !== "string" || !payload.playerKey || payload.playerKey.includes("/")) {
      throw problem("invalid-argument", "Choose a club player.");
    }
    return withSheetLock(async () => writeResponse(await playerContext(payload.playerKey), payload));
  }

  function dropdownRule(cellData) {
    const rule = cellData.dataValidation;
    if (cellData.userEnteredValue?.formulaValue || rule?.condition?.type !== "ONE_OF_LIST") {
      throw problem("failed-precondition", "This sheet cell is not an availability dropdown. Please ask a club administrator to check it.");
    }
    const allowed = rule.condition.values.map(value => value.userEnteredValue);
    const selectedOnly = allowed.length === 1 && allowed[0] === "Selected" && !rule.showCustomUi;
    if (!selectedOnly && (CHOICES.some(choice => !allowed.includes(choice)) || allowed.includes("Selected"))) {
      throw problem("failed-precondition", "The sheet's availability choices have changed. Please refresh.");
    }
    return rule;
  }

  async function writeResponse(data, payload) {
    const fixture = data.fixtures.find(item => item.id === payload.fixtureId);
    if (!fixture || !fixture.editable) throw problem("failed-precondition", "That fixture has changed or is no longer upcoming. Refresh the fixtures.");
    if (fixture.status !== payload.previousStatus) throw problem("aborted", "Your response changed in the sheet. Refresh before saving again.");
    const cell = `${data.title}!${columnName(fixture.column)}${data.rowIndex + 1}`;
    const cellData = await sheets.cell(cell);
    const rule = dropdownRule(cellData);
    const currentRaw = cellData.userEnteredValue?.stringValue || "";
    const current = STATUSES.find(choice => normalise(choice) === normalise(currentRaw)) || "";
    if (current !== payload.previousStatus) throw problem("aborted", "Your response changed in the sheet. Refresh before saving again.");
    if (payload.status === "Selected" || rule.condition.values.some(value => value.userEnteredValue === "Selected")) {
      await sheets.overrideSelections([{ rowIndex: data.rowIndex, columnIndex: fixture.column, rule, status: payload.status }]);
    } else {
      await sheets.update(cell, payload.status);
    }
    return { fixtureId: fixture.id, status: payload.status };
  }

  return { get, set, getTeamSheet, setTeamResponse, archiveTeamPlayer, selectTeamOnSheet, syncRoster, addResultPlayers };
}

module.exports = { SPREADSHEET_ID, SHEET_ID, CHOICES, normalise, columnName, parseFixture, findPlayerRow, fixturesFor, todayLondon, createAvailabilityService };
