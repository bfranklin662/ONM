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

  function inviteProfiles(linked = [], presence = {}, accounts = null) {
    if (accounts) return accounts;
    const profiles = new Map(linked.filter(player => keyOf(player)).map(player => [keyOf(player), player]));
    for (const [key, profile] of Object.entries(presence || {})) {
      if (profile?.versusAccount === true && profile.playerName) {
        profiles.set(key, { ...profile, ...profiles.get(key), playerKey: key });
      }
    }
    return [...profiles.values()];
  }

  function withProfilePhotos(players, profiles, drivePhotos = {}, photoKey = name => name) {
    const byKey = new Map(Object.entries(profiles).filter(([, profile]) => profile.playerKey)
      .map(([name, profile]) => [profile.playerKey, { name, photo: profile.photo }]));
    return players.map(player => {
      const profile = byKey.get(keyOf(player));
      const accountPhoto = clean(player.photoUrl || player.photo);
      const usableAccountPhoto = /^\/?images\/players\//i.test(accountPhoto) ? "" : accountPhoto;
      const photo = profile?.photo || usableAccountPhoto || (profile && drivePhotos[photoKey(profile.name)]) || "";
      return { ...player, photo, photoUrl: photo };
    });
  }

  function matchTime(match) {
    const recordedTime = Date.parse(match.dateTime || "");
    if (Number.isFinite(recordedTime)) return recordedTime;
    const createdAt = match.createdAt?.toMillis?.() ?? match.createdAt;
    const timestamp = typeof createdAt === "number" ? createdAt : Date.parse(createdAt || "");
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function players(profiles = [], matches = [], presence = {}) {
    const rows = new Map();
    const newRow = playerKey => ({
      playerKey, totalScored: 0, dartsThrown: 0, trackedGames: 0,
      played: 0, wins: 0, fastestLeg: null, oneEightys: 0, bullOuts: 0, highestOut: null, winStreak: 0
    });
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
    const orderedMatches = matches.map(match => ({ match, time: matchTime(match) }))
      .sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
    for (const { match, time } of orderedMatches) {
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
        if (time !== null && (won || lost)) row.winStreak = won ? row.winStreak + 1 : 0;
        const bestLeg = parseInt(match[prefix + "BestLeg"], 10);
        if (bestLeg > 0) row.fastestLeg = Math.min(row.fastestLeg ?? bestLeg, bestLeg);
        row.oneEightys += Number(match[prefix + "180s"]) || 0;
        row.bullOuts += Number(match[prefix + "BullOuts"]) || 0;
        const highestOut = Number(match[prefix + "HighestOut"]);
        if (highestOut > 0) row.highestOut = Math.max(row.highestOut ?? 0, highestOut);
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

  const api = { players, inviteProfiles, statusOf, withProfilePhotos };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ONMVersusPlayers = api;
})(typeof window !== "undefined" ? window : globalThis);
