/* fixtures.js */
(() => {
  const TEAM = "Oche Ness Monsters";
  const FIXTURES_URL = "./data/fixtures-26-27.json";
  const RESULTS_URL = "data/result-data-25-26.json";

  const RESULTS_PAGE_URL = (fx) =>
    `results.html?date=${encodeURIComponent(fx.dateISO)}&opp=${encodeURIComponent(fx.Opponent)}&ha=${encodeURIComponent(fx.HA)}&season=${encodeURIComponent(fx.season || "25-26")}&competition=${encodeURIComponent(fx.Competition || fx.League)}`;


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

    if (isOnmTeam(homeTeam) && awayN && !isOnmTeam(awayTeam)) {
      // We were home, opponent away
      return { opponent: awayTeam, ha: "Home" };
    }
    if (isOnmTeam(awayTeam) && homeN && !isOnmTeam(homeTeam)) {
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
    const s = String(raw || "").trim().toLowerCase();
    if (s === "colda a") return "COLDA A";
    if (s === "colda b") return "COLDA B";
    if (s.includes("smithfield")) return "Smithfield";
    if (s.includes("banks") && s.includes("cup")) return "Banks Cup";
    if (s.includes("trafalgar") && s !== "trafalgar league" && s !== "trafalgar") return "Trafalgar Cup";
    if (s.includes("banks")) return "Banks";
    if (s.includes("trafalgar")) return "Trafalgar";
    if (s.includes("cup") || s.includes("ko")) return "Cup";
    return "Competition";
  }

  function leagueClass(league) {
    const l = String(league || "").toLowerCase();
    if (l === "colda a") return "colda-a";
    if (l === "colda b") return "colda-b";
    if (l === "smithfield") return "smithfield";
    if (l === "banks cup") return "banks-cup";
    if (l === "trafalgar cup") return "trafalgar-cup";
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
    const onmTeam = getOnmTeamForFixture(fx);

    const isHome = (haRaw === "home" || haRaw === "h");
    const isAway = (haRaw === "away" || haRaw === "a");

    if (isHome) return { home: onmTeam, away: fx.Opponent };
    if (isAway) return { home: fx.Opponent, away: onmTeam };

    // Unknown/NA: keep a sane default but DO NOT truncate names
    return { home: onmTeam, away: fx.Opponent };
  }


  function computeOutcome(home, away, hs, as) {
    const homeScore = Number(hs);
    const awayScore = Number(as);
    if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) return "neutral";

    const weAreHome = isOnmTeam(home);
    const ourScore = weAreHome ? homeScore : awayScore;
    const theirScore = weAreHome ? awayScore : homeScore;

    if (ourScore > theirScore) return "win";
    if (ourScore < theirScore) return "loss";
    return "neutral";
  }

  function isColdaLeague(league) {
    return String(league || "").trim().toUpperCase() === "COLDA A" ||
      String(league || "").trim().toUpperCase() === "COLDA B";
  }

  function getResultField(row, ...keys) {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }

    return "";
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
        awayScore: (r.AwayScore ?? r.awayScore ?? r["Away Score"] ?? "").trim(),
        homePoints: getResultField(r, "HomePoints", "Home Points", "homePoints"),
        awayPoints: getResultField(r, "AwayPoints", "Away Points", "awayPoints")
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
      let displayHomePoints = null;
      let displayAwayPoints = null;

      if (isCompleted) {
        const fxHomeN = normalizeName(fx.homeTeam);
        const resHomeN = normalizeName(res.homeTeam);

        const sheetHomeScore = Number(res.homeScore);
        const sheetAwayScore = Number(res.awayScore);
        const sheetHomePoints = res.homePoints === "" ? null : Number(res.homePoints);
        const sheetAwayPoints = res.awayPoints === "" ? null : Number(res.awayPoints);

        const swapped = fxHomeN !== resHomeN;
        displayHomeScore = swapped ? sheetAwayScore : sheetHomeScore;
        displayAwayScore = swapped ? sheetHomeScore : sheetAwayScore;
        displayHomePoints = swapped ? sheetAwayPoints : sheetHomePoints;
        displayAwayPoints = swapped ? sheetHomePoints : sheetAwayPoints;
      }

      const usePointsForOutcome = isCompleted &&
        isColdaLeague(fx.League) &&
        displayHomePoints !== null &&
        displayAwayPoints !== null;
      const outcome = isCompleted
        ? computeOutcome(
          fx.homeTeam,
          fx.awayTeam,
          usePointsForOutcome ? displayHomePoints : displayHomeScore,
          usePointsForOutcome ? displayAwayPoints : displayAwayScore
        )
        : "neutral";

      return {
        ...fx,
        completed: isCompleted,
        pendingResult: !isCompleted && (fx.dateObj < today),
        homeScore: isCompleted ? displayHomeScore : null,
        awayScore: isCompleted ? displayAwayScore : null,
        homePoints: isCompleted ? displayHomePoints : null,
        awayPoints: isCompleted ? displayAwayPoints : null,
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

  function isOnmTeam(teamName) {
    const team = normalizeName(teamName);
    return team === normalizeName(TEAM) ||
      team === normalizeName(`${TEAM} A`) ||
      team === normalizeName(`${TEAM} B`);
  }

  function getOnmTeamForFixture(fx) {
    const league = String(fx.League || "").trim().toUpperCase();

    if (league === "COLDA A") return `${TEAM} B`;
    if (league === "COLDA B") return `${TEAM} A`;

    return TEAM;
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
      fetch(RESULTS_URL, { cache: "no-store" })
    ]);

    const fixtures = await fixturesRes.json();
    const resultsRows = await resultsRes.json();

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
      const homePoints = getResultField(r, "HomePoints", "Home Points", "homePoints");
      const awayPoints = getResultField(r, "AwayPoints", "Away Points", "awayPoints");

      resultsArr.push({
        dateObj: d,
        dateISO: toISODate(d),
        homeTeam,
        awayTeam,
        opponent: derived.opponent,
        ha: derived.ha, // "Home" or "Away" from OUR perspective
        homeScore,
        awayScore,
        homePoints,
        awayPoints,
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
      let displayHomePoints = null;
      let displayAwayPoints = null;

      if (isCompleted) {
        // res.homeScore is score for res.homeTeam, etc.
        // Our fixture has homeTeam/awayTeam.
        const fxHomeN = normalizeName(teams.home);
        const resHomeN = normalizeName(res.homeTeam);

        const sheetHomeScore = Number(res.homeScore);
        const sheetAwayScore = Number(res.awayScore);
        const sheetHomePoints = res.homePoints === "" ? null : Number(res.homePoints);
        const sheetAwayPoints = res.awayPoints === "" ? null : Number(res.awayPoints);

        // If fixture homeTeam == sheet homeTeam, keep as-is. Otherwise swap.
        const swapped = fxHomeN !== resHomeN;

        displayHomeScore = swapped ? sheetAwayScore : sheetHomeScore;
        displayAwayScore = swapped ? sheetHomeScore : sheetAwayScore;
        displayHomePoints = swapped ? sheetAwayPoints : sheetHomePoints;
        displayAwayPoints = swapped ? sheetHomePoints : sheetAwayPoints;
      }

      const usePointsForOutcome = isCompleted &&
        isColdaLeague(leagueTitle) &&
        displayHomePoints !== null &&
        displayAwayPoints !== null;
      const outcome = isCompleted
        ? computeOutcome(
          teams.home,
          teams.away,
          usePointsForOutcome ? displayHomePoints : displayHomeScore,
          usePointsForOutcome ? displayAwayPoints : displayAwayScore
        )
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
        homePoints: isCompleted ? displayHomePoints : null,
        awayPoints: isCompleted ? displayAwayPoints : null,
        outcome
      };
    }).filter(Boolean);

    normalized.sort((a, b) => a.dateObj - b.dateObj);
    return normalized;
  }






  function renderCard(fx, showMonthDivider, isNextFixture) {
    const pillClass = fx.leagueClass; // banks/trafalgar/cup/competition
    const nextBadgeHtml = isNextFixture ? `<div class="nextFixtureBadge">Next Fixture</div>` : "";



    const pointsHtml = fx.completed &&
      isColdaLeague(fx.leagueTitle) &&
      fx.homePoints !== null &&
      fx.awayPoints !== null
      ? `<span class="fixture-points-score">${fx.homePoints} - ${fx.awayPoints} pts</span>`
      : "";

    const scoreBoxHtml = fx.completed
      ? `<div class="score ${fx.outcome}">${fx.homeScore} - ${fx.awayScore}${pointsHtml}</div>`
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
      if (!fixtures.length) {
        stage.innerHTML = '<p class="fixtureCalendarEmpty">No fixtures scheduled yet.</p>';
        prevBtn.disabled = nextBtn.disabled = true;
        return;
      }
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


  function escapeFixtureText(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function calendarResultEvents(rows) {
    return rows.flatMap(row => {
      const dateObj = parseCsvDate(row.Date);
      const side = getOpponentAndHAFromResultRow(row.HomeTeam, row.AwayTeam);
      const homeScore = getResultField(row, "HomeScore");
      const awayScore = getResultField(row, "AwayScore");
      if (!dateObj || !side || homeScore === "" || awayScore === "" ||
          !Number.isFinite(Number(homeScore)) || !Number.isFinite(Number(awayScore))) return [];

      const competition = String(row.Competition || "").trim();
      const isCup = /^(true|yes)$/i.test(String(row["Cup?"] || "").trim());
      const leagueTitle = isCup ? `${competition.replace(/ League$/i, "")} Cup` : competition;
      const result = String(row.Result || "").trim().toLowerCase();
      const outcome = result === "won" ? "win" : result === "lost" ? "loss" :
        computeOutcome(row.HomeTeam, row.AwayTeam, homeScore, awayScore);
      const day = dateObj.getDate();
      const suffix = day % 100 >= 11 && day % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[day % 10] || "th");
      return [{
        League: leagueTitle,
        Competition: competition,
        Day: dateObj.toLocaleDateString("en-GB", { weekday: "long" }),
        Date: `${day}${suffix} ${dateObj.toLocaleDateString("en-GB", { month: "short" })} ${dateObj.getFullYear()}`,
        Opponent: side.opponent,
        HA: side.ha,
        Location: row.Venue || "TBC",
        dateObj,
        dateISO: toISODate(dateObj),
        leagueTitle,
        leagueClass: leagueClass(normalizeLeague(leagueTitle)),
        homeTeam: row.HomeTeam,
        awayTeam: row.AwayTeam,
        homeScore: Number(homeScore),
        awayScore: Number(awayScore),
        completed: true,
        outcome,
        season: "25-26"
      }];
    });
  }

  function mergeCalendarResults(fixtures, rows) {
    const results = calendarResultEvents(rows);
    const matchKey = fixture => [
      fixture.dateISO, normalizeName(fixture.Competition || fixture.League),
      normalizeName(fixture.Opponent), fixture.HA.toLowerCase()
    ].join("|");
    const resultsByMatch = new Map(results.map(result => [matchKey(result), result]));
    // A fixture that is already in the schedule appears once, with its result.
    const combined = fixtures.filter(fixture => !resultsByMatch.has(matchKey(fixture)));
    return [...combined, ...resultsByMatch.values()].sort((a, b) => a.dateObj - b.dateObj);
  }

  function renderCalendarEvent(fixture, index) {
    const escape = escapeFixtureText;
    const resultCode = fixture.outcome === "win" ? "W" : fixture.outcome === "loss" ? "L" : "D";
    const ourScore = fixture.HA === "Home" ? fixture.homeScore : fixture.awayScore;
    const theirScore = fixture.HA === "Home" ? fixture.awayScore : fixture.homeScore;
    const resultText = fixture.completed ? `${ourScore}-${theirScore} ${resultCode}` : "";
    const label = escape(`${fixture.Opponent}, ${fixture.HA}, ${fixture.League}, ${fixture.Date}. ${fixture.completed ? `${resultText}. View result` : "View details"}`);
    const attrs = `class="fixtureCalendarEvent ${fixture.leagueClass}" aria-label="${label}"`;
    const content = `<span class="fixtureEventSummary">
      <span class="fixtureEventOpponent">${escape(fixture.Opponent)}</span>
      ${fixture.completed ? `<span class="fixtureEventResult ${fixture.outcome}">${escape(resultText)}</span>` : ""}
      </span><span class="fixtureEventSide">${escape(fixture.HA === "TBC" ? "H/A TBC" : fixture.HA)}</span>`;
    return fixture.completed
      ? `<a ${attrs} href="${escape(RESULTS_PAGE_URL(fixture))}">${content}</a>`
      : `<button type="button" ${attrs} data-fixture-index="${index}" aria-haspopup="dialog">${content}</button>`;
  }

  function mountCalendar(initialFixtures) {
    let fixtures = initialFixtures;
    const monthNumber = date => date.getFullYear() * 12 + date.getMonth();
    const firstMonth = () => fixtures.length ? monthNumber(fixtures[0].dateObj) : monthNumber(todayNoon());
    const lastMonth = () => fixtures.length ? monthNumber(fixtures[fixtures.length - 1].dateObj) : firstMonth();
    const nextMonth = () => fixtures.length ? monthNumber(fixtures[initialIndex(fixtures)].dateObj) : firstMonth();
    let month = nextMonth();
    const grid = el("#fixtureCalendarGrid");
    const previous = el("#fixtureMonthPrev");
    const next = el("#fixtureMonthNext");
    const dialog = el("#fixtureDetails");

    function openDetails(fixture) {
      const confirmedOpponent = fixture.Opponent && fixture.Opponent !== "TBC";
      el("#fixtureDetailsContent").innerHTML = `
        <span class="fixtureCategory ${fixture.leagueClass}">${escapeFixtureText(fixture.League)}</span>
        <h3 id="fixtureDetailsTitle">${confirmedOpponent ? `vs ${escapeFixtureText(fixture.Opponent)}` : "Opponent to be confirmed"}</h3>
        <p class="fixtureDetailsTeam">${escapeFixtureText(getOnmTeamForFixture(fixture))}</p>
        <dl>
          <div><dt>Date</dt><dd>${escapeFixtureText(fixture.Day)}, ${escapeFixtureText(fixture.Date)}</dd></div>
          <div><dt>Home / Away</dt><dd>${escapeFixtureText(fixture.HA === "TBC" ? "To be confirmed" : fixture.HA)}</dd></div>
          <div><dt>Location</dt><dd>${escapeFixtureText(fixture.Location === "TBC" ? "To be confirmed" : fixture.Location || "To be confirmed")}</dd></div>
        </dl>
        ${fixture.completed ? `<a class="fxResultLink" href="${escapeFixtureText(RESULTS_PAGE_URL(fixture))}">View result →</a>` : ""}
      `;
      dialog.showModal();
    }

    function render() {
      const date = new Date(Math.floor(month / 12), month % 12, 1, 12);
      const title = date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      const monthFixtures = fixtures.filter(fixture => monthNumber(fixture.dateObj) === month);
      el("#fixtureCalendarMonth").textContent = title;
      const resultsCount = monthFixtures.filter(fixture => fixture.completed).length;
      const fixturesCount = monthFixtures.length - resultsCount;
      el("#fixtureCalendarCount").textContent = [
        resultsCount ? `${resultsCount} ${resultsCount === 1 ? "result" : "results"}` : "",
        fixturesCount ? `${fixturesCount} ${fixturesCount === 1 ? "fixture" : "fixtures"}` : ""
      ].filter(Boolean).join(" · ") || "No matches";
      previous.disabled = month <= firstMonth();
      next.disabled = month >= lastMonth();
      const offset = (date.getDay() + 6) % 7;
      const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const cellCount = Math.ceil((offset + days) / 7) * 7;
      const today = toISODate(todayNoon());
      let cells = "";
      for (let i = 0; i < cellCount; i++) {
        if (i % 7 === 0) cells += "<tr>";
        const day = i - offset + 1;
        if (day < 1 || day > days) {
          cells += '<td class="fixtureCalendarOutside" aria-hidden="true"></td>';
        } else {
          const cellDate = new Date(date.getFullYear(), date.getMonth(), day, 12);
          const iso = toISODate(cellDate);
          const events = fixtures.map((fixture, index) => ({ fixture, index })).filter(({ fixture }) => fixture.dateISO === iso);
          const isToday = iso === today;
          cells += `<td class="fixtureCalendarDay ${events.length ? "hasFixtures" : "noFixtures"} ${isToday ? "isToday" : ""}">
            <time datetime="${iso}" ${isToday ? 'aria-current="date"' : ""}>
              <span class="fixtureDayNumber">${day}</span>
              <span class="fixtureMobileWeekday">${cellDate.toLocaleDateString("en-GB", { weekday: "short" })}</span>
            </time>
            <div class="fixtureDayEvents">${events.map(({ fixture, index }) => renderCalendarEvent(fixture, index)).join("")}</div>
          </td>`;
        }
        if (i % 7 === 6) cells += "</tr>";
      }
      grid.innerHTML = cells;
      el("#fixtureCalendarEmpty").hidden = monthFixtures.length > 0;
    }

    previous.addEventListener("click", () => { if (month > firstMonth()) { month--; render(); } });
    next.addEventListener("click", () => { if (month < lastMonth()) { month++; render(); } });
    el("#fixtureNextMatch").addEventListener("click", () => { month = nextMonth(); render(); });
    grid.addEventListener("click", event => {
      const button = event.target.closest("[data-fixture-index]");
      if (button) openDetails(fixtures[Number(button.dataset.fixtureIndex)]);
    });
    el("#fixtureDetailsClose").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    render();
    return { setFixtures(updated) { fixtures = updated; render(); } };
  }

  function setupFixtureViews() {
    const calendar = el("#fixtureCalendar");
    const carousel = el("#fixturesCarousel");
    document.querySelectorAll("[data-fixtures-view]").forEach(button => {
      button.addEventListener("click", () => {
        const showCalendar = button.dataset.fixturesView === "calendar";
        calendar.hidden = !showCalendar;
        carousel.hidden = showCalendar;
        document.querySelectorAll("[data-fixtures-view]").forEach(option => {
          option.setAttribute("aria-pressed", String(option === button));
        });
      });
    });
  }

  async function init() {
    setupFixtureViews();
    renderLoadingSkeleton(3);

    // 1) Load fixtures JSON first
    const fixturesRes = await fetch(FIXTURES_URL, { cache: "no-store" });
    if (!fixturesRes.ok) throw new Error(`Failed to load fixtures JSON: ${fixturesRes.status}`);
    const fixturesRaw = await fixturesRes.json();

    const fixturesOnly = normalizeFixturesOnly(fixturesRaw);

    // Mount carousel immediately with JSON-only data
    const carousel = mountCarousel(fixturesOnly);
    const calendar = mountCalendar(fixturesOnly);

    // 2) Then load results JSON and patch (non-blocking)
    try {
      const resultsRes = await fetch(RESULTS_URL, { cache: "no-store" });
      if (!resultsRes.ok) throw new Error(`Failed to load results JSON: ${resultsRes.status}`);
      const rows = await resultsRes.json();

      const merged = applyResultsToFixtures(fixturesOnly, rows);
      calendar.setFixtures(mergeCalendarResults(merged, rows));
      carousel.setFixtures(merged);  // updates rendered cards with scores/links
    } catch (e) {
      console.warn("Results JSON failed, showing fixtures without scores.", e);
    }
  }


  document.addEventListener("DOMContentLoaded", () => {
    // only run if the mount exists
    if (!el("#fixturesBanner")) return;
    init().catch(err => {
      console.error("Fixtures banner failed:", err);
      const calendar = el("#fixtureCalendar");
      if (calendar) calendar.innerHTML = '<p class="fixtureCalendarEmpty" role="alert">Could not load fixtures. Please try refreshing the page.</p>';
      const stage = el("#fixturesStage");
      if (stage) stage.innerHTML = `<div class="fixturesCard competition"><div class="leagueLine">Fixtures</div><div class="metaLine"><span>Could not load fixtures/results.</span></div></div>`;
    });
  });
})();
