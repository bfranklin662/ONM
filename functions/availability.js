"use strict";

const { createHash } = require("node:crypto");
const SPREADSHEET_ID = "1jrh1Ij_H2sidOam3mZY_lCwT-KC5qVp1QNUxxgrUzqQ";
const SHEET_ID = 1717914264;
const CHOICES = ["Available", "Unavailable", "Not sure"];

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

function findPlayerRow(values, player) {
  // Full names take precedence; public-name matching supports rows such as Billiams.
  const candidates = [player.availabilitySheetName, player.fullName, player.publicName].map(normalise).filter(Boolean);
  for (const candidate of candidates) {
    const matches = values.flatMap((row, index) => index >= 7 && normalise(row[0]) === candidate ? [index] : []);
    if (matches.length > 1) throw problem("failed-precondition", "Your player matches more than one sheet row. Please ask a club administrator to check it.");
    if (matches.length === 1) return matches[0];
  }
  throw problem("failed-precondition", "Your linked player does not match a row in the availability sheet yet. Please ask a club administrator to check the spelling.");
}

function fixturesFor(values, rowIndex, today) {
  const fixtures = [];
  for (let column = 2; column < (values[0] || []).length; column += 1) {
    const fixture = parseFixture(values[0]?.[column], values[1]?.[column], values[2]?.[column], values[3]?.[column]);
    if (!fixture || fixture.cancelled || fixture.date < today) continue;
    const value = String(values[rowIndex]?.[column] || "").trim();
    const status = CHOICES.find(choice => normalise(choice) === normalise(value)) || "";
    fixtures.push({ ...fixture, column, status });
  }
  const counts = new Map();
  fixtures.forEach(fixture => counts.set(fixture.id, (counts.get(fixture.id) || 0) + 1));
  return fixtures.map(fixture => ({ ...fixture, editable: counts.get(fixture.id) === 1 }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.league.localeCompare(b.league));
}

function createAvailabilityService({ db, sheets, now = () => new Date() }) {
  async function context(uid) {
    if (!uid) throw problem("unauthenticated", "Please sign in to set availability.");
    const userSnapshot = await db.doc(`users/${uid}`).get();
    const user = userSnapshot.data();
    if (!user || user.status !== "Active" || user.accountType === "supporter") throw problem("permission-denied", "Availability is for active player accounts.");
    if (!user.linkedPlayerKey || /\//.test(user.linkedPlayerKey)) throw problem("failed-precondition", "Link your account to an ONM player before setting availability.");
    const playerSnapshot = await db.doc(`players/${user.linkedPlayerKey}`).get();
    if (!playerSnapshot.exists) throw problem("failed-precondition", "Your linked player could not be found.");
    const player = playerSnapshot.data();
    const metadata = await sheets.metadata();
    const tab = (metadata.sheets || []).find(sheet => sheet.properties.sheetId === SHEET_ID)?.properties;
    if (!tab) throw problem("failed-precondition", "The availability tab could not be found.");
    const { rowCount, columnCount } = tab.gridProperties;
    if (rowCount > 500 || columnCount > 500) throw problem("failed-precondition", "The availability sheet layout needs checking by a club administrator.");
    const title = `'${tab.title.replace(/'/g, "''")}'`;
    const values = await sheets.values(`${title}!A1:${columnName(columnCount - 1)}${rowCount}`);
    const rowIndex = findPlayerRow(values, player);
    return { title, rowIndex, fixtures: fixturesFor(values, rowIndex, todayLondon(now())) };
  }

  async function get(uid) {
    const data = await context(uid);
    return { fixtures: data.fixtures.map(({ column, ...fixture }) => fixture), choices: CHOICES, refreshedAt: now().toISOString() };
  }

  async function set(uid, payload) {
    if (!payload || typeof payload.fixtureId !== "string" || !["", ...CHOICES].includes(payload.status) || !["", ...CHOICES].includes(payload.previousStatus)) {
      throw problem("invalid-argument", "Choose a valid availability response.");
    }
    const data = await context(uid);
    const fixture = data.fixtures.find(item => item.id === payload.fixtureId);
    if (!fixture || !fixture.editable) throw problem("failed-precondition", "That fixture has changed or is no longer upcoming. Refresh the fixtures.");
    if (fixture.status !== payload.previousStatus) throw problem("aborted", "Your response changed in the sheet. Refresh before saving again.");
    const cell = `${data.title}!${columnName(fixture.column)}${data.rowIndex + 1}`;
    const cellData = await sheets.cell(cell);
    if (cellData.userEnteredValue?.formulaValue || cellData.dataValidation?.condition?.type !== "ONE_OF_LIST") throw problem("failed-precondition", "This sheet cell is not an availability dropdown. Please ask a club administrator to check it.");
    const allowed = cellData.dataValidation.condition.values.map(value => value.userEnteredValue);
    if (payload.status && !allowed.includes(payload.status)) throw problem("failed-precondition", "The sheet's availability choices have changed. Please refresh.");
    const currentRaw = cellData.userEnteredValue?.stringValue || "";
    const current = CHOICES.find(choice => normalise(choice) === normalise(currentRaw)) || "";
    if (current !== payload.previousStatus) throw problem("aborted", "Your response changed in the sheet. Refresh before saving again.");
    await sheets.update(cell, payload.status);
    return { fixtureId: fixture.id, status: payload.status };
  }

  return { get, set };
}

module.exports = { SPREADSHEET_ID, SHEET_ID, CHOICES, normalise, columnName, parseFixture, findPlayerRow, fixturesFor, todayLondon, createAvailabilityService };
