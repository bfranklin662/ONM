// scripts/player-profile.js
let playerName = "";
let selectedSeason = "all";
let selectedLeague = "all";
let overallTotals = null;

if (!window.PlayerData) {
  console.error("PlayerData not found. Is scripts/player-data.js loaded before player-profile.js?");
}

const {
  SHEETS,
  KEYS,
  fetchCSV,
  getAllPlayersFromSheets,
  getStatFromRow,
  escapeHtml,
  playerAppearsInRow,
  extractPlayerMatchStatsFromRow,
  leagueInfoFromRow,
  safeParseDate,
  formatPrettyDate,
  countWinsAndLosses,
  fetchPlayerPhotosFromDrive
} = window.PlayerData || {};

// ---------- ANIMATION HELPERS ----------

function makeProfileAccoladesHtml(profile) {
  const keys = Array.isArray(profile?.accolades) ? profile.accolades : [];
  if (!keys.length) return "";

  const accoladeMap = {
    banks_winner_24_25: { icon: "⭐", tip: "Banks League Div 2 Winner 2024/25" },
    alex_beckett_winner_25: { icon: "🏆", tip: "Alex Beckett League Winner 2024/25" },
    mpl_winner_25: { icon: "🏅", tip: "Monsters Premier League Winner 2025" }
  };

  return keys
    .map(k => {
      const a = accoladeMap[k];
      if (!a) return "";
      return `<span class="acc-emoji" data-tooltip="${a.tip}">${a.icon}</span>`;
    })
    .join("");
}



