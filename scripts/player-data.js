// scripts/player-data.js
(function () {
  // ---- CONFIG ----
  const LIVE_STATS_SHEET_ID = "1svcwpJZujjUG-mJbYHFqiiGtKvqM2QrnyK1FC1ZdiNQ";

  function liveStatsCsvUrl(gid) {
    return `https://docs.google.com/spreadsheets/d/${LIVE_STATS_SHEET_ID}/export?format=csv&gid=${gid}`;
  }

  const SHEETS = {
    banks: {
      "25-26": liveStatsCsvUrl("1530331549"),
      "24-25": "data/banks-stats-24-25.json"
    },
    traf: {
      "25-26": liveStatsCsvUrl("1168072831"),
      "24-25": null
    },
    smithfield: {
      "25-26": liveStatsCsvUrl("455815630"),
      "24-25": null
    },
    coldaA: {
      "25-26": liveStatsCsvUrl("1813256931"),
      "24-25": null
    },
    coldaB: {
      "25-26": liveStatsCsvUrl("230091598"),
      "24-25": null
    },
    appearances: {
      "25-26": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=858987471&single=true&output=csv",
      "24-25": "data/result-data-24-25.json"
    }
  };

  const STAT_LEAGUES = [
    { id: "banks", label: "Banks", competition: "Banks League", sheetKey: "banks", seasons: ["25-26", "24-25"] },
    { id: "traf", label: "Trafalgar", competition: "Trafalgar League", sheetKey: "traf", seasons: ["25-26"] },
    { id: "smithfield", label: "Smithfield", competition: "Smithfield League", sheetKey: "smithfield", seasons: ["25-26"] },
    { id: "colda-a", label: "COLDA A", competition: "COLDA A", sheetKey: "coldaA", seasons: ["25-26"] },
    { id: "colda-b", label: "COLDA B", competition: "COLDA B", sheetKey: "coldaB", seasons: ["25-26"] }
  ];

  const KEYS = {
    played: ["Played", "P", "Games"],
    checkouts: ["Checkouts", "Check Out"],
    fines: ["Fines", "Fine", "Fines£"],
    one80s: ["180s", "180", "180 Count"],
    bulls: ["Bull-outs", "Bull-Outs", "Bullouts", "Bulls"],
    tonPlus: ["Ton+ Outs", "Ton+ outs", "Ton+", "TonOuts"]
  };

  // ---- GENERIC HELPERS ----
  function getNumSafe(v) {
    if (v == null) return 0;
    const s = String(v).replace(/[£,\s]/g, "");
    const n = Number(s);
    return isNaN(n) ? 0 : n;
  }

  function getStatFromRow(row = {}, keys = []) {
    const lc = {};
    for (const k in row) lc[k.trim().toLowerCase()] = row[k];
    for (const k of keys) {
      const lk = k.toLowerCase();
      const val = row[k] ?? lc[lk];
      if (val !== undefined && val !== "" && val !== "-") return getNumSafe(val);
    }
    return 0;
  }

  async function fetchCSV(url) {
    if (!url) return [];
    // JSON shortcuts
    if (/\.json($|\?)/i.test(url) || url.trim().endsWith(".json")) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("JSON fetch failed");
        return await res.json();
      } catch (err) {
        console.error("fetchCSV JSON load failed:", url, err);
        return [];
      }
    }

    try {
      const res = await fetch(url + "&t=" + Date.now());
      const text = await res.text();
      if (!text) return [];
      const lines = text.trim().split("\n").filter(Boolean);
      if (!lines.length) return [];
      const headers = lines[0].split(",").map(h => h.trim());
      return lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.trim());
        const obj = {};
        headers.forEach((h, i) => (obj[h] = cols[i] ?? ""));
        return obj;
      });
    } catch (err) {
      console.error("fetchCSV failed:", url, err);
      return [];
    }
  }

  async function getAllPlayersFromSheets() {
    const players = new Set();

    const statRows = await Promise.all(
      STAT_LEAGUES.flatMap(league =>
        league.seasons.map(season => fetchCSV(SHEETS[league.sheetKey]?.[season]))
      )
    );
    const apps25 = await fetchCSV(SHEETS.appearances["25-26"]);
    const apps24 = await fetchCSV(SHEETS.appearances["24-25"]);

    const all = [
      ...statRows.flat(),
      ...apps25, ...apps24
    ];

    all.forEach(row => {
      const directName = row.Player || row.Name;
      if (directName && typeof directName === "string" && isRealPlayerName(directName)) {
        players.add(directName.trim());
      }

      for (let i = 1; i <= 20; i++) {
        let name =
          row[`Player${i}`] ||
          row[`Player ${i}`] ||
          row[`P${i}`] ||
          row[`P ${i}`];

        if (name && typeof name === "string" && isRealPlayerName(name)) {
          name = name.trim();
          if (name.length > 0) players.add(name);
        }
      }
    });

    return [...players].sort();
  }

  function escapeHtml(str = "") {
    return String(str).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function normName(s) {
    return (s || "")
      .toString()
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function isRealPlayerName(name) {
    const clean = normName(name);
    if (!clean) return false;
    return !["team", "total", "totals", "overall"].includes(clean);
  }

  function cellHasPlayer(cellValue, playerName) {
    const target = normName(playerName);
    const cell = normName(cellValue);
    if (!cell) return false;

    // If the cell is just one name: require exact equality
    if (!cell.includes(",") && !cell.includes("&") && !cell.includes("/") && !cell.includes(" and ")) {
      return cell === target;
    }

    // If multiple players are packed in a cell, split and match exact token
    const parts = cell
      .split(/,|&|\/|\band\b/gi)
      .map(p => normName(p))
      .filter(Boolean);

    return parts.includes(target);
  }

  function playerAppearsInRow(row = {}, playerName) {
    // Look through all columns and only consider ones that look like player name columns
    // e.g. Player1, Player 1, P1, P 1, etc.
    for (const key of Object.keys(row)) {
      const k = key.trim().toLowerCase();

      const isPlayerCol =
        /^player\s*\d+$/.test(k) ||   // Player1 / Player 1
        /^p\s*\d+$/.test(k);          // P1 / P 1

      if (!isPlayerCol) continue;

      if (cellHasPlayer(row[key], playerName)) return true;
    }

    return false;
  }



  function findPlayerIndexInRow(row = {}, player) {
    for (const key of Object.keys(row)) {
      const k = key.trim().toLowerCase();

      // Player1 / Player 1
      if (/^player\s*\d+$/.test(k)) {
        if (cellHasPlayer(row[key], player)) {
          const num = parseInt(k.replace("player", ""), 10);
          return isNaN(num) ? null : num;
        }
      }

      // P1 / P 1 (if your sheet ever uses these)
      if (/^p\s*\d+$/.test(k)) {
        if (cellHasPlayer(row[key], player)) {
          const num = parseInt(k.replace("p", ""), 10);
          return isNaN(num) ? null : num;
        }
      }
    }
    return null;
  }


  function extractPlayerMatchStatsFromRow(row = {}, player) {
    const idx = findPlayerIndexInRow(row, player);
    if (!idx) {
      return { checkouts: 0, fines: 0, one80s: 0, bulls: 0, tonOuts: 0, doubleFine: false };
    }

    function get(prefix) {
      return getNumSafe(row[`${prefix}${idx}`] ?? 0);
    }

    const doubleFine = String(row[`D${idx}`] || "").trim().toUpperCase() === "TRUE";

    return {
      checkouts: get("C"),
      fines: get("F"),
      one80s: get("O"),
      bulls: get("B"),
      tonOuts: get("T"),
      doubleFine
    };
  }

  function leagueInfoFromRow(row = {}) {
    const comp = (row.Competition || "").toString().toLowerCase();

    if (comp.includes("bank")) return { name: "banks", color: "#007bff" };
    if (comp.includes("traf")) return { name: "traf", color: "#ff9800" };
    if (comp.includes("smithfield")) return { name: "smithfield", color: "#8e99a6" };
    if (comp.includes("colda a")) return { name: "colda-a", color: "#00c389" };
    if (comp.includes("colda b")) return { name: "colda-b", color: "#7aa7ff" };
    if (comp.includes("colda")) return { name: "colda-a", color: "#00c389" };

    const home = (row.HomeTeam || "").toLowerCase();
    const away = (row.AwayTeam || "").toLowerCase();

    if (home.includes("smithfield") || away.includes("smithfield"))
      return { name: "smithfield", color: "#8e99a6" };

    if (home.includes("oche ness monsters b") || away.includes("oche ness monsters b"))
      return { name: "colda-b", color: "#7aa7ff" };

    if (home.includes("oche ness monsters a") || away.includes("oche ness monsters a"))
      return { name: "colda-a", color: "#00c389" };

    if (home.includes("trafalgar") || away.includes("trafalgar"))
      return { name: "traf", color: "#ff9800" };

    if (home.includes("bank") || away.includes("bank"))
      return { name: "banks", color: "#007bff" };

    return { name: "banks", color: "#007bff" };
  }

  function safeParseDate(v) {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;

    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      let yyyy = parseInt(m[3], 10);
      if (yyyy < 100) yyyy += (yyyy >= 50 ? 1900 : 2000);
      const d = new Date(yyyy, mm - 1, dd);
      if (!isNaN(d.getTime())) return d;
    }

    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    return null;
  }

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function formatPrettyDate(v) {
    const d = safeParseDate(v);
    if (!d) return v || "";
    const day = ordinal(d.getDate());
    const month = d.toLocaleString("en-GB", { month: "short" });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }

  function countWinsAndLosses(rows, playerName) {
    let wins = 0;
    let losses = 0;

    rows.forEach(r => {
      if (!playerAppearsInRow(r, playerName)) return;
      const res =
        r.Result ??
        r["Result "] ??
        r.result ??
        r["W/L"] ??
        r["Outcome"] ??
        "";
      const text = String(res).trim().toLowerCase();
      if (text.includes("won") || text === "w") wins++;
      else if (text.includes("lost") || text === "l") losses++;
    });

    return { wins, losses };
  }

  // ---- DRIVE PHOTO FETCH (CACHED) ----


  const DRIVE_API_KEY = "AIzaSyDlAZ7wv_8BNA1Nes1uBMrbZWhL0aaz1xw";
  const PLAYER_PHOTO_FOLDER_ID = "1wIsRGnYOvD_v0QGc3nEPraoHSqj62pNc";

  const DRIVE_CACHE_KEY = "playerDrivePhotos";
  let drivePhotoMemoryCache = null;

  function photoKey(s) {
    return (s || "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\.[^/.]+$/, "")   // remove extension
      .replace(/\s+/g, "")        // remove spaces
      .replace(/[^a-z0-9]/g, ""); // remove punctuation
  }

  async function fetchPlayerPhotosFromDrive() {
    // 1️⃣ In-memory cache (fastest)
    if (drivePhotoMemoryCache) {
      return drivePhotoMemoryCache;
    }

    // 2️⃣ sessionStorage cache (survives page navigation)
    try {
      const cached = sessionStorage.getItem(DRIVE_CACHE_KEY);
      if (cached) {
        drivePhotoMemoryCache = JSON.parse(cached);
        return drivePhotoMemoryCache;
      }
    } catch {
      // ignore cache errors
    }

    // 3️⃣ Network fetch (only if needed)
    const q = encodeURIComponent(
      `'${PLAYER_PHOTO_FOLDER_ID}' in parents and mimeType contains 'image/'`
    );

    const url =
      `https://www.googleapis.com/drive/v3/files` +
      `?q=${q}` +
      `&fields=files(id,name)` +
      `&key=${DRIVE_API_KEY}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Drive API error");

      const data = await res.json();

      const map = {};
      (data.files || []).forEach(f => {
        const key = photoKey(f.name);
        if (key) {
          map[key] = `https://drive.google.com/thumbnail?id=${f.id}&sz=w800`;
        }
      });

      // Save caches
      drivePhotoMemoryCache = map;
      try {
        sessionStorage.setItem(DRIVE_CACHE_KEY, JSON.stringify(map));
      } catch {
        // ignore quota issues
      }

      return map;

    } catch (err) {
      console.warn("Failed to fetch player photos from Drive", err);
      return {};
    }
  }


  window.PlayerData = {
    SHEETS,
    STAT_LEAGUES,
    KEYS,
    fetchCSV,
    getAllPlayersFromSheets,
    getNumSafe,
    getStatFromRow,
    escapeHtml,
    playerAppearsInRow,
    findPlayerIndexInRow,
    extractPlayerMatchStatsFromRow,
    leagueInfoFromRow,
    safeParseDate,
    formatPrettyDate,
    countWinsAndLosses,
    fetchPlayerPhotosFromDrive,
    photoKey
  };

})();
