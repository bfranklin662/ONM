// scripts/player-data.js
(function () {
  // ---- CONFIG ----
  const SHEETS = {
    banks: {
      "25-26": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=1575634851&single=true&output=csv",
      "24-25": "data/banks-stats-24-25.json"
    },
    traf: {
      "25-26": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=1817707297&single=true&output=csv",
      "24-25": null
    },
    appearances: {
      "25-26": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=858987471&single=true&output=csv",
      "24-25": "data/result-data-24-25.json"
    }
  };

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

    const banks25 = await fetchCSV(SHEETS.banks["25-26"]);
    const traf25 = await fetchCSV(SHEETS.traf["25-26"]);
    const banks24 = await fetchCSV(SHEETS.banks["24-25"]);
    const apps25 = await fetchCSV(SHEETS.appearances["25-26"]);
    const apps24 = await fetchCSV(SHEETS.appearances["24-25"]);

    const all = [
      ...banks25, ...traf25, ...banks24,
      ...apps25, ...apps24
    ];

    all.forEach(row => {
      for (let i = 1; i <= 20; i++) {
        let name =
          row[`Player${i}`] ||
          row[`Player ${i}`] ||
          row[`P${i}`] ||
          row[`P ${i}`];

        if (name && typeof name === "string") {
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

  function playerAppearsInRow(row = {}, player) {
    if (!row || !player) return false;
    const target = player.trim().toLowerCase();

    // strict Player1..Player20
    for (let i = 1; i <= 20; i++) {
      const keys = [
        `Player${i}`,
        `Player ${i}`,
        `P${i}`,
        `P ${i}`
      ];
      for (const k of keys) {
        if (row[k] != null) {
          const val = String(row[k]).trim().toLowerCase();
          if (val === target) return true;
        }
      }
    }

    // loose scan
    for (const k of Object.keys(row)) {
      const v = row[k];
      if (typeof v === "string" && v.toLowerCase().includes(target)) {
        return true;
      }
    }
    return false;
  }

  function findPlayerIndexInRow(row = {}, player) {
    const target = player.trim().toLowerCase();
    for (const key of Object.keys(row)) {
      const lower = key.toLowerCase();
      if (lower.startsWith("player")) {
        const value = String(row[key]).trim().toLowerCase();
        if (value === target) {
          const num = parseInt(lower.replace("player", ""), 10);
          return num;
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

    const home = (row.HomeTeam || "").toLowerCase();
    const away = (row.AwayTeam || "").toLowerCase();

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
        const key = (f.name || "")
          .replace(/\.[^/.]+$/, "")
          .trim()
          .toLowerCase();

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
    fetchPlayerPhotosFromDrive // ✅ added
  };

})();