function animateNumber(el, end, duration = 900) {
  if (!el) return;
  const startTime = performance.now();
  const start = 0;

  function update(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const value = Math.floor(start + (end - start) * progress);
    el.textContent = value.toString();
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function animateNumberDecimal(el, end, duration = 900) {
  if (!el) return;
  const startTime = performance.now();
  const start = 0;

  function update(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const value = (start + (end - start) * progress).toFixed(2);
    el.textContent = value;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function animateCurrencyDecimal(el, end, duration = 900) {
  if (!el) return;
  const startTime = performance.now();
  const start = 0;

  function update(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const value = (start + (end - start) * progress).toFixed(2);
    el.textContent = "£" + value;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}


function updateMedals(stats) {
  const medalsEl = document.getElementById("playerMedals");
  const medalsTitle = document.querySelector(".medals-title");
  const profileStats = document.querySelector(".profile-stats-row"); // parent

  if (!medalsEl || !medalsTitle || !profileStats || !stats) return;

  const tooltipLabels = {
    "10.png": "10+ Checkouts",
    "25.png": "25+ Checkouts",
    "50.png": "50+ Checkouts",
    "100.png": "100+ Checkouts",
    "180.png": "180 Club",
    "Bull.png": "Bull Checkout",
    "Ton+.png": "Ton+ Checkout"
  };

  const medals = [];
  if (stats.Checkouts >= 10) medals.push("10.png");
  if (stats.Checkouts >= 25) medals.push("25.png");
  if (stats.Checkouts >= 50) medals.push("50.png");
  if (stats.Checkouts >= 100) medals.push("100.png");
  if (stats["180s"] > 0) medals.push("180.png");
  if (stats.Bulls > 0) medals.push("Bull.png");
  if (stats["Ton+"] > 0) medals.push("Ton+.png");

  // ❌ NO medals → remove from layout
  if (medals.length === 0) {
    profileStats.classList.remove("has-medals");

    medalsTitle.classList.remove("is-open");
    medalsEl.classList.remove("is-open");

    medalsTitle.style.display = "none";
    medalsEl.style.display = "none";
    medalsEl.innerHTML = "";
    return;
  }

  // ✅ Medals exist
  profileStats.classList.add("has-medals");

  medalsTitle.style.display = "";
  medalsEl.style.display = "";

  // Render medals with a slower stagger (like last 5)
  medalsEl.innerHTML = medals.map((m, i) => `
    <div class="medal"
         data-tooltip="${tooltipLabels[m] || ""}"
         style="animation-delay:${0.2 + i * 0.12}s">
      <img src="graphics/medals/${m}" alt="${tooltipLabels[m] || "Medal"}">
    </div>
  `).join("");

  // Trigger container fade/slide in (if you're using .is-open CSS)
  requestAnimationFrame(() => {
    medalsTitle.classList.add("is-open");
    medalsEl.classList.add("is-open");
  });
}






// ---------- OVERALL HEADER STATS ----------
async function loadOverallTotals() {
  const quickStatsEl = document.getElementById("playerQuickStats");
  const formEl = document.getElementById("playerFormGraph");
  const captainEl = document.getElementById("captainBadge");

  if (quickStatsEl) {
    quickStatsEl.innerHTML = `
      <div class="loading"><div class="spinner"></div></div>
    `;
  }

  const seasons = ["24-25", "25-26"];
  const grand = { Played: 0, Checkouts: 0, Fines: 0, "180s": 0, Bulls: 0, "Ton+": 0 };

  await Promise.all(seasons.map(async season => {
    const [banksRows, trafRows] = await Promise.all([
      SHEETS.banks[season] ? fetchCSV(SHEETS.banks[season]) : [],
      SHEETS.traf[season] ? fetchCSV(SHEETS.traf[season]) : []
    ]);

    const find = rows =>
    (rows.find(r =>
      ((r.Player || r.Name || "").toLowerCase() === playerName.toLowerCase())
    ) || {});

    const b = find(banksRows);
    const t = find(trafRows);

    grand.Played += getStatFromRow(b, KEYS.played) + getStatFromRow(t, KEYS.played);
    grand.Checkouts += getStatFromRow(b, KEYS.checkouts) + getStatFromRow(t, KEYS.checkouts);
    grand.Fines += getStatFromRow(b, KEYS.fines) + getStatFromRow(t, KEYS.fines);
    grand["180s"] += getStatFromRow(b, KEYS.one80s) + getStatFromRow(t, KEYS.one80s);
    grand.Bulls += getStatFromRow(b, KEYS.bulls) + getStatFromRow(t, KEYS.bulls);
    grand["Ton+"] += getStatFromRow(b, KEYS.tonPlus) + getStatFromRow(t, KEYS.tonPlus);
  }));

  overallTotals = grand;

  const allAppsRows = [
    ...(await fetchCSV(SHEETS.appearances["25-26"])),
    ...(await fetchCSV(SHEETS.appearances["24-25"]))
  ];

  // ---------- DATE JOINED (first appearance) ----------

  const joinedEl = document.getElementById("playerDateJoined");

  if (joinedEl) {
    const playerApps = allAppsRows
      .filter(r => playerAppearsInRow(r, playerName))
      .map(r => safeParseDate(
        r["Date Played"] || r["Match Date"] || r.Date || r["Date"]
      ))
      .filter(d => d instanceof Date && !isNaN(d));

    if (playerApps.length) {
      playerApps.sort((a, b) => a - b);
      const first = playerApps[0];

      const joinedText = first.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric"
      });

      joinedEl.textContent = joinedText;
    }
  }


  const wlTotals = countWinsAndLosses(allAppsRows, playerName);
  const totalWins = wlTotals.wins || 0;
  const totalLosses = wlTotals.losses || 0;

  const winPct = (totalWins + totalLosses)
    ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
    : 0;

  const profile = window.playerProfiles[playerName] || {};
  if (captainEl) {
    if (profile.role === "captain") {
      captainEl.innerHTML = `<span>🟦 Captain</span>`;
    } else if (profile.role === "vice-captain") {
      captainEl.innerHTML = `<span>🟩 Vice Captain</span>`;
    } else {
      captainEl.innerHTML = "";
    }
  }

  // Checkout ratio already computed as coRate (string). We'll use number too:
  const coRatioNum = grand.Played ? (grand.Checkouts / grand.Played) : 0;

  // Fines ratio: fines per game (number)
  const fineRatioNum = grand.Played ? (grand.Fines / grand.Played) : 0;

  // Fines total rounded to nearest pound
  const finesRounded = Number(grand.Fines || 0).toFixed(2);

  quickStatsEl.innerHTML = `
  <div class="profile-stats-row">
    <div class="profile-stats-grid">
      <div class="profile-stat-box">
        <div class="label">Played</div>
        <div class="value played" id="qs-played">0</div>
      </div>

      <div class="profile-stat-box">
        <div class="label">Checkouts / Ratio</div>
        <div class="value">
          <span class="co" id="qs-checkouts">0</span>
          <span class="sep"> / </span>
          <span class="ratio" id="qs-coRatio">0.00</span>
        </div>
      </div>

      <div class="profile-stat-box">
        <div class="label">Wins / Ratio</div>
        <div class="value">
          <span class="wins" id="qs-wins">0</span>
          <span class="sep"> / </span>
          <span class="ratio" id="qs-winPct">0%</span>
        </div>
      </div>


      <div class="profile-stat-box">
        <div class="label">Fines / Ratio</div>
        <div class="value">
          <span class="fines" id="qs-fines">£0</span>
          <span class="sep"> / </span>
          <span class="ratio" id="qs-fineRatio">0.00</span>
        </div>
      </div>
    </div>

    <div class="profile-specials-col" id="qs-specials">
      <div class="stat-badge badge-180 ${grand["180s"] > 0 ? "active" : "inactive"}" data-tooltip="180 Count">
        180 x ${grand["180s"] || 0}
      </div>
      <div class="stat-badge badge-bull ${grand.Bulls > 0 ? "active" : "inactive"}" data-tooltip="Bull Checkouts">
        Bull x ${grand.Bulls || 0}
      </div>
      <div class="stat-badge badge-ton ${grand["Ton+"] > 0 ? "active" : "inactive"}" data-tooltip="Ton+ Checkouts">
        Ton+ x ${grand["Ton+"] || 0}
      </div>
    </div>
  </div>
`;

  // Animate values (same style as before)
  setTimeout(() => {
    animateNumber(document.getElementById("qs-played"), grand.Played);

    animateNumber(document.getElementById("qs-checkouts"), grand.Checkouts);

    // ratios
    animateNumberDecimal(document.getElementById("qs-coRatio"), coRatioNum, 900);

    animateNumber(document.getElementById("qs-wins"), totalWins);

    // ✅ set the percentage text
    const pctEl = document.getElementById("qs-winPct");
    if (pctEl) pctEl.textContent = `${winPct}%`;


    // fines total rounded (no decimals)
    const finesEl = document.getElementById("qs-fines");
    if (finesEl) finesEl.textContent = `£${finesRounded}`;

    animateNumberDecimal(document.getElementById("qs-fineRatio"), fineRatioNum, 900);
  }, 50);


  // Form (last 5 across BOTH seasons)
  const [apps2526, apps2425] = await Promise.all([
    fetchCSV(SHEETS.appearances["25-26"]),
    fetchCSV(SHEETS.appearances["24-25"])
  ]);

  const allMatches = [...apps2425, ...apps2526];

  // sort by date ascending so "last 5" is truly most recent
  allMatches.sort((a, b) => {
    const da = safeParseDate(a["Date Played"] || a["Match Date"] || a.Date || a["Date"]);
    const db = safeParseDate(b["Date Played"] || b["Match Date"] || b.Date || b["Date"]);
    return (da?.getTime() || 0) - (db?.getTime() || 0);
  });

  const recent = allMatches
    .filter(r => playerAppearsInRow(r, playerName))
    .slice(-5);

  const last5Title = document.querySelector(".last5-title");

  // Clear first (important if switching players)
  formEl.innerHTML = "";
  if (last5Title) last5Title.style.display = "none";

  if (recent.length) {
    formEl.innerHTML = recent
      .map((r, i) => {
        const res = (r.Result || "").toLowerCase();
        const cls = res.includes("won") ? "win" : res.includes("lost") ? "loss" : "draw";
        return `<div class="form-dot ${cls}" style="animation-delay:${i * 0.1}s"></div>`;
      })
      .join("");

    // ✅ Reveal title only when dots exist
    if (last5Title) {
      requestAnimationFrame(() => {
        if (last5Title) last5Title.style.display = "";
      });
    }
  }



}

// ---------- SPECIALS HTML ----------
function makeSpecialsHtml(stats = {}) {
  return `
    <span class="stat-badge badge-180 ${stats["180s"] > 0 ? "active" : "inactive"}"
          data-tooltip="180 Count">180 x ${stats["180s"]}</span>

    <span class="stat-badge badge-bull ${stats.Bulls > 0 ? "active" : "inactive"}"
          data-tooltip="Bull Checkouts">Bull x ${stats.Bulls}</span>

    <span class="stat-badge badge-ton ${stats["Ton+"] > 0 ? "active" : "inactive"}"
          data-tooltip="Ton+ Checkouts">Ton+ x ${stats["Ton+"]}</span>
  `;
}

function animateStatsRowNumbers() {
  const rows = ["row-overall", "row-season", "row-banks2625", "row-traf2625", "row-banks2425"];

  rows.forEach(id => {
    const row = document.getElementById(id);
    if (!row) return;

    [...row.querySelectorAll("td")].forEach(cell => {
      const text = cell.textContent.trim();

      // skip empties, currency, and non-numbers
      if (!text || text.startsWith("£") || isNaN(Number(text))) return;

      const num = Number(text);

      // If it has decimals, animate as decimals; otherwise animate as int
      if (text.includes(".")) {
        animateNumberDecimal(cell, num, 700);
      } else {
        animateNumber(cell, num, 700);
      }
    });
  });
}


// ---------- STATS TABLE FILL ----------
function updateStatsTable(p) {
  const fill = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = val ?? "";
  };

  const fmtGBP = (v) => "£" + Number(v || 0).toFixed(2);
  const fmt2 = (v) => Number(v || 0).toFixed(2);


  fill("overall-played", p.overall.Played);
  fill("overall-wins", p.overall.Wins);
  fill("overall-losses", p.overall.Losses);
  fill("overall-checkouts", p.overall.Checkouts);
  fill("overall-checkoutsPerGame", fmt2(p.overall.CheckoutsPerGame));
  fill("overall-fines", fmtGBP(p.overall.Fines));
  fill("overall-finesPerGame", fmtGBP(p.overall.FinesPerGame));
  fill("overall-specials", p.overall.specialsHtml);

  fill("season-played", p.season.Played);
  fill("season-wins", p.season.Wins);
  fill("season-losses", p.season.Losses);
  fill("season-checkouts", p.season.Checkouts);
  fill("season-checkoutsPerGame", fmt2(p.season.CheckoutsPerGame));
  fill("season-fines", fmtGBP(p.season.Fines));
  fill("season-finesPerGame", fmtGBP(p.season.FinesPerGame));
  fill("season-specials", p.season.specialsHtml);

  fill("banks2625-played", p.banks2625.Played);
  fill("banks2625-wins", p.banks2625.Wins);
  fill("banks2625-losses", p.banks2625.Losses);
  fill("banks2625-checkouts", p.banks2625.Checkouts);
  fill("banks2625-checkoutsPerGame", fmt2(p.banks2625.CheckoutsPerGame));
  fill("banks2625-fines", fmtGBP(p.banks2625.Fines));
  fill("banks2625-finesPerGame", fmtGBP(p.banks2625.FinesPerGame));
  fill("banks2625-specials", p.banks2625.specialsHtml);

  fill("traf2625-played", p.traf2625.Played);
  fill("traf2625-wins", p.traf2625.Wins);
  fill("traf2625-losses", p.traf2625.Losses);
  fill("traf2625-checkouts", p.traf2625.Checkouts);
  fill("traf2625-checkoutsPerGame", fmt2(p.traf2625.CheckoutsPerGame));
  fill("traf2625-fines", fmtGBP(p.traf2625.Fines));
  fill("traf2625-finesPerGame", fmtGBP(p.traf2625.FinesPerGame));
  fill("traf2625-specials", p.traf2625.specialsHtml);

  fill("banks2425-played", p.banks2425.Played);
  fill("banks2425-wins", p.banks2425.Wins);
  fill("banks2425-losses", p.banks2425.Losses);
  fill("banks2425-checkouts", p.banks2425.Checkouts);
  fill("banks2425-checkoutsPerGame", fmt2(p.banks2425.CheckoutsPerGame));
  fill("banks2425-fines", fmtGBP(p.banks2425.Fines));
  fill("banks2425-finesPerGame", fmtGBP(p.banks2425.FinesPerGame));
  fill("banks2425-specials", p.banks2425.specialsHtml);

  fill("overall-bagels", p.overall.Bagels);
  fill("season-bagels", p.season.Bagels);
  fill("banks2625-bagels", p.banks2625.Bagels);
  fill("traf2625-bagels", p.traf2625.Bagels);
  fill("banks2425-bagels", p.banks2425.Bagels);

  animateStatsRowNumbers();
}

// ---------- SHOW/HIDE ROWS BASED ON FILTERS ----------
function updateStatsVisibility() {
  const title = document.getElementById("statsTitle");
  if (title) title.textContent = `Player Stats – ${playerName}`;

  const rows = {
    overall: document.getElementById("row-overall"),
    season: document.getElementById("row-season"),
    banks2625: document.getElementById("row-banks2625"),
    traf2625: document.getElementById("row-traf2625"),
    banks2425: document.getElementById("row-banks2425")
  };

  const old = document.querySelector(".no-data");
  if (old) old.remove();

  Object.values(rows).forEach(r => { if (r) r.style.display = ""; });

  if (selectedSeason === "25-26") {
    if (rows.overall) rows.overall.style.display = "none";
    if (rows.banks2425) rows.banks2425.style.display = "none";
  }

  if (selectedSeason === "24-25") {
    if (rows.overall) rows.overall.style.display = "none";
    if (rows.season) rows.season.style.display = "none";
    if (rows.banks2625) rows.banks2625.style.display = "none";
    if (rows.traf2625) rows.traf2625.style.display = "none";
  }

  if (selectedLeague === "banks") {
    if (rows.overall) rows.overall.style.display = "none";
    if (rows.season) rows.season.style.display = "none";
    if (rows.traf2625) rows.traf2625.style.display = "none";
  }

  if (selectedLeague === "traf") {
    if (rows.overall) rows.overall.style.display = "none";
    if (rows.season) rows.season.style.display = "none";
    if (rows.banks2625) rows.banks2625.style.display = "none";
    if (rows.banks2425) rows.banks2425.style.display = "none";

    if (selectedSeason === "24-25" && rows.season) {
      rows.traf2625.style.display = "none";
      rows.season.insertAdjacentHTML(
        "afterend",
        `<tr class="no-data">
          <td colspan="9" style="padding:10px;color:#f66;text-align:center;font-weight:600">
            No data for Trafalgar 24/25
          </td>
        </tr>`
      );
    }
  }
}

function formatPrettyDateNoYear(raw) {
  const d = safeParseDate(raw);
  if (!(d instanceof Date) || isNaN(d)) return "";

  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11 ? "st" :
      day % 10 === 2 && day !== 12 ? "nd" :
        day % 10 === 3 && day !== 13 ? "rd" :
          "th";

  const month = d.toLocaleString("en-GB", { month: "short" });

  return `${day}${suffix} ${month}`;
}




// ---------- APPEARANCES ----------
async function buildRowsOnly(apps) {
  return apps.map((r, index) => {
    const league = leagueInfoFromRow(r);
    const isBanks = league.name === "banks";
    const leagueText = isBanks ? "BANKS" : "TRAFALGAR";

    const TEAM = "Oche Ness Monsters";
    const home = (r.HomeTeam || "").trim();
    const away = (r.AwayTeam || "").trim();
    let opponent = home === TEAM ? away : home;
    if (!opponent) opponent = "Unknown";
    const loc = home === TEAM ? "HOME" : (away === TEAM ? "AWAY" : "");

    const rawDate =
      r["Date Played"] ||
      r["Match Date"] ||
      r["Date"] ||
      r.Date ||
      "";
    const date = escapeHtml(formatPrettyDateNoYear(rawDate));


    const hsRaw = r.HomeScore ?? r.HS ?? r["Home Score"] ?? "";
    const asRaw = r.AwayScore ?? r.AS ?? r["Away Score"] ?? "";
    const hs = hsRaw === "" ? null : String(hsRaw);
    const as = asRaw === "" ? null : String(asRaw);
    const score = (hs === null || as === null) ? "—" : `${hs} - ${as}`;

    const resText = (r.Result || r["Result "] || "").toString().trim().toLowerCase();
    const isWin = resText.startsWith("w") ? true : resText.startsWith("l") ? false : null;
    const resultClass =
      isWin === true ? "result-win" :
        isWin === false ? "result-loss" :
          "result-draw";

    const p = extractPlayerMatchStatsFromRow(r, playerName);

    let specials = "";
    if (p.one80s > 0)
      specials += `<span class="stat-badge badge-180 active" data-tooltip="180 Checkout">180 x ${p.one80s}</span>`;
    if (p.bulls > 0)
      specials += `<span class="stat-badge badge-bull active" data-tooltip="Bull Checkout">Bull x ${p.bulls}</span>`;
    if (p.tonOuts > 0)
      specials += `<span class="stat-badge badge-ton active" data-tooltip="Ton+ Checkout">Ton+ x ${p.tonOuts}</span>`;

    if (!specials)
      specials = `<span class="no-specials">—</span>`;

    return `
      <tr class="appearance-row ${isBanks ? "row-banks" : "row-traf"}"
          style="animation: slideIn 0.35s ease-out forwards; animation-delay:${index * 0.05}s; opacity:0">

        <td><span class="league-col ${isBanks ? "banks" : "traf"}">${leagueText}</span></td>

        <td>
          <div class="opp-wrap">
            <div class="opp-name">${escapeHtml(opponent)}</div>
            ${loc ? `<div class="opp-loc">(${loc})</div>` : ""}
          </div>
        </td>

        <td>${date}</td>

        <td>
          <div class="result-box ${resultClass}">
            ${score}
          </div>
        </td>

        <td>
          ${p.checkouts === 0
        ? `<span class="bagel" data-tooltip="Bagel (0 Checkouts)">🥯</span>`
        : p.checkouts
      }
        </td>

        <td class="fine-cell ${p.doubleFine ? "double-fine" : ""}">
          £${Number(p.fines).toFixed(2)}
        </td>

        <td><div class="specials-row">${specials}</div></td>

      </tr>
    `;
  }).join("");
}

async function buildAppearanceTable(apps) {
  const rowsHtml = await buildRowsOnly(apps);
  return `
    <table class="appearances-table-simple">
      <thead>
        <tr>
          <th>League</th>
          <th>Opponent</th>
          <th>Date</th>
          <th>Result</th>
          <th>Checkouts</th>
          <th>Fines</th>
          <th>Specials</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

function formatSeasonLabel(season) {
  // "25-26" → "25/26 Season - Appearances"
  return season.replace("-", "/") + " Season - Appearances";
}


async function renderFilteredAppearances() {
  const apps2625 = await fetchCSV(SHEETS.appearances["25-26"]);
  const apps2425 = await fetchCSV(SHEETS.appearances["24-25"]);

  let rows = [];
  if (selectedSeason === "24-25") rows = apps2425;
  else if (selectedSeason === "25-26") rows = apps2625;
  else rows = [...apps2625, ...apps2425];

  if (selectedLeague === "banks") {
    rows = rows.filter(r => leagueInfoFromRow(r).name === "banks");
  } else if (selectedLeague === "traf") {
    rows = rows.filter(r => leagueInfoFromRow(r).name === "traf");
  }

  const final = rows.filter(r => playerAppearsInRow(r, playerName));
  final.sort((a, b) => {
    const da = safeParseDate(
      a["Date Played"] || a["Match Date"] || a.Date || a["Date"]
    );
    const db = safeParseDate(
      b["Date Played"] || b["Match Date"] || b.Date || b["Date"]
    );
    return (db?.getTime() || 0) - (da?.getTime() || 0);
  });

  const wrapper = document.getElementById("playerAppearancesWrapper");
  if (!wrapper) return;

  wrapper.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading appearances...</p>
    </div>
  `;

  await new Promise(r => setTimeout(r, 150));

  const groups = {
    "25-26": apps2625.filter(r => playerAppearsInRow(r, playerName)),
    "24-25": apps2425.filter(r => playerAppearsInRow(r, playerName))
  };

  if (selectedLeague !== "all") {
    for (const s in groups) {
      groups[s] = groups[s].filter(r => leagueInfoFromRow(r).name === selectedLeague);
    }
  }

  const seasonsToRender =
    selectedSeason === "all"
      ? ["25-26", "24-25"]
      : [selectedSeason];

  let html = "";
  for (const season of seasonsToRender) {
    const seasonRows = groups[season];
    if (!seasonRows || !seasonRows.length) continue;

    seasonRows.sort((a, b) => {
      const da = safeParseDate(a["Date Played"] || a["Match Date"] || a.Date);
      const db = safeParseDate(b["Date Played"] || b["Match Date"] || b.Date);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    });

    const block = await buildAppearanceTable(seasonRows);

    html += `
      <div class="appearance-season-block">
        <div class="appearance-season-title">
          ${formatSeasonLabel(season)}
        </div>
        <div class="appearance-table-container">
          ${block}
        </div>
      </div>
    `;
  }

  wrapper.innerHTML = html || `<p>No appearances yet.</p>`;
}

// ---------- TOOLTIP INIT ----------
function initTooltips() {
  const tip = document.getElementById("tooltip");
  if (!tip) return;

  tip.style.position = "fixed";
  tip.style.pointerEvents = "none";
  tip.style.opacity = "0";
  tip.style.transition = "opacity .12s ease, transform .12s ease";
  tip.style.transform = "translateY(4px)";

  document.addEventListener("mousemove", (e) => {
    const badge = e.target.closest && e.target.closest("[data-tooltip]");
    if (!badge) {
      tip.style.opacity = "0";
      return;
    }

    const message = badge.getAttribute("data-tooltip") || badge.dataset.tooltip || "";
    if (!message) {
      tip.style.opacity = "0";
      return;
    }

    tip.textContent = message;
    tip.style.opacity = "1";

    const shiftX = 12;
    const shiftY = 28;
    let left = e.clientX + shiftX;
    let top = e.clientY - shiftY;

    const rect = tip.getBoundingClientRect();
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    if (left + rect.width + 8 > vw) left = vw - rect.width - 8;
    if (left < 8) left = 8;
    if (top < 8) top = e.clientY + 16;

    tip.style.left = left + "px";
    tip.style.top = top + "px";
  });
}

function makeCaptainRibbonHtml(profile) {
  const role = (profile?.role || "").toString().trim().toLowerCase();
  if (role !== "captain") return "";
  return `<div class="profile-captain-ribbon">CAPTAIN</div>`;
}


document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  playerName = (params.get("name") || "").trim();

  // --- Grab DOM elements once ---
  const landing = document.getElementById("playersLanding");
  const profile = document.getElementById("playerProfileContent");
  const titleEl = document.getElementById("playerProfileTitle");
  const playerSelect = document.getElementById("playerSelect");

  const headerNameEl = document.getElementById("playerName");
  const statsNameEl = document.getElementById("statsPlayerName");
  const photoEl = document.getElementById("playerPhoto");
  const nicknameEl = document.getElementById("playerNickname");
  const bioEl = document.getElementById("playerBio");
  const quickStatsEl = document.getElementById("playerQuickStats");
  const appsWrapper = document.getElementById("playerAppearancesWrapper");

  const isProfileMode = !!playerName; // instead of playerName !== "All"

  const last5Title = document.querySelector(".last5-title");
  const walkoutEl = document.getElementById("playerWalkout");

  const walkoutWrapper =
    walkoutEl?.closest(".meta-row") ||
    walkoutEl?.closest(".player-meta-row") ||
    walkoutEl?.parentElement;

  if (last5Title) last5Title.style.display = "none";
  if (walkoutWrapper) walkoutWrapper.style.display = "none";

  const photoAccoladesEl = document.getElementById("profilePhotoAccolades");
  if (photoAccoladesEl) {
    photoAccoladesEl.style.display = "none";
    photoAccoladesEl.innerHTML = "";
  }


  const medalsSection = document.getElementById("medalsSection");
  if (medalsSection) medalsSection.style.display = "none";




  // --- 1. Instant layout: landing vs profile ---
  if (landing && profile) {
    if (isProfileMode) {
      landing.style.display = "none";
      profile.style.display = "";
    } else {
      landing.style.display = "";
      profile.style.display = "none";
    }
  }

  // --- 2. Instant header text & names ---
  if (titleEl) {
    titleEl.textContent = isProfileMode
      ? `Player Profile - ${playerName}`
      : "Players";
  }
  if (headerNameEl && isProfileMode) headerNameEl.textContent = playerName;
  if (statsNameEl && isProfileMode) statsNameEl.textContent = playerName;


  if (nicknameEl) nicknameEl.innerHTML = "";
  if (bioEl) bioEl.textContent = "";

  // --- 4. Instant spinners for profile mode ---
  const statsSpinner = `<div class="loading"><div class="spinner"></div></div>`;
  const appsSpinner = `<div class="loading"><div class="spinner"></div><p>Loading appearances...</p></div>`;

  if (isProfileMode) {
    if (quickStatsEl) quickStatsEl.innerHTML = statsSpinner;
    if (appsWrapper) appsWrapper.innerHTML = appsSpinner;
  }

  // --- 5. Instant non-empty dropdown (NO "All") ---
  if (playerSelect) {
    playerSelect.innerHTML = "";

    // Temporary current-player option so it never looks empty
    if (isProfileMode) {
      const curOpt = document.createElement("option");
      curOpt.value = playerName;
      curOpt.textContent = playerName;
      curOpt.selected = true;
      playerSelect.appendChild(curOpt);
    } else {
      // If you're on landing with no name param, give a harmless placeholder
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Select player";
      placeholder.selected = true;
      placeholder.disabled = true;
      playerSelect.appendChild(placeholder);
    }

    playerSelect.addEventListener("change", e => {
      const v = e.target.value;
      if (!v) return;
      window.location.href = `player-profile.html?name=${encodeURIComponent(v)}`;
    });
  }

  if (!isProfileMode && typeof window.renderPlayersLandingPage === "function") {
    window.renderPlayersLandingPage();
  }


  // ============ ASYNC WORK STARTS HERE ============
  // nothing from here up should be causing a blank / delay

  // --- 7. Load manual profiles JSON ---
  let manualProfiles = {};
  try {
    const res = await fetch("data/player-profile.json");
    if (res.ok) manualProfiles = await res.json();
  } catch (e) {
    console.warn("Failed to load player-profile.json", e);
  }

  // --- 8. Load Drive photos ---
  const drivePhotos = (typeof fetchPlayerPhotosFromDrive === "function")
    ? await fetchPlayerPhotosFromDrive()
    : {};


  // --- 9. Build global playerProfiles ---
  const sheetPlayers = await getAllPlayersFromSheets();
  const jsonPlayers = Object.keys(manualProfiles);

  const fullList = Array.from(new Set([...sheetPlayers, ...jsonPlayers])).sort();

  window.playerProfiles = {};
  fullList.forEach(name => {
    const key = name.trim().toLowerCase();
    const src = manualProfiles[name] || {};

    window.playerProfiles[name] = {
      nickname: src.nickname || "",
      bio: src.bio || "",
      accolades: Array.isArray(src.accolades) ? src.accolades : [],
      role: src.role || "",
      song: src.song || "",
      photo: drivePhotos[key] || "images/default.jpg",

      // ✅ NEW
      highestCheckout: (src["highest-checkout"] || "").toString().trim(),
      gooch: (src.gooch || "").toString().trim().toLowerCase()
    };
  });



  // --- 9. Enhance header with real profile data (photo, nickname, bio, badges) ---
  if (isProfileMode) {
    const profileData =
      window.playerProfiles[playerName] ||
      { nickname: "", bio: "", photo: "images/default.jpg", accolades: [], role: "" };

    const highestEl = document.getElementById("playerHighestCheckout");
    if (highestEl) {
      const hc = (profileData.highestCheckout || "").trim();
      highestEl.innerHTML = `
    <span class="meta-label">Highest checkout:</span>
    <span class="meta-value">${hc ? escapeHtml(hc) : "No ton+ outs"}</span>
  `;
    }

    const goochEl = document.getElementById("playerGooch");
    if (goochEl) {
      const isYes = profileData.gooch === "yes" || profileData.gooch === "true";

      goochEl.innerHTML = `
    <div class="gooch-wrap">
      <div class="gooch-item">
        <span class="meta-label">Gooch:</span>
        <span class="gooch-checkbox ${isYes ? "is-yes" : ""}" aria-label="Gooch"></span>
      </div>

      <div class="bagel-item">
        <span class="meta-label">Bagels:</span>
        <span class="meta-value" id="playerBagels">—</span>
      </div>
    </div>
  `;
    }



    function toSpotifyEmbedUrl(url) {
      if (!url) return "";
      try {
        const u = new URL(url);
        if (!u.hostname.includes("spotify.com")) return "";
        u.search = ""; // strip ?si= etc
        const path = u.pathname.replace(/^\/+/, "");
        return path.startsWith("embed/")
          ? `https://open.spotify.com/${path}`
          : `https://open.spotify.com/embed/${path}`;
      } catch {
        return "";
      }
    }

    const walkoutEl = document.getElementById("playerWalkout");
    if (walkoutEl) {
      const embedUrl = toSpotifyEmbedUrl(profileData.song);

      // Find a wrapper to hide (edit selectors to match your markup)
      const walkoutWrapper =
        walkoutEl.closest(".meta-row") ||      // if you use rows like <div class="meta-row">
        walkoutEl.closest(".player-meta-row") ||
        walkoutEl.parentElement;              // fallback: just hide its parent

      if (walkoutWrapper) walkoutWrapper.style.display = embedUrl ? "" : "none";

      walkoutEl.innerHTML = embedUrl
        ? `<iframe
         src="${embedUrl}"
         width="300"
         height="80"
         frameborder="0"
         allow="encrypted-media"
         loading="lazy"
         title="Walkout song"
       ></iframe>`
        : "";
    }




    if (photoEl) {
      const frame = document.getElementById("profilePhotoFrame");

      if (frame) frame.classList.add("is-loading");

      const done = () => frame && frame.classList.remove("is-loading");

      // remove old handlers to avoid stacking if navigating between players
      photoEl.onload = null;
      photoEl.onerror = null;

      photoEl.onload = done;
      photoEl.onerror = done;

      photoEl.src = profileData.photo || "images/default.jpg";

      // if already cached, complete may already be true
      if (photoEl.complete) done();
    }


    if (nicknameEl) {
      nicknameEl.innerHTML = profileData.nickname
        ? `<span class="meta-label">Nickname:</span>
       <span class="meta-value">"${escapeHtml(profileData.nickname)}"</span>`
        : "";
    }

    const bioRow = document.getElementById("playerBioRow");
    if (bioRow) {
      bioRow.innerHTML = profileData.bio
        ? `<span class="meta-label">Bio:</span>
       <span class="meta-value">${escapeHtml(profileData.bio)}</span>`
        : "";
    }


    const captainEl = document.getElementById("captainBadge");
    if (captainEl) {
      const role = (profileData.role || "").toLowerCase();
      if (role === "captain") {
        captainEl.innerHTML = `<span>🟦 Captain</span>`;
      } else if (role === "vice-captain") {
        captainEl.innerHTML = `<span>🟩 Vice Captain</span>`;
      } else {
        captainEl.innerHTML = "";
      }
    }

    const accEl = document.getElementById("profilePhotoAccolades");

    if (accEl) {
      const html = makeProfileAccoladesHtml(profileData);

      if (html) {
        accEl.innerHTML = html;
        accEl.style.display = ""; // reveal ONLY now
      } else {
        accEl.innerHTML = "";
        accEl.style.display = "none"; // fully gone
      }
    }
  }


  // --- 10. Build TRUE full dropdown: JSON + spreadsheet players ---
  try {
    const fullList = Object.keys(window.playerProfiles).sort();


    const current = playerSelect.value;

    playerSelect.innerHTML = "";

    // Optional placeholder when no player selected
    if (!isProfileMode) {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Select player";
      placeholder.selected = true;
      placeholder.disabled = true;
      playerSelect.appendChild(placeholder);
    }


    // all players
    fullList.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (name === current) opt.selected = true;
      playerSelect.appendChild(opt);
    });

  } catch (err) {
    console.error("Dropdown build error:", err);
  }


  // --- 11. Finally, load stats & appearances (they replace the spinners) ---
  if (isProfileMode) {
    await loadOverallTotals();
    await loadSeasonData("all");
    await updateMedals(overallTotals);
  }
});

