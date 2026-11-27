(function (root) {
  "use strict";

  const clean = value => String(value ?? "").trim();
  const keyOf = profile => clean(profile.linkedPlayerKey || profile.playerKey || profile.userId);
  const statusOrder = { online: 0, playing: 1, offline: 2, unknown: 3 };

  function statusOf(presence, now = Date.now()) {
    if (presence?.online === false || presence?.status === "offline") return "offline";
    if (presence?.status === "playing" &&
        (!presence.updatedAt || now - Number(presence.updatedAt) <= 5 * 60 * 1000)) return "playing";
    return presence?.online === true || presence?.status === "online" ? "online" : "offline";
  }

  function inviteProfiles(linked = [], presence = {}) {
    const profiles = new Map(linked.map(player => [keyOf(player), player]));
    return Object.entries(presence || {}).flatMap(([key, profile]) => {
      if (profile?.versusAccount !== true || !profile.playerName) return [];
      return [{ ...profile, ...profiles.get(key), playerKey: key }];
    });
  }

  function players(profiles = [], matches = [], presence = {}) {
    const rows = new Map();
    const newRow = playerKey => ({ playerKey, totalScored: 0, dartsThrown: 0, trackedGames: 0, played: 0, wins: 0, fastestLeg: null, oneEightys: 0, bullOuts: 0, tonPlusOuts: 0, tonPlusIncomplete: false });
    for (const profile of profiles) {
      const key = keyOf(profile);
      if (!key) continue;
      const row = rows.get(key) || newRow(key);
      row.playerName = clean(profile.fullName || profile.playerName || profile.name) || row.playerName;
      row.photo = clean(profile.photo || profile.photoUrl) || row.photo;
      row.nationality = clean(profile.nationality) || row.nationality;
      row.lastMatch = profile.lastMatch || row.lastMatch;
      row.matchHistory = profile.matchHistory || row.matchHistory;
      rows.set(key, row);
    }
    for (const match of matches) {
      if (match.mode === "bot" || match.botMode || match.casual === true ||
          (match.matchMode && match.matchMode !== "online")) continue;
      for (const prefix of ["playerOne", "playerTwo"]) {
        const key = clean(match[prefix + "Id"]);
        if (!key) continue;
        const row = rows.get(key) || newRow(key);
        const scored = Number(match[prefix + "TotalScored"]);
        const darts = Number(match[prefix + "DartsThrown"]);
        const won = String(match[prefix + "Won"]).toLowerCase() === "true";
        const validVisitTotals = Number.isFinite(scored) && scored >= 0 && Number.isFinite(darts) && darts > 0;
        const other = prefix === "playerOne" ? "playerTwo" : "playerOne";
        const lost = String(match[other + "Won"]).toLowerCase() === "true";
        if (!validVisitTotals && !won && !lost) continue;
        row.playerName ||= match[prefix + "Name"];
        row.played++;
        if (won) row.wins++;
        const bestLeg = parseInt(match[prefix + "BestLeg"], 10);
        if (bestLeg > 0) row.fastestLeg = Math.min(row.fastestLeg ?? bestLeg, bestLeg);
        row.oneEightys += Number(match[prefix + "180s"]) || 0;
        row.bullOuts += Number(match[prefix + "BullOuts"]) || 0;
        const recordedTons = match[prefix + "TonPlusOuts"];
        if (recordedTons != null && recordedTons !== "") {
          row.tonPlusOuts += Number(recordedTons) || 0;
          row.tonPlusIncomplete ||= match[prefix + "TonPlusIncomplete"] === true;
        } else if (Number(match[prefix + "HighestOut"]) >= 100) {
          row.tonPlusOuts++;
          row.tonPlusIncomplete ||= Number(match[prefix + "Legs"]) !== 1;
        }
        if (validVisitTotals) {
          row.totalScored += scored;
          row.dartsThrown += darts;
          row.trackedGames++;
        }
        rows.set(key, row);
      }
    }
    return [...rows.values()].map(row => ({
      ...row,
      playerName: row.playerName || "Player",
      status: presence === null ? "unknown" : statusOf(presence[row.playerKey]),
      average: row.dartsThrown > 0 ? (row.totalScored * 3 / row.dartsThrown).toFixed(2) : null
    })).sort((a, b) => statusOrder[a.status] - statusOrder[b.status] ||
      a.playerName.localeCompare(b.playerName, "en", { sensitivity: "base" }));
  }

  const api = { players, inviteProfiles, statusOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ONMVersusPlayers = api;
})(typeof window !== "undefined" ? window : globalThis);
