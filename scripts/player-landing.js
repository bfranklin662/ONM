
// scripts/player-landing.js
document.addEventListener("DOMContentLoaded", async () => {
  const {
    SHEETS,
    KEYS,
    fetchCSV,
    getAllPlayersFromSheets,
    getStatFromRow,
    escapeHtml
  } = window.PlayerData;

  function applyFanAnimationDelays(sortedPlayers) {
    sortedPlayers.forEach((p, i) => {
      const card = grid.querySelector(`.player-card[data-player-key="${p.key}"]`);
      if (!card) return;

      // Set delay based on sorted position
      card.style.animationDelay = `${i * 0.05}s`;

      // Optional: restart animation so new delays apply even if it already ran
      card.style.animation = "none";
      card.offsetHeight; // force reflow
      card.style.animation = "";
    });
  }


  const titleEl = document.getElementById("playerProfileTitle");
  const select = document.getElementById("playerSelect");
  const grid = document.getElementById("playersGrid");

  if (titleEl) titleEl.textContent = "Players";



  function makeCaptainRibbonHtml(profile = {}) {
    const role = (profile.role || "").toString().trim().toLowerCase();
    if (role !== "captain") return "";
    return `<div class="captain-ribbon">CAPTAIN</div>`;
  }


  /* -------------------------------------------
     FAST: show loading UI IMMEDIATELY (before any awaits)
  -------------------------------------------- */
  if (grid) {
    grid.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading players...</p>
      </div>
    `;
    // Give the browser a chance to paint the spinner before heavy work
    await new Promise(requestAnimationFrame);
  }

  const accoladeMap = {
    banks_winner_24_25: {
      emoji: "⭐",
      tooltip: "Banks League 2024/25"
    },
    alex_beckett_winner_25: {
      emoji: "🏆",
      tooltip: "Alex Beckett Cup 2025"
    },
    mpl_winner_25: {
      emoji: "🏅",
      tooltip: "MPL 2025"
    }
  };


  function makeAccoladesOverlayHtml(profile = {}) {
    const keys = Array.isArray(profile.accolades) ? profile.accolades : [];
    const items = keys.map(k => accoladeMap[k]).filter(Boolean);

    if (!items.length) return "";

    return `
    <div class="player-card-accolades" aria-label="Accolades">
      ${items.map(a => `
        <span class="acc-emoji"
              data-tooltip="${a.tooltip}">
          ${a.emoji}
        </span>
      `).join("")}
    </div>
  `;
  }



  /* -------------------------------------------
     OPTIONAL: CSV CACHE (localStorage + TTL)
     Huge real-world win on repeat visits.
  -------------------------------------------- */
  const CSV_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

  async function fetchCSVWithCache(cacheKey, sheetUrlOrId) {
    const key = `csvcache:${cacheKey}`;
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.data) &&
          typeof parsed.savedAt === "number" &&
          Date.now() - parsed.savedAt < CSV_CACHE_TTL_MS
        ) {
          return parsed.data;
        }
      }
    } catch (e) {
      // ignore cache errors
    }

    const data = await fetchCSV(sheetUrlOrId);

    try {
      localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
    } catch (e) {
      // ignore quota errors
    }

    return data;
  }

  /* -------------------------------------------
     LOAD EVERYTHING IN PARALLEL (start ASAP)
  -------------------------------------------- */
  const manualProfilesPromise = fetch("data/player-profile.json")
    .then(r => r.json())
    .catch(e => {
      console.warn("Failed to load player-profile.json", e);
      return {};
    });

  const allPlayersPromise = getAllPlayersFromSheets();

  const fetchPlayerPhotosFromDrive =
    window.PlayerData?.fetchPlayerPhotosFromDrive;

  if (!fetchPlayerPhotosFromDrive) {
    console.error("fetchPlayerPhotosFromDrive not available");
  }

  const drivePhotosPromise = fetchPlayerPhotosFromDrive
    ? fetchPlayerPhotosFromDrive()
    : Promise.resolve({});



  // Start CSV fetches immediately (and cached)
  const banks25Promise = fetchCSVWithCache("banks_25-26", SHEETS.banks["25-26"]);
  const traf25Promise = fetchCSVWithCache("traf_25-26", SHEETS.traf["25-26"]);
  const banks24Promise = fetchCSVWithCache("banks_24-25", SHEETS.banks["24-25"]);
  const apps25Promise = fetchCSVWithCache("apps_25-26", SHEETS.appearances["25-26"]);
  const apps24Promise = fetchCSVWithCache("apps_24-25", SHEETS.appearances["24-25"]);




  /* -------------------------------------------
     WAIT for the minimum needed to show UI (players + profiles)
  -------------------------------------------- */
  const [manualProfiles, allPlayers, drivePhotos] = await Promise.all([
    manualProfilesPromise,
    allPlayersPromise,
    drivePhotosPromise
  ]);


  function makeSpecialsHtml(stats = {}) {
    return `
    <span class="stat-badge badge-180 ${stats["180s"] > 0 ? "active" : "inactive"}"
          data-tooltip="180 Count">180 x ${stats["180s"] || 0}</span>

    <span class="stat-badge badge-bull ${stats.Bulls > 0 ? "active" : "inactive"}"
          data-tooltip="Bull Checkouts">Bull x ${stats.Bulls || 0}</span>

    <span class="stat-badge badge-ton ${stats["Ton+"] > 0 ? "active" : "inactive"}"
          data-tooltip="Ton+ Checkouts">Ton+ x ${stats["Ton+"] || 0}</span>
  `;
  }


  /* -------------------------------------------
     BUILD PROFILES
  -------------------------------------------- */
  window.playerProfiles = {};
  allPlayers.forEach(name => {
    const src = manualProfiles[name] || {};
    const key = name.trim().toLowerCase();

    window.playerProfiles[name] = {
      nickname: src.nickname || "",
      bio: src.bio || "",
      accolades: Array.isArray(src.accolades) ? src.accolades : [],
      role: src.role || "",
      song: src.song || "",
      photo: drivePhotos[key] || "images/default.jpg"
    };
  });


  /* -------------------------------------------
     POPULATE DROPDOWN
  -------------------------------------------- */
  if (select) {
    select.innerHTML = "";

    const allOpt = document.createElement("option");
    allOpt.value = "All";
    allOpt.textContent = "All Players";
    allOpt.selected = true;
    select.appendChild(allOpt);

    allPlayers.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });

    select.addEventListener("change", e => {
      const value = e.target.value;
      if (value === "All") return;
      location.href = `player.html?name=${encodeURIComponent(value)}`;
    });
  }

  /* -------------------------------------------
     RENDER CARDS IMMEDIATELY (fast perceived load)
     Stats will fill in after CSVs arrive.
  -------------------------------------------- */
  if (!grid) return;


  // Initial render: show all cards with 0/– stats
  // (We keep IDs per player so we can update stats later.)
  grid.innerHTML = allPlayers
    .map((name, i) => {
      const profile = window.playerProfiles[name];
      const key = name.trim().toLowerCase();


      return `
      <article class="player-card" style="animation-delay:${i * 0.05}s"
               data-player-key="${escapeHtml(key)}">
        <div class="player-card-photo-wrap">
          <div class="player-card-photo-frame">
            <img
              src="${profile.photo}"
              class="player-card-photo"
              alt="${escapeHtml(name)}"
              loading="lazy"
              decoding="async"
            >

            ${makeCaptainRibbonHtml(profile)}
          </div>

          <!-- ✅ Move accolades OUTSIDE the clipped frame -->
          ${makeAccoladesOverlayHtml(profile)}
        </div>


        <h3 class="player-card-name">
          ${escapeHtml(name)}
          ${profile.nickname ? `<div class="player-card-nickname">"${escapeHtml(profile.nickname)}"</div>` : ""}
        </h3>

        <div class="player-card-stats">
          <div class="player-card-stats-grid">
            <div class="player-card-stat">
              <span class="label">Played</span>
              <span class="value" data-stat="played">–</span>
            </div>

            <div class="player-card-stat">
              <span class="label">Checkouts</span>
              <span class="value" data-stat="coRatio">
                <span class="co">–</span><span class="sep"> / </span><span class="ratio">–</span>
              </span>
            </div>

            
          </div>

          <div class="player-card-specials" data-stat="specials">
            ${makeSpecialsHtml({})}
          </div>
        </div>

        

        <button class="btn player-card-btn"
          onclick="location.href='player.html?name=${encodeURIComponent(name)}'">
          Player Profile
        </button>
      </article>
    `;
    })
    .join("");


  /* -------------------------------------------
     HELPER: index rows once (avoid O(N^2) scanning)
  -------------------------------------------- */
  const makeIndex = (rows) => {
    const map = new Map();
    if (!Array.isArray(rows)) return map;

    for (const r of rows) {
      const key = ((r.Player || r.Name || "") + "")
        .trim()
        .toLowerCase();
      if (key) map.set(key, r);
    }
    return map;
  };

  /* -------------------------------------------
     LOAD STATS (already in-flight) & update UI
  -------------------------------------------- */
  try {
    const [banks25, traf25, banks24, apps25, apps24] = await Promise.all([
      banks25Promise,
      traf25Promise,
      banks24Promise,
      apps25Promise,
      apps24Promise
    ]);

    const allAppsRows = [
      ...(Array.isArray(apps25) ? apps25 : []),
      ...(Array.isArray(apps24) ? apps24 : [])
    ];

    // If countWinsAndLosses isn't available on this page, define a minimal version.
    // (Replace this with your real function if you already have it globally.)
    const countWL =
      (typeof window.countWinsAndLosses === "function")
        ? window.countWinsAndLosses
        : (rows, player) => {
          let wins = 0, losses = 0;
          const p = (player || "").toLowerCase();

          rows.forEach(r => {
            // Only count rows that include this player (adjust if your schema differs)
            const rowText = JSON.stringify(r).toLowerCase();
            if (!rowText.includes(p)) return;

            const res = (r.Result || r.result || "").toLowerCase();
            if (res.includes("won")) wins++;
            else if (res.includes("lost")) losses++;
          });

          return { wins, losses };
        };

    const b25Index = makeIndex(banks25);
    const t25Index = makeIndex(traf25);
    const b24Index = makeIndex(banks24);

    const playersWithStats = allPlayers.map(name => {
      const keyName = name.trim().toLowerCase();
      const b25 = b25Index.get(keyName) || {};
      const t25 = t25Index.get(keyName) || {};
      const b24 = b24Index.get(keyName) || {};

      const played =
        getStatFromRow(b25, KEYS.played) +
        getStatFromRow(t25, KEYS.played) +
        getStatFromRow(b24, KEYS.played);

      const checkouts =
        getStatFromRow(b25, KEYS.checkouts) +
        getStatFromRow(t25, KEYS.checkouts) +
        getStatFromRow(b24, KEYS.checkouts);

      const fines =
        getStatFromRow(b25, KEYS.fines) +
        getStatFromRow(t25, KEYS.fines) +
        getStatFromRow(b24, KEYS.fines);

      const specials = {
        "180s":
          getStatFromRow(b25, KEYS.one80s) +
          getStatFromRow(t25, KEYS.one80s) +
          getStatFromRow(b24, KEYS.one80s),
        Bulls:
          getStatFromRow(b25, KEYS.bulls) +
          getStatFromRow(t25, KEYS.bulls) +
          getStatFromRow(b24, KEYS.bulls),
        "Ton+":
          getStatFromRow(b25, KEYS.tonPlus) +
          getStatFromRow(t25, KEYS.tonPlus) +
          getStatFromRow(b24, KEYS.tonPlus)
      };

      const wl = countWL(allAppsRows, name);
      const wins = wl.wins || 0;
      const losses = wl.losses || 0;
      const pct = (wins + losses) ? Math.round((wins / (wins + losses)) * 100) : 0;

      const coRatio = played ? (checkouts / played) : 0;
      const fineRatio = played ? (fines / played) : 0;

      return {
        name,
        played,
        checkouts,
        fines,
        wins,
        pct,
        coRatio,
        fineRatio,
        specials,
        key: name.trim().toLowerCase()

      };
    });

    const sortSelect = document.getElementById("sortBySelect");
    window.playersWithStats = playersWithStats; // keep latest stats

    function getSortValue(p, sortKey) {
      switch (sortKey) {
        case "checkouts": return p.checkouts;
        case "coRatio": return p.coRatio;
        case "played": return p.played;
        case "wins": return p.wins;
        case "winRatio": return p.played ? (p.wins / p.played) : 0;
        case "fines": return p.fines;
        case "fineRatio": return p.fineRatio;
        case "one80s": return (p.specials?.["180s"] || 0);
        case "bulls": return (p.specials?.Bulls || 0);
        case "tonPlus": return (p.specials?.["Ton+"] || 0);
        default: return p.checkouts;
      }
    }

    function resortAndRender(sortKey) {
      const sorted = [...window.playersWithStats].sort((a, b) => {
        const av = getSortValue(a, sortKey);
        const bv = getSortValue(b, sortKey);
        return (bv ?? 0) - (av ?? 0);
      });

      const byKey = new Map();
      [...grid.querySelectorAll(".player-card")].forEach(card => {
        byKey.set(card.getAttribute("data-player-key"), card);
      });

      const frag = document.createDocumentFragment();
      sorted.forEach(p => {
        const card = byKey.get(p.key);
        if (card) frag.appendChild(card);
      });
      grid.appendChild(frag);

      applyFanAnimationDelays(sorted);
    }

    if (sortSelect) {
      sortSelect.value = "checkouts"; // default
      sortSelect.addEventListener("change", e => resortAndRender(e.target.value));
    }


    // Sort DESC by checkouts
    playersWithStats.sort((a, b) => b.checkouts - a.checkouts);

    // Map existing cards by key
    const byKey = new Map();
    [...grid.querySelectorAll(".player-card")].forEach(card => {
      byKey.set(card.getAttribute("data-player-key"), card);
    });

    // Re-order DOM + update values
    const frag = document.createDocumentFragment();
    playersWithStats.forEach(p => {
      const card = byKey.get(p.key);
      if (!card) return;

      // Played
      const playedEl = card.querySelector('[data-stat="played"]');
      if (playedEl) playedEl.textContent = String(p.played);

      // Checkouts / Ratio
      const coWrap = card.querySelector('[data-stat="coRatio"]');
      if (coWrap) {
        const coEl = coWrap.querySelector(".co");
        const ratioEl = coWrap.querySelector(".ratio");
        if (coEl) coEl.textContent = String(p.checkouts);
        if (ratioEl) ratioEl.textContent = (p.coRatio || 0).toFixed(2);
      }

      // Wins / %
      const wlWrap = card.querySelector('[data-stat="wlPct"]');
      if (wlWrap) {
        const winsEl = wlWrap.querySelector(".wins");
        const pctEl = wlWrap.querySelector(".pct");
        if (winsEl) winsEl.textContent = String(p.wins);
        if (pctEl) pctEl.textContent = `${p.pct || 0}%`;
      }

      // Fines / Ratio
      const fineWrap = card.querySelector('[data-stat="fineRatio"]');
      if (fineWrap) {
        const finesEl = fineWrap.querySelector(".fines");
        const ratioEl = fineWrap.querySelector(".ratio");

        const finesRounded = Math.round(Number(p.fines) || 0);

        if (finesEl) finesEl.textContent = `£${finesRounded}`;
        if (ratioEl) ratioEl.textContent = (Number(p.fineRatio) || 0).toFixed(2);
      }


      // Specials
      const specialsEl = card.querySelector('[data-stat="specials"]');
      if (specialsEl) specialsEl.innerHTML = makeSpecialsHtml(p.specials);

      frag.appendChild(card);
    });

    grid.appendChild(frag);

    // Re-apply fan delays based on sorted order
    applyFanAnimationDelays(playersWithStats);

  } catch (err) {
    console.error("renderPlayersLandingPage error:", err);

    grid.querySelectorAll('[data-stat="played"]').forEach(el => (el.textContent = "—"));
    grid.querySelectorAll('[data-stat="coRatio"] .co, [data-stat="coRatio"] .ratio').forEach(el => (el.textContent = "—"));
    grid.querySelectorAll('[data-stat="wlPct"] .wins, [data-stat="wlPct"] .pct').forEach(el => (el.textContent = "—"));
    grid.querySelectorAll('[data-stat="fineRatio"] .fines, [data-stat="fineRatio"] .ratio').forEach(el => (el.textContent = "—"));

    grid.querySelectorAll('[data-stat="specials"]').forEach(el => {
      el.innerHTML = makeSpecialsHtml({});
    });

    const msg = document.createElement("p");
    msg.style.color = "#f66";
    msg.textContent = "Error loading player stats";
    grid.prepend(msg);
  }
  initTooltips();

});