// Back button → go to All Players landing
document.addEventListener("click", e => {
  if (e.target.id === "backToPlayers") {
    window.location.href = "players-profile.html"; // shows landing page
  }
});


// ---------- SEASON / LEAGUE FILTERS ----------
document.addEventListener("click", (e) => {
  const seasonBtn = e.target.closest(".season-btn");
  const leagueBtn = e.target.closest(".league-btn");

  if (seasonBtn) {
    document.querySelectorAll(".season-btn").forEach(b => b.classList.remove("active"));
    seasonBtn.classList.add("active");
    selectedSeason = seasonBtn.dataset.season;
    updateStatsVisibility();
    renderFilteredAppearances();
    return;
  }

  if (leagueBtn) {
    document.querySelectorAll(".league-btn").forEach(b => b.classList.remove("active"));
    leagueBtn.classList.add("active");
    selectedLeague = leagueBtn.dataset.league;
    updateStatsVisibility();
    renderFilteredAppearances();
    return;
  }
});

// ---------- SEASON DATA (table + appearances) ----------
async function loadSeasonData(season) {
  selectedSeason = season;

  const appsEl = document.getElementById("playerAppearancesWrapper");
  if (appsEl) {
    appsEl.innerHTML = `
      <div class="loading"><div class="spinner"></div><p>Loading appearances...</p></div>
    `;
  }

  try {
    const [
      banks2625,
      traf2625,
      apps2625,
      banks2425,
      apps2425
    ] = await Promise.all([
      fetchCSV(SHEETS.banks["25-26"]),
      fetchCSV(SHEETS.traf["25-26"]),
      fetchCSV(SHEETS.appearances["25-26"]),
      fetchCSV("data/banks-stats-24-25.json"),
      fetchCSV("data/result-data-24-25.json")
    ]);

    const getSummary = (rows) => {
      if (!Array.isArray(rows)) {
        return { Played: 0, Checkouts: 0, Fines: 0, "180s": 0, Bulls: 0, "Ton+": 0 };
      }
      const row = rows.find(r =>
        (r.Player || r.Name || "").toLowerCase() === playerName.toLowerCase()
      );
      if (!row) {
        return { Played: 0, Checkouts: 0, Fines: 0, "180s": 0, Bulls: 0, "Ton+": 0 };
      }
      return {
        Played: getStatFromRow(row, KEYS.played),
        Checkouts: getStatFromRow(row, KEYS.checkouts),
        Fines: getStatFromRow(row, KEYS.fines),
        "180s": getStatFromRow(row, KEYS.one80s),
        Bulls: getStatFromRow(row, KEYS.bulls),
        "Ton+": getStatFromRow(row, KEYS.tonPlus)
      };
    };

    const countWL = (rows) => {
      let wins = 0;
      let losses = 0;
      for (const r of rows) {
        if (!playerAppearsInRow(r, playerName)) continue;
        const result = (r.Result || "").toLowerCase();
        if (result.startsWith("w")) wins++;
        if (result.startsWith("l")) losses++;
      }
      return { wins, losses };
    };

    const countBagelsLocal = (rows) => {
      let bagels = 0;
      for (const r of rows) {
        if (!playerAppearsInRow(r, playerName)) continue;
        const p = extractPlayerMatchStatsFromRow(r, playerName);
        if (p.checkouts === 0) bagels++;
      }
      return bagels;
    };

    const makeRates = (s) => ({
      CheckoutsPerGame: s.Played ? (s.Checkouts / s.Played).toFixed(2) : "0.00",
      FinesPerGame: s.Played ? (s.Fines / s.Played).toFixed(2) : "0.00"
    });

    const banks2625Stats = getSummary(banks2625);
    const traf2625Stats = getSummary(traf2625);
    const wl2625 = countWL(apps2625);

    const stats2625 = {
      Played: banks2625Stats.Played + traf2625Stats.Played,
      Wins: wl2625.wins,
      Losses: wl2625.losses,
      Checkouts: banks2625Stats.Checkouts + traf2625Stats.Checkouts,
      Fines: banks2625Stats.Fines + traf2625Stats.Fines,
      "180s": banks2625Stats["180s"] + traf2625Stats["180s"],
      Bulls: banks2625Stats.Bulls + traf2625Stats.Bulls,
      "Ton+": banks2625Stats["Ton+"] + traf2625Stats["Ton+"],
      Bagels: countBagelsLocal(apps2625)
    };

    const wlBanks2625 = countWL(
      apps2625.filter(r => leagueInfoFromRow(r).name === "banks")
    );
    const statsBanks2625 = {
      ...banks2625Stats,
      Wins: wlBanks2625.wins,
      Losses: wlBanks2625.losses,
      Bagels: countBagelsLocal(
        apps2625.filter(r => leagueInfoFromRow(r).name === "banks")
      )
    };

    const wlTraf2625 = countWL(
      apps2625.filter(r => leagueInfoFromRow(r).name === "traf")
    );
    const statsTraf2625 = {
      ...traf2625Stats,
      Wins: wlTraf2625.wins,
      Losses: wlTraf2625.losses,
      Bagels: countBagelsLocal(
        apps2625.filter(r => leagueInfoFromRow(r).name === "traf")
      )
    };

    const banks2425StatsObj = getSummary(banks2425);
    const wl2425 = countWL(apps2425);
    const stats2425 = {
      ...banks2425StatsObj,
      Wins: wl2425.wins,
      Losses: wl2425.losses,
      Bagels: countBagelsLocal(apps2425)
    };

    const overall = {
      Played: stats2625.Played + stats2425.Played,
      Wins: stats2625.Wins + stats2425.Wins,
      Losses: stats2625.Losses + stats2425.Losses,
      Checkouts: stats2625.Checkouts + stats2425.Checkouts,
      Fines: stats2625.Fines + stats2425.Fines,
      "180s": stats2625["180s"] + stats2425["180s"],
      Bulls: stats2625.Bulls + stats2425.Bulls,
      "Ton+": stats2625["Ton+"] + stats2425["Ton+"],
      Bagels: stats2625.Bagels + stats2425.Bagels
    };

    const payload = {
      overall: {
        ...overall,
        ...makeRates(overall),
        specialsHtml: makeSpecialsHtml(overall)
      },
      season: {
        ...stats2625,
        ...makeRates(stats2625),
        specialsHtml: makeSpecialsHtml(stats2625)
      },
      banks2625: {
        ...statsBanks2625,
        ...makeRates(statsBanks2625),
        specialsHtml: makeSpecialsHtml(statsBanks2625)
      },
      traf2625: {
        ...statsTraf2625,
        ...makeRates(statsTraf2625),
        specialsHtml: makeSpecialsHtml(statsTraf2625)
      },
      banks2425: {
        ...stats2425,
        ...makeRates(stats2425),
        specialsHtml: makeSpecialsHtml(stats2425)
      }
    };

    updateStatsTable(payload);

    // ✅ Update Bagels in profile header
    const bagelsEl = document.getElementById("playerBagels");
    if (bagelsEl && payload?.overall?.Bagels != null) {
      bagelsEl.textContent = payload.overall.Bagels;
    }

    const statRows = document.querySelectorAll(".player-stats-table .stats-row");
    statRows.forEach((row, i) => {
      row.style.animationDelay = `${i * 0.07}s`;
    });
    initTooltips();

    await renderFilteredAppearances();

  } catch (err) {
    console.error("loadSeasonData error:", err);
    if (appsEl) {
      appsEl.innerHTML = `<p style="color:#f66;">Error loading appearances</p>`;
    }
  }
}
