/* fixtures.js */
(() => {
  const TEAM = "Oche Ness Monsters";
  const FIXTURES_URL = "data/fixtures-25-26.json";
  const RESULTS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=858987471&single=true&output=csv";

  // Change this to match your site:
  const RESULTS_PAGE_URL = (fx) =>
    `results.html?date=${encodeURIComponent(fx.dateISO)}&opp=${encodeURIComponent(fx.Opponent)}&ha=${encodeURIComponent(fx.HA)}`;


  const el = (sel) => document.querySelector(sel);

  function ordinalStrip(s) {
    return String(s).replace(/(\d+)(st|nd|rd|th)/gi, "$1");
  }

  function parseFixtureDate(dateStr) {
    // Expects: "7th Jan 2026" or "7th Oct 2025" etc
    // We'll parse robustly.
    const s = ordinalStrip(dateStr).trim();
    // "7 Jan 2026"
    const parts = s.split(/\s+/);
    if (parts.length < 3) return null;

    const day = parseInt(parts[0], 10);
    const mon = parts[1].toLowerCase();
    const year = parseInt(parts[2], 10);

    const monthMap = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11
    };
    const m3 = mon.slice(0, 3);
    const month = monthMap[m3];
    if (Number.isNaN(day) || Number.isNaN(year) || month === undefined) return null;

    // Local time noon to avoid DST edge cases
    return new Date(year, month, day, 12, 0, 0, 0);
  }

  function getOpponentAndHAFromResultRow(homeTeam, awayTeam) {
    const homeN = normalizeName(homeTeam);
    const awayN = normalizeName(awayTeam);
    const teamN = normalizeName(TEAM);

    if (homeN === teamN && awayN && awayN !== teamN) {
      // We were home, opponent away
      return { opponent: awayTeam, ha: "Home" };
    }
    if (awayN === teamN && homeN && homeN !== teamN) {
      // We were away, opponent home
      return { opponent: homeTeam, ha: "Away" };
    }
    return null; // row doesn't involve us or is malformed
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }


  function parseCsvDate(value) {
    if (!value) return null;
    const s = String(value).trim();

    // Prefer DD/MM/YY(YY)
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10) - 1;
      let yyyy = parseInt(m[3], 10);
      if (yyyy < 100) yyyy += 2000; // 26 -> 2026
      return new Date(yyyy, mm, dd, 12, 0, 0, 0);
    }

    // Fallback: try native
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);

    // Fallback: "7th Jan 2026"
    return parseFixtureDate(s);
  }


  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function normalizeLeague(raw) {
    const s = String(raw || "").toLowerCase();
    if (s.includes("banks")) return "Banks";
    if (s.includes("trafalgar")) return "Trafalgar";
    if (s.includes("cup") || s.includes("ko")) return "Cup";
    return "Competition";
  }

  function leagueClass(league) {
    const l = String(league || "").toLowerCase();
    if (l === "banks") return "banks";
    if (l === "trafalgar") return "trafalgar";
    if (l === "cup") return "cup";
    return "competition";
  }

  function parseCSV(text) {
    // Minimal CSV parser: handles quoted fields, commas, newlines
    const rows = [];
    let cur = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"' && inQuotes && next === '"') {
        field += '"'; i++; continue;
      }
      if (c === '"') {
        inQuotes = !inQuotes; continue;
      }
      if (c === ',' && !inQuotes) {
        cur.push(field); field = ""; continue;
      }
      if ((c === '\n' || c === '\r') && !inQuotes) {
        if (c === '\r' && next === '\n') i++;
        cur.push(field); field = "";
        if (cur.some(v => String(v).trim() !== "")) rows.push(cur);
        cur = [];
        continue;
      }
      field += c;
    }
    cur.push(field);
    if (cur.some(v => String(v).trim() !== "")) rows.push(cur);

    const headers = rows.shift().map(h => String(h).trim());
    return rows.map(r => {
      const obj = {};
      headers.forEach((h, idx) => obj[h] = r[idx] ?? "");
      return obj;
    });
  }

  function renderLoadingSkeleton(count = 3) {
    const stage = el("#fixturesStage");
    if (!stage) return;
    stage.innerHTML = Array.from({ length: count })
      .map(() => `<div class="fxSkeleton"><div class="fxSpinner"></div></div>`)
      .join("");
  }

  function buildFixtureTeams(fx) {
    const haRaw = String(fx.HA || "").trim().toLowerCase();

    const isHome = (haRaw === "home" || haRaw === "h");
    const isAway = (haRaw === "away" || haRaw === "a");

    if (isHome) return { home: TEAM, away: fx.Opponent };
    if (isAway) return { home: fx.Opponent, away: TEAM };

    // Unknown/NA: keep a sane default but DO NOT truncate names
    return { home: TEAM, away: fx.Opponent };
  }


  function computeOutcome(home, away, hs, as) {
    const homeScore = Number(hs);
    const awayScore = Number(as);
    if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) return "neutral";

    const weAreHome = String(home).trim().toLowerCase() === TEAM.toLowerCase();
    const ourScore = weAreHome ? homeScore : awayScore;
    const theirScore = weAreHome ? awayScore : homeScore;

    if (ourScore > theirScore) return "win";
    if (ourScore < theirScore) return "loss";
    return "neutral";
  }

  function todayNoon() {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 12);
  }

  function applyResultsToFixtures(fixtures, resultsRows) {
    const resultsArr = [];

    for (const r of resultsRows) {
      const d = parseCsvDate(r.Date || r.date);
      if (!d) continue;

      const homeTeam = (r.HomeTeam ?? r.homeTeam ?? r.Home ?? "").trim();
      const awayTeam = (r.AwayTeam ?? r.awayTeam ?? r.Away ?? "").trim();

      const derived = getOpponentAndHAFromResultRow(homeTeam, awayTeam);
      if (!derived) continue;

      resultsArr.push({
        dateObj: d,
        homeTeam,
        awayTeam,
        opponent: derived.opponent,
        ha: derived.ha,
        homeScore: (r.HomeScore ?? r.homeScore ?? r["Home Score"] ?? "").trim(),
        awayScore: (r.AwayScore ?? r.awayScore ?? r["Away Score"] ?? "").trim()
      });
    }

    const today = todayNoon();

    return fixtures.map(fx => {
      const d = fx.dateObj;
      const res = findBestResultMatchByOpponent(resultsArr, d, fx.Opponent, fx.HA);

      const fixtureInFuture = d > today;
      const hasScores = !!(res && res.homeScore !== "" && res.awayScore !== "");
      const isCompleted = !fixtureInFuture && hasScores;

      let displayHomeScore = null;
      let displayAwayScore = null;

      if (isCompleted) {
        const fxHomeN = normalizeName(fx.homeTeam);
        const resHomeN = normalizeName(res.homeTeam);

        const sheetHomeScore = Number(res.homeScore);
        const sheetAwayScore = Number(res.awayScore);

        const swapped = fxHomeN !== resHomeN;
        displayHomeScore = swapped ? sheetAwayScore : sheetHomeScore;
        displayAwayScore = swapped ? sheetHomeScore : sheetAwayScore;
      }

      const outcome = isCompleted
        ? computeOutcome(fx.homeTeam, fx.awayTeam, displayHomeScore, displayAwayScore)
        : "neutral";

      return {
        ...fx,
        completed: isCompleted,
        pendingResult: !isCompleted && (fx.dateObj < today),
        homeScore: isCompleted ? displayHomeScore : null,
        awayScore: isCompleted ? displayAwayScore : null,
        outcome
      };
    });
  }


  function normalizeName(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[’']/g, "")
      .replace(/\s+/g, " ");
  }

  function daysBetween(a, b) {
    const ms = 24 * 60 * 60 * 1000;
    return Math.round((a - b) / ms);
  }

  function findBestResultMatchByOpponent(resultsArr, fxDate, fxOpponent, fxHA) {
    const oppN = normalizeName(fxOpponent);
    const haN = String(fxHA || "").trim().toLowerCase(); // "home"/"away"

    // Filter by same opponent + same HA
    const candidates = resultsArr.filter(r =>
      normalizeName(r.opponent) === oppN &&
      String(r.ha).toLowerCase() === haN
    );

    if (!candidates.length) return null;

    // Pick nearest by date (prefer exact same day, else nearest within tolerance)
    const toleranceDays = 3;
    let best = null;
    let bestAbs = Infinity;

    for (const c of candidates) {
      if (!c.dateObj) continue;

      if (sameDay(c.dateObj, fxDate)) return c;

      const abs = Math.abs(daysBetween(c.dateObj, fxDate));
      if (abs < bestAbs) {
        bestAbs = abs;
        best = c;
      }
    }

    if (best && bestAbs <= toleranceDays) return best;
    return null;
  }

  async function loadData() {
    const [fixturesRes, resultsRes] = await Promise.all([
      fetch(FIXTURES_URL, { cache: "no-store" }),
      fetch(RESULTS_CSV_URL, { cache: "no-store" })
    ]);

    const fixtures = await fixturesRes.json();
    const csvText = await resultsRes.text();
    const resultsRows = parseCSV(csvText);

    // Build results array that only includes rows involving Oche Ness Monsters,
    // and adds derived opponent + HA ("Home"/"Away")
    const resultsArr = [];
    for (const r of resultsRows) {
      const d = parseCsvDate(r.Date || r.date);
      if (!d) continue;

      const homeTeam = (r.HomeTeam ?? r.homeTeam ?? r.Home ?? "").trim();
      const awayTeam = (r.AwayTeam ?? r.awayTeam ?? r.Away ?? "").trim();

      const derived = getOpponentAndHAFromResultRow(homeTeam, awayTeam);
      if (!derived) continue;

      const homeScore = (r.HomeScore ?? r.homeScore ?? r["Home Score"] ?? "").trim();
      const awayScore = (r.AwayScore ?? r.awayScore ?? r["Away Score"] ?? "").trim();

      resultsArr.push({
        dateObj: d,
        dateISO: toISODate(d),
        homeTeam,
        awayTeam,
        opponent: derived.opponent,
        ha: derived.ha, // "Home" or "Away" from OUR perspective
        homeScore,
        awayScore,
        resultText: (r.Result ?? r.result ?? "").trim()
      });
    }

    const today = todayNoon();

    const normalized = fixtures.map(fx => {
      const d = parseFixtureDate(fx.Date);
      if (!d) return null;

      const iso = toISODate(d);

      // League title comes from your JSON now exactly as you want it displayed
      const leagueTitle = fx.League || "";
      const leagueCls = leagueClass(normalizeLeague(leagueTitle)); // for Banks/Traf colors

      const teams = buildFixtureTeams(fx);

      // Match by Opponent + HA + Date
      const res = findBestResultMatchByOpponent(resultsArr, d, fx.Opponent, fx.HA);

      // Guardrail: future fixtures can NEVER be completed
      const fixtureInFuture = d > today;

      const hasScores = !!(res && res.homeScore !== "" && res.awayScore !== "");
      const isCompleted = !fixtureInFuture && hasScores;

      // Translate sheet scores into fixture home/away scores correctly
      let displayHomeScore = null;
      let displayAwayScore = null;

      if (isCompleted) {
        // res.homeScore is score for res.homeTeam, etc.
        // Our fixture has homeTeam/awayTeam.
        const fxHomeN = normalizeName(teams.home);
        const resHomeN = normalizeName(res.homeTeam);

        const sheetHomeScore = Number(res.homeScore);
        const sheetAwayScore = Number(res.awayScore);

        // If fixture homeTeam == sheet homeTeam, keep as-is. Otherwise swap.
        const swapped = fxHomeN !== resHomeN;

        displayHomeScore = swapped ? sheetAwayScore : sheetHomeScore;
        displayAwayScore = swapped ? sheetHomeScore : sheetAwayScore;
      }

      const outcome = isCompleted
        ? computeOutcome(teams.home, teams.away, displayHomeScore, displayAwayScore)
        : "neutral";

      return {
        ...fx,
        leagueTitle,
        leagueClass: leagueCls,
        dateObj: d,
        dateISO: iso,
        homeTeam: teams.home,
        awayTeam: teams.away,
        completed: isCompleted,
        homeScore: isCompleted ? displayHomeScore : null,
        awayScore: isCompleted ? displayAwayScore : null,
        outcome
      };
    }).filter(Boolean);

    normalized.sort((a, b) => a.dateObj - b.dateObj);
    return normalized;
  }






  function renderCard(fx, showMonthDivider, isNextFixture) {
    const pillClass = fx.leagueClass; // banks/trafalgar/cup/competition
    const nextBadgeHtml = isNextFixture ? `<div class="nextFixtureBadge">Next Fixture</div>` : "";



    const scoreBoxHtml = fx.completed
      ? `<div class="score ${fx.outcome}">${fx.homeScore} - ${fx.awayScore}</div>`
      : fx.pendingResult
        ? `<div class="score pending"><span class="miniSpinner"></span></div>`
        : `<div class="score vs">VS</div>`;


    const venueHtml = fx.Location
      ? `<div class="match-venue" title="${fx.Location}">
         <img src="https://cdn.jsdelivr.net/npm/lucide-static/icons/map-pin.svg" alt="Venue" class="venue-icon">
         <span class="venue-name">${fx.Location}</span>
       </div>`
      : "";

    const resultCardHtml = fx.completed
      ? `<a class="fxResultLink" href="${RESULTS_PAGE_URL(fx)}" aria-label="View result card">
       Result Card <span class="fxArrow">→</span>
     </a>`
      : "";


    return `
    <div class="fxCard ${fx.leagueClass} ${(fx.completed || fx.pendingResult) ? "" : "upcoming"}">



      <div class="fxTopRow">
        <div class="fxLeaguePill ${pillClass}">
          ${String(fx.leagueTitle || "").toUpperCase()}
        </div>
        ${nextBadgeHtml}
      </div>

      <div class="fxMainRow">
        <div class="fxTeam fxTeamLeft" title="${fx.homeTeam}">${fx.homeTeam}</div>
        ${scoreBoxHtml}
        <div class="fxTeam fxTeamRight" title="${fx.awayTeam}">${fx.awayTeam}</div>
      </div>

      <div class="fxDate">${fx.Date}</div>

      <div class="fxBottomRow">
        ${venueHtml}
        ${resultCardHtml}
      </div>
    </div>
  `;
  }



  function initialIndex(fixtures) {
    const t = todayNoon();
    // next upcoming (date >= today and not completed OR even if completed, still future)
    let idx = fixtures.findIndex(f => f.dateObj >= t && !f.completed);
    if (idx === -1) idx = fixtures.findIndex(f => f.dateObj >= t);
    if (idx === -1) idx = Math.max(0, fixtures.length - 1);
    return idx;
  }

  function mountCarousel(initialFixtures) {
    let fixtures = initialFixtures;
    let anchor = initialIndex(fixtures);

    const stage = el("#fixturesStage");
    const prevBtn = el("#fixturesPrev");
    const nextBtn = el("#fixturesNext");

    function perView() {
      if (window.matchMedia("(max-width: 650px)").matches) return 1;
      if (window.matchMedia("(max-width: 980px)").matches) return 2;
      return 3;
    }

    function nextUpcomingIndex() {
      return fixtures.findIndex(f => f.dateObj >= todayNoon() && !f.completed);
    }

    function update() {
      const max = fixtures.length - 1;
      const view = perView();

      const prev = Math.max(0, anchor - 1);
      const next = Math.min(max, anchor + 1);

      let indices;
      if (view === 3) indices = [prev, anchor, next];
      else if (view === 2) indices = [prev, next];
      else indices = [anchor];

      indices = indices.filter((v, i, a) => a.indexOf(v) === i);

      const nxtIdx = nextUpcomingIndex();

      // Render cards
      let html = indices
        .map(i => renderCard(fixtures[i], false, i === nxtIdx))
        .join("");

      // End-of-season message when you're at the last fixture
      if (anchor >= max) {
        html += `
        <div class="fxEnd">
          NO MORE FIXTURES
          <small>this season</small>
        </div>
      `;
      }

      stage.innerHTML = html;

      prevBtn.disabled = anchor <= 0;
      nextBtn.disabled = anchor >= max;
    }

    prevBtn.addEventListener("click", () => {
      anchor = Math.max(0, anchor - 1);
      update();
    });

    nextBtn.addEventListener("click", () => {
      anchor = Math.min(fixtures.length - 1, anchor + 1);
      update();
    });

    window.addEventListener("resize", update);

    // Start anchored to next upcoming if possible
    const t = todayNoon();
    const upcoming = fixtures.findIndex(f => f.dateObj >= t && !f.completed);
    if (upcoming !== -1) anchor = upcoming;

    update();

    // allow external updates after results load
    return {
      setFixtures(newFixtures) {
        fixtures = newFixtures;
        anchor = Math.min(anchor, fixtures.length - 1);
        update();
      }
    };
  }

  function normalizeFixturesOnly(fixtures) {
    const today = todayNoon();

    const normalized = fixtures.map(fx => {
      const d = parseFixtureDate(fx.Date);
      if (!d) return null;

      const iso = toISODate(d);

      const leagueTitle = fx.League || "";
      const leagueCls = leagueClass(normalizeLeague(leagueTitle));

      const teams = buildFixtureTeams(fx);

      const isPast = d < today;
      const isFuture = d > today;

      return {
        ...fx,
        leagueTitle,
        leagueClass: leagueCls,
        dateObj: d,
        dateISO: iso,
        homeTeam: teams.home,
        awayTeam: teams.away,

        // BEFORE results load:
        // - past fixtures = pending result (show spinner in score box, style like completed)
        // - future fixtures = upcoming (VS)
        pendingResult: isPast,          // ✅ new
        completed: false,
        homeScore: null,
        awayScore: null,
        outcome: "neutral",

        _inFuture: isFuture
      };
    }).filter(Boolean);

    normalized.sort((a, b) => a.dateObj - b.dateObj);
    return normalized;
  }


  async function init() {
    renderLoadingSkeleton(3);

    // 1) Load fixtures JSON first
    const fixturesRes = await fetch(FIXTURES_URL, { cache: "no-store" });
    if (!fixturesRes.ok) throw new Error(`Failed to load fixtures JSON: ${fixturesRes.status}`);
    const fixturesRaw = await fixturesRes.json();

    const fixturesOnly = normalizeFixturesOnly(fixturesRaw);

    // Mount carousel immediately with JSON-only data
    const carousel = mountCarousel(fixturesOnly);

    // 2) Then load results CSV and patch (non-blocking)
    try {
      const resultsRes = await fetch(RESULTS_CSV_URL, { cache: "no-store" });
      if (!resultsRes.ok) throw new Error(`Failed to load results CSV: ${resultsRes.status}`);
      const csvText = await resultsRes.text();
      const rows = parseCSV(csvText);

      const merged = applyResultsToFixtures(fixturesOnly, rows);
      carousel.setFixtures(merged);  // updates rendered cards with scores/links
    } catch (e) {
      console.warn("Results CSV failed, showing fixtures without scores.", e);
    }
  }


  document.addEventListener("DOMContentLoaded", () => {
    // only run if the mount exists
    if (!el("#fixturesBanner")) return;
    init().catch(err => {
      console.error("Fixtures banner failed:", err);
      const stage = el("#fixturesStage");
      if (stage) stage.innerHTML = `<div class="fixturesCard competition"><div class="leagueLine">Fixtures</div><div class="metaLine"><span>Could not load fixtures/results.</span></div></div>`;
    });
  });
})();
