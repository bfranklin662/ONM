/* fixtures.js */
(() => {
  const TEAM = "Oche Ness Monsters";
  const FIXTURES_URL = "./data/fixtures-26-27.json";
  const RESULTS_URL = "data/result-data-26-27.json";
  const LAST_SEASON_RESULTS_URL = "data/result-data-25-26.json";
  const personal = { user: null, fixtures: [], loading: false, error: "" };
  let refreshPersonalViews = () => {};
  let openedFixture = null;
  let savingAvailability = false;
  let fixturePicturesPromise = null;
  const fixturePictures = new Map();

  function personalLeague(value) {
    const name = normalizeName(value);
    if (name.includes("banks")) return name.includes("cup") ? "banks-cup" : "banks";
    if (name.includes("trafalgar")) return /cup|trophy|memorial|charity|\bko\b/.test(name) ? "trafalgar-cup" : "trafalgar";
    return name;
  }

  function personalTeam(value) {
    const name = normalizeName(value);
    return name === "dogs no more" ? "bb kings" : name === "sliverbacks" ? "silverbacks" : name;
  }

  function personalSide(value) {
    const name = normalizeName(value);
    return ({ h: "home", a: "away", n: "neutral" })[name] || name;
  }

  function personalFixture(fixture) {
    if (fixture.EventType === "social") return null;
    if (!personal.user?.linkedPlayerKey || personal.user.accountType === "supporter") return null;
    const playerNames = [personal.user.linkedPlayerName, personal.user.linkedPlayerKey.replace(/-/g, " ")].map(normalizeName).filter(Boolean);
    if (fixture.completed) {
      if (!Array.isArray(fixture.playerNames) || !fixture.playerNames.length) return { label: "Line-up unavailable", state: "unknown" };
      const played = fixture.playerNames.some(name => playerNames.includes(normalizeName(name)));
      return { label: played ? "Played" : "Missed", state: played ? "played" : "missed" };
    }
    const selected = Array.from({ length: 12 }, (_, index) =>
      fixture[`Player${index + 1}`] || fixture[`Player ${index + 1}`])
      .some(name => playerNames.includes(normalizeName(name)));
    const selectedBadge = { label: "Selected", state: "selected" };
    if (personal.loading) return selected ? selectedBadge : { label: "Loading your availability…", state: "unknown" };
    if (personal.error) return selected ? selectedBadge : { label: "Availability unavailable", state: "unknown" };
    const matches = personal.fixtures.filter(item => item.date === fixture.dateISO &&
      personalLeague(item.league) === personalLeague(fixture.League) &&
      personalTeam(item.opponent) === personalTeam(fixture.Opponent) &&
      personalSide(item.side) === personalSide(fixture.HA));
    if (matches.length !== 1) return selected ? selectedBadge : { label: "Not linked in availability sheet", state: "unknown" };
    const response = matches[0];
    if (selected) return { response, ...selectedBadge };
    return { response, label: response.status || "Availability not recorded", state: ({ Available: "available", Unavailable: "unavailable", "Not sure": "unsure", Selected: "selected" })[response.status] || "unanswered" };
  }

  function personalClass(fixture) {
    const item = personalFixture(fixture);
    return item && ["played", "missed", "available", "unavailable"].includes(item.state) ? ` fxPersonal fxPersonal-${item.state}` : "";
  }

  function personalBadge(fixture) {
    const item = personalFixture(fixture);
    return item && ["played", "missed", "available", "unavailable", "selected"].includes(item.state) ? `<span class="fxPersonalBadge fxPersonalBadge-${item.state}">${escapeFixtureText(item.label)}</span>` : "";
  }

  async function loadPersonalAvailability() {
    if (savingAvailability || personal.loading) return;
    personal.loading = true;
    try {
      const user = await window.ONMFirebase?.loadOwnUser();
      personal.user = user?.status === "Active" ? user : null;
      if (!personal.user?.linkedPlayerKey || personal.user.accountType === "supporter") return;
      refreshPersonalViews();
      const data = await window.ONMFirebase.availability("getPlayerAvailability");
      personal.fixtures = data.fixtures;
      personal.error = "";
    } catch (error) {
      personal.fixtures = [];
      personal.error = error.message || "Your availability could not be loaded.";
    } finally {
      personal.loading = false;
      refreshPersonalViews();
    }
  }

  function availabilityDetails(fixture) {
    if (fixture.completed) return "";
    const item = personalFixture(fixture);
    if (!personal.user) return '<p class="fxAvailabilityHelp"><a href="auth.html?mode=login&redirect=index.html">Sign in</a> to view your availability.</p>';
    if (!item) return '<p class="fxAvailabilityHelp">Link your player account to set availability. <a href="account.html">My account →</a></p>';
    const response = item.response;
    if (!response) return `<p class="fxAvailabilityHelp">${escapeFixtureText(personal.error || (item.state === "selected" ? "Availability unavailable" : item.label))}. Use Refresh to try again, or open availability in <a href="account.html">My account</a>.</p><button type="button" class="fxAvailabilityRefresh">Refresh availability</button>`;
    return `<form id="fixtureAvailabilityForm" class="fxAvailabilityForm">
      <label for="fixtureAvailabilityChoice">Your availability</label>
      <select id="fixtureAvailabilityChoice"${!response.editable || savingAvailability ? " disabled" : ""}>
        ${response.status === "Selected" ? '<option disabled selected>Selected</option>' : ""}
        ${["", "Available", "Unavailable", "Not sure"].map(choice => `<option value="${choice}"${response.status === choice ? " selected" : ""}>${choice || "Not answered"}</option>`).join("")}
      </select>
      <button type="submit"${!response.editable || savingAvailability ? " disabled" : ""}>${savingAvailability ? "Saving…" : "Save availability"}</button>
      <p class="fxAvailabilityHelp">Changes save to the club availability sheet.${!response.editable ? " This fixture is duplicated in the sheet; ask an administrator to check it." : ""}</p>
    </form>`;
  }

  function fixturePlayerStats(row, slot) {
    const fine = row?.[`F${slot}`] ?? row?.[`F ${slot}`];
    const amount = Number(String(fine ?? "").replace(/[£,\s]/g, ""));
    const fines = String(fine ?? "").trim() && Number.isFinite(amount) ? `£${amount.toFixed(2)}` : "—";
    const specials = [["O", "180", "one-eighty"], ["B", "Bull", "bull"], ["T", "Ton+", "ton"]].map(([prefix,label,type]) => {
      const count = Number(row?.[`${prefix}${slot}`] ?? row?.[`${prefix} ${slot}`]);
      return Number.isFinite(count) && count > 0 ? `<span class="fixtureSpecial fixtureSpecial-${type}">${label} ×${count}</span>` : "";
    }).filter(Boolean).join(" ");
    return `<span class="fixtureLineupStat">Fines: ${escapeFixtureText(fines)}</span>${specials ? `<span class="fixtureLineupSpecials">${specials}</span>` : ""}`;
  }

  function fixtureCheckoutMarkup(value) {
    const text = String(value ?? "").trim();
    return text && Number(text) === 0 ? '<span class="fixtureBagel" role="img" aria-label="0 checkouts" title="0 checkouts">🥯</span>' : escapeFixtureText(text || "—");
  }

  function fixtureAdminEditLink(fixture) {
    if (personal.user?.status !== "Active" || !["owner", "admin"].includes(personal.user.role)) return "";
    const type = fixture.completed ? "result" : "fixture";
    const fields = { edit: type, date: fixture.dateISO, league: fixture.Competition || fixture.League, opponent: fixture.Opponent, side: fixture.HA, season: fixture.season || "26-27" };
    if (type === "result" && fixture.resultRow?._resultId) fields.id = fixture.resultRow._resultId;
    const query = Object.entries(fields).map(([key,value]) => `${key}=${encodeURIComponent(value || "")}`).join("&");
    const edit = `<a class="fxAdminEditLink" href="admin.html?${escapeFixtureText(query)}">Admin edit ${type}</a>`;
    if (fixture.completed || fixture.EventType === "social") return edit;
    const hasLineup = Array.from({ length: 12 }, (_, index) =>
      fixture[`Player${index + 1}`] || fixture[`Player ${index + 1}`]).some(Boolean);
    return edit + `<a class="fxAdminEditLink" href="admin.html?${escapeFixtureText(query)}&amp;tab=pickTeam">Admin ${hasLineup ? "amend" : "pick"} team</a>`;
  }

  function fixturePlayerImage(name) {
    return fixturePictures.get(normalizeName(name)) || "images/default.jpg";
  }

  function fixturePlayerNickname(name) {
    const profiles = fixturePictures.live || {};
    const entry = profiles[name] || Object.entries(profiles).find(([publicName]) =>
      normalizeName(publicName) === normalizeName(name))?.[1];
    const nickname = String(entry?.nickname || "").trim().replace(/^["“]|["”]$/g, "");
    return nickname && normalizeName(nickname) !== normalizeName(name) ? `“${nickname}”` : "";
  }

  function fixturePlayerNameMarkup(name) {
    const fullName = fixturePictures.names?.get(normalizeName(name)) || String(name).replace(/\s+[A-Z]$/, "");
    const [first, ...surname] = fullName.trim().split(/\s+/);
    const nickname = fixturePlayerNickname(name);
    return [escapeFixtureText(first), nickname ? `<em class="fixtureLineupNickname">${escapeFixtureText(nickname)}</em>` : "",
      escapeFixtureText(surname.join(" "))
    ].filter(Boolean).join("&nbsp;");
  }

  async function loadFixturePlayerPictures() {
    if (!window.PlayerData) return;
    fixturePicturesPromise ||= Promise.allSettled([
      window.PlayerData.fetchPublicPlayerProfiles?.() || {},
      window.PlayerData.fetchPlayerPhotosFromDrive?.() || {},
      window.ONMFirebase?.post?.({ action: "getMatchPlayerDirectory" })
    ]).then(([profiles, photos, directory]) => {
      fixturePictures.names = new Map((directory.status === "fulfilled" ? directory.value?.players || [] : []).flatMap(player =>
        [player.publicName, ...(player.aliases || [])].filter(Boolean).map(name => [normalizeName(name), player.fullName])));
      const live = profiles.status === "fulfilled" ? profiles.value : {};
      const drive = photos.status === "fulfilled" ? photos.value : {};
      for (const name of new Set([...Object.keys(live), ...(openedFixture?.playerNames || [])])) {
        const key = window.PlayerData.photoKey(name);
        fixturePictures.set(normalizeName(name), live[name]?.photo || drive[key] || "images/default.jpg");
      }
      // Keep the Drive map for players who appear in a later opened match.
      fixturePictures.drive = drive;
      fixturePictures.live = live;
    });
    await fixturePicturesPromise;
    document.querySelectorAll("#fixtureDetails [data-fixture-nickname]").forEach(label => {
      label.innerHTML = fixturePlayerNameMarkup(label.dataset.fixtureNickname);
    });
    document.querySelectorAll("#fixtureDetails [data-fixture-avatar]").forEach(image => {
      const name = image.dataset.fixtureAvatar;
      const key = window.PlayerData.photoKey(name);
      const url = fixturePictures.live?.[name]?.photo || fixturePictures.drive?.[key] || fixturePlayerImage(name);
      fixturePictures.set(normalizeName(name), url);
      if (image.getAttribute("src") !== url) { delete image.dataset.avatarFallback; image.src = url; }
    });
  }

  function fixtureLineup(fixture) {
    const row = fixture.completed ? fixture.resultRow : fixture;
    let entries = row ? Array.from({ length: 12 }, (_, i) => ({ slot: i + 1, name: row[`Player${i + 1}`] ?? row[`Player ${i + 1}`], checkouts: row[`C${i + 1}`] ?? row[`C ${i + 1}`] })).filter(entry => entry.name) : [];
    if (!entries.length) entries = (fixture.playerNames || []).map(name => ({ name }));
    const seen = new Set();
    entries = entries.filter(entry => { const key = normalizeName(entry.name); if (seen.has(key)) return false; seen.add(key); return true; });
    if (!entries.length) return "";
    const captain = normalizeName(fixture.Captain || row?.Captain);
    return `<section class="fixtureLineup" aria-label="${fixture.completed ? "Submitted team lineup" : "Selected team lineup"}"><h4>Our team</h4><ul>${entries.map(({name,checkouts,slot}) => {
      const mine = personal.user?.accountType !== "supporter" && [personal.user?.linkedPlayerName, personal.user?.linkedPlayerKey?.replace(/-/g," ")].filter(Boolean).some(value => normalizeName(value) === normalizeName(name));
      return `<li><a class="${mine ? "fixtureLineupSelf" : ""}"${mine ? ' aria-label="Your player profile"' : ""} href="player-profile.html?name=${encodeURIComponent(name)}"><img src="${escapeFixtureText(fixturePlayerImage(name))}" data-fixture-avatar="${escapeFixtureText(name)}" alt="" loading="lazy" decoding="async"><span class="fixtureLineupInfo"><span class="fixtureLineupIdentity"><span class="fixtureLineupName" data-fixture-nickname="${escapeFixtureText(name)}">${fixturePlayerNameMarkup(name)}</span>${captain && captain === normalizeName(name) ? ' <span class="fixtureLineupCaptain" aria-label="Captain">(c)</span>' : ""}</span>${fixture.completed ? `<span class="fixtureLineupStats"><span class="fixtureLineupCheckouts fixtureLineupStat">Checkouts: ${fixtureCheckoutMarkup(checkouts)}</span>${fixturePlayerStats(row,slot)}</span>` : ""}</span><svg class="fixtureLineupArrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12 12 4M6 4h6v6"/></svg></a></li>`; }).join("")}</ul></section>`;
  }

  document.addEventListener("error", event => {
    const image = event.target;
    if (image?.matches?.("img[data-fixture-avatar]") && !image.dataset.avatarFallback) {
      image.dataset.avatarFallback = "1";
      image.src = "images/default.jpg";
    }
  }, true);

  function openFixtureDetails(fixture) {
    openedFixture = fixture;
    if (fixture.EventType === "social") {
      el("#fixtureDetailsContent").innerHTML = `<div class="fixtureDetailsHeader"><span class="fixtureCategory social">Social event</span></div><div class="fixtureDetailsMatch"><div class="fixtureDetailsIdentity"><h3 id="fixtureDetailsTitle">${escapeFixtureText(fixture.Opponent)}</h3></div></div><dl class="fixtureDetailsMeta"><div><dt>Date</dt><dd>${escapeFixtureText(fixture.Day)}, ${escapeFixtureText(fixture.Date)}</dd></div><div><dt>Time</dt><dd>${escapeFixtureText(fixture.Time || "To be confirmed")}</dd></div><div class="fixtureDetailsLocation"><dt>Location</dt><dd>${escapeFixtureText(fixture.Location || "To be confirmed")}</dd></div></dl>${fixture.EventDetails ? `<p class="fixtureSocialDescription">${escapeFixtureText(fixture.EventDetails)}</p>` : ""}<div class="fixtureDetailsFooter">${fixtureAdminEditLink(fixture)}</div>`;
      const dialog = el("#fixtureDetails");
      if (!dialog.open) dialog.showModal();
      return;
    }
    const lineup = fixtureLineup(fixture);
    const confirmedOpponent = fixture.Opponent && fixture.Opponent !== "TBC";
    el("#fixtureDetailsContent").innerHTML = `
      <div class="fixtureDetailsHeader"><span class="fixtureCategory ${fixture.leagueClass}">${escapeFixtureText(fixture.League)}</span></div>
      <div class="fixtureDetailsMatch"><div class="fixtureDetailsIdentity"><h3 id="fixtureDetailsTitle">${confirmedOpponent ? `vs ${escapeFixtureText(fixture.Opponent)}${["Home", "Away", "Neutral"].includes(fixture.HA) ? ` <span class="fixtureDetailsSide">(${fixture.HA[0]})</span>` : ""}` : "Opponent to be confirmed"}</h3>
      <p class="fixtureDetailsTeam">${escapeFixtureText(getOnmTeamForFixture(fixture))}</p></div>
      <div class="fixtureDetailsResult">${fixture.completed && Number.isFinite(fixture.homeScore) && Number.isFinite(fixture.awayScore) ? `<div class="fixtureDetailsScore ${fixture.outcome}" aria-label="${escapeFixtureText(fixture.homeTeam)} ${fixture.homeScore}, ${escapeFixtureText(fixture.awayTeam)} ${fixture.awayScore}"><strong>${fixture.HA === "Home" ? fixture.homeScore : fixture.awayScore} – ${fixture.HA === "Home" ? fixture.awayScore : fixture.homeScore} ${fixture.outcome === "win" ? "W" : fixture.outcome === "loss" ? "L" : "D"}</strong></div>` : ""}${fixture.completed ? "" : personalBadge(fixture)}</div></div>
      <dl class="fixtureDetailsMeta"><div class="fixtureDetailsDate"><dt>Date</dt><dd>${escapeFixtureText(fixture.Day)}, ${escapeFixtureText(fixture.Date)}</dd></div>
      <div class="fixtureDetailsLocation"><dt>Location</dt><dd>${escapeFixtureText(fixture.Location || "To be confirmed")}</dd></div></dl>
      ${lineup}
      ${availabilityDetails(fixture)}
      <p id="fixtureAvailabilityMessage" role="status" aria-live="polite"></p>
      ${fixture.completed && fixture.resultRow ? `<section id="fixtureMatchPhotos" aria-label="Match photos"><p class="fixturePhotosNotice" role="status">Loading photos…</p></section>` : ""}
      ${fixture.completed || fixtureAdminEditLink(fixture) ? `<div class="fixtureDetailsFooter">${fixtureAdminEditLink(fixture)}${fixture.completed ? `<a class="fxResultLink" href="${escapeFixtureText(RESULTS_PAGE_URL(fixture))}">View full result ↗</a>` : ""}</div>` : ""}
      `;
    const dialog = el("#fixtureDetails");
    if (!dialog.open) dialog.showModal();
    window.ONMFixturePhotos?.show(fixture);
    if (window.PlayerData && lineup) void loadFixturePlayerPictures().catch(() => {});
  }

  const RESULTS_PAGE_URL = (fx) =>
    `results.html?date=${encodeURIComponent(fx.dateISO)}&opp=${encodeURIComponent(fx.Opponent)}&ha=${encodeURIComponent(fx.HA)}&season=${encodeURIComponent(fx.season || "26-27")}&competition=${encodeURIComponent(fx.Competition || fx.League)}`;


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
    if (s === "social") return "Social";
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
    if (l === "social") return "social";
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

      const homeTeam = getResultField(r, "HomeTeam", "homeTeam", "Home");
      const awayTeam = getResultField(r, "AwayTeam", "awayTeam", "Away");

      const derived = getOpponentAndHAFromResultRow(homeTeam, awayTeam);
      if (!derived) continue;

      resultsArr.push({
        dateObj: d,
        homeTeam,
        awayTeam,
        opponent: derived.opponent,
        ha: derived.ha,
        homeScore: getResultField(r, "HomeScore", "homeScore", "Home Score"),
        awayScore: getResultField(r, "AwayScore", "awayScore", "Away Score"),
        homePoints: getResultField(r, "HomePoints", "Home Points", "homePoints"),
        awayPoints: getResultField(r, "AwayPoints", "Away Points", "awayPoints"),
        resultRow: r,
        playerNames: Array.from({ length: 12 }, (_, i) => r[`Player${i + 1}`] ?? r[`Player ${i + 1}`] ?? "").filter(Boolean)
      });
    }

    const today = todayNoon();

    return fixtures.map(fx => {
      if (fx.EventType === "social") return fx;
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
        resultRow: isCompleted ? res.resultRow : undefined,
        pendingResult: !isCompleted && (fx.dateObj < today),
        playerNames: isCompleted ? res.playerNames : undefined,
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
    const [fixturesRes, resultsRows] = await Promise.all([
      fetch(FIXTURES_URL, { cache: "no-store" }),
      window.ONMSeasonData?.fetchResults() || fetch(RESULTS_URL, { cache: "no-store" }).then(res => res.json())
    ]);

    const fixtures = await fixturesRes.json();

    // Build results array that only includes rows involving Oche Ness Monsters,
    // and adds derived opponent + HA ("Home"/"Away")
    const resultsArr = [];
    for (const r of resultsRows) {
      const d = parseCsvDate(r.Date || r.date);
      if (!d) continue;

      const homeTeam = getResultField(r, "HomeTeam", "homeTeam", "Home");
      const awayTeam = getResultField(r, "AwayTeam", "awayTeam", "Away");

      const derived = getOpponentAndHAFromResultRow(homeTeam, awayTeam);
      if (!derived) continue;

      const homeScore = getResultField(r, "HomeScore", "homeScore", "Home Score");
      const awayScore = getResultField(r, "AwayScore", "awayScore", "Away Score");
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
        resultRow: r,
        playerNames: Array.from({ length: 12 }, (_, i) => r[`Player${i + 1}`] ?? r[`Player ${i + 1}`] ?? "").filter(Boolean),
        resultText: getResultField(r, "Result", "result")
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
        resultRow: isCompleted ? res.resultRow : undefined,
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






  function formatFixtureSeason(season) {
    return String(season || "26-27").replace("-", "/");
  }

  function fixtureSide(fixture, className = "") {
    const side = ["Home", "Away", "Neutral"].includes(fixture.HA)
      ? `<span class="${className}">(${fixture.HA[0]})</span>`
      : "";
    const marker = fixture.completed && fixture.resultRow
      ? '<span class="match-photo-mark" data-fixture-photo-mark hidden title="Match photos" role="img" aria-label="Match photos"></span>'
      : "";
    return side || marker ? ` <span class="match-card-side">${side}${marker}</span>` : "";
  }

  function updateFixturePhotoMarks(container, fixtures, resultId) {
    if (!window.ONMResultPhotos?.loadMatchPhotos) return;
    container.querySelectorAll("[data-fixture-photo-mark]").forEach(async marker => {
      const card = marker.closest("[data-fixture-index], [data-card-fixture-index]");
      const fixture = fixtures[Number(card.dataset.fixtureIndex ?? card.dataset.cardFixtureIndex)];
      if (resultId && fixture.resultRow._resultId !== resultId) return;
      const { urls } = await window.ONMResultPhotos.loadMatchPhotos(fixture.resultRow);
      marker.hidden = urls.length === 0;
      const label = card.getAttribute("aria-label")?.replace(/ Match photos available\.$/, "");
      if (label) card.setAttribute("aria-label", urls.length ? `${label} Match photos available.` : label);
    });
  }

  function renderCard(fx, showSeasonDivider, isNextFixture, index) {
    const pillClass = fx.leagueClass; // banks/trafalgar/cup/competition
    const nextBadgeHtml = isNextFixture ? `<div class="nextFixtureBadge">Next Fixture</div>` : "";
    const seasonDividerHtml = showSeasonDivider
      ? `<div class="fxSeasonDivider"><span>${formatFixtureSeason(fx.season)} season starts</span></div>`
      : "";



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
    <div class="fxCard ${fx.leagueClass} ${(fx.completed || fx.pendingResult) ? "" : "upcoming"}${personalClass(fx)}" data-card-fixture-index="${index}" tabindex="0" role="group" aria-label="${escapeFixtureText(fx.homeTeam)} vs ${escapeFixtureText(fx.awayTeam)}. Press Enter for match details" aria-haspopup="dialog">

      ${seasonDividerHtml}


      <div class="fxTopRow">
        <div class="fxLeaguePill ${pillClass}">
          ${escapeFixtureText(fixtureLeagueLabel(fx).toUpperCase())}
        </div>
        <div class="fxCardMeta">
          <span class="fxSeasonPill">${formatFixtureSeason(fx.season)}</span>
          ${nextBadgeHtml}
        </div>
      </div>

      <div class="fxMainRow">
        <div class="fxTeam fxTeamLeft" title="${fx.homeTeam}">${fx.homeTeam}</div>
        ${scoreBoxHtml}
        <div class="fxTeam fxTeamRight" title="${fx.awayTeam}">${fx.awayTeam}</div>
      </div>

      <div class="fxDate">${fx.Date}${fixtureSide(fx)}</div>

      <div class="fxBottomRow">
        ${venueHtml}
        ${resultCardHtml}
        ${personalBadge(fx)}
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
        .map(i => {
          const previousSeason = i > 0 ? fixtures[i - 1].season : "";
          const showSeasonDivider = !!previousSeason && previousSeason !== fixtures[i].season;
          return renderCard(fixtures[i], showSeasonDivider, i === nxtIdx, i);
        })
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
      updateFixturePhotoMarks(stage, fixtures);

      prevBtn.disabled = anchor <= 0;
      nextBtn.disabled = anchor >= max;
    }

    prevBtn.addEventListener("click", () => {
      anchor = Math.max(0, anchor - 1);
      update();
    });

    document.addEventListener("onm-result-photos-changed", event => {
      updateFixturePhotoMarks(stage, fixtures, event.detail?.resultId);
    });

    nextBtn.addEventListener("click", () => {
      anchor = Math.min(fixtures.length - 1, anchor + 1);
      update();
    });

    window.addEventListener("resize", update);
    stage.addEventListener("click", event => {
      if (event.target.closest("a")) return;
      const card = event.target.closest("[data-card-fixture-index]");
      if (card && fixtures[Number(card.dataset.cardFixtureIndex)]) openFixtureDetails(fixtures[Number(card.dataset.cardFixtureIndex)]);
    });
    stage.addEventListener("keydown",event=>{
      if(!["Enter"," "].includes(event.key)||!event.target.matches(".fxCard[data-card-fixture-index]"))return;
      event.preventDefault();const fixture=fixtures[Number(event.target.dataset.cardFixtureIndex)];if(fixture)openFixtureDetails(fixture);
    });

    // Start anchored to next upcoming if possible
    const t = todayNoon();
    const upcoming = fixtures.findIndex(f => f.dateObj >= t && !f.completed);
    if (upcoming !== -1) anchor = upcoming;

    update();

    // allow external updates after results load
    return {
      refresh: update,
      setFixtures(newFixtures) {
        fixtures = newFixtures;
        anchor = initialIndex(fixtures);
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
        season: fx.season || "26-27",
        leagueTitle,
        leagueClass: leagueCls,
        dateObj: d,
        dateISO: iso,
        homeTeam: teams.home,
        awayTeam: teams.away,

        // BEFORE results load:
        // - past fixtures = pending result (show spinner in score box, style like completed)
        // - future fixtures = upcoming (VS)
        pendingResult: isPast && fx.EventType !== "social",          // ✅ new
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

  function calendarResultEvents(rows, season) {
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
        resultRow: row,
        playerNames: Array.from({ length: 12 }, (_, i) => row[`Player${i + 1}`] ?? row[`Player ${i + 1}`] ?? "").filter(Boolean),
        outcome,
        season
      }];
    });
  }

  function mergeCalendarResults(fixtures, resultSources) {
    const results = resultSources.flatMap(source =>
      calendarResultEvents(source.rows, source.season)
    );
    const matchKey = fixture => [
      fixture.dateISO, normalizeName(normalizeLeague(fixture.League || fixture.Competition)),
      personalTeam(fixture.Opponent), personalSide(fixture.HA)
    ].join("|");
    const fixtureCaptains = new Map(fixtures.filter(fixture => fixture.Captain).map(fixture => [matchKey(fixture), fixture.Captain]));
    const resultsByMatch = new Map(results.map(result => {
      const key = matchKey(result);
      return [key, { ...result, Captain: result.resultRow?.Captain || fixtureCaptains.get(key) }];
    }));
    // A fixture that is already in the schedule appears once, with its result.
    const combined = fixtures.filter(fixture => !resultsByMatch.has(matchKey(fixture)));
    return [...combined, ...resultsByMatch.values()].sort((a, b) => a.dateObj - b.dateObj);
  }

  function fixtureLeagueLabel(fixture) {
    const normalized = normalizeLeague(fixture.League || fixture.leagueTitle);
    const league = normalized === "Competition" ? String(fixture.League || fixture.leagueTitle || "").replace(/\bLeague\b/gi, "").trim() : normalized;
    const divisions = window.ONMLeagueDivisions;
    if (!divisions) return league;
    return divisions.shortLabel(league, fixture.season || divisions.seasonFromDate(fixture.dateObj || fixture.dateISO));
  }

  function calendarDateState(dateISO, today = toISODate(todayNoon())) {
    return dateISO < today ? "isPast" : dateISO === today ? "isToday" : "isFuture";
  }

  function renderCalendarEvent(fixture, index) {
    const escape = escapeFixtureText;
    const resultCode = fixture.outcome === "win" ? "W" : fixture.outcome === "loss" ? "L" : "D";
    const ourScore = fixture.HA === "Home" ? fixture.homeScore : fixture.awayScore;
    const theirScore = fixture.HA === "Home" ? fixture.awayScore : fixture.homeScore;
    const resultText = fixture.completed ? `${ourScore}-${theirScore} ${resultCode}` : "";
    const label = escape(`${fixture.Opponent}, ${fixture.HA}, ${fixture.League}, ${fixture.Date}. ${fixture.completed ? resultText : ""} ${personalFixture(fixture)?.label || ""}. View match details`);
    const attrs = `class="fixtureCalendarEvent ${fixture.leagueClass} ${calendarDateState(fixture.dateISO)}${personalClass(fixture)}"`;
    const content = `<span class="fixtureEventSummary">
      <span class="fixtureEventOpponent">${escape(fixture.Opponent)}${fixtureSide(fixture, "fixtureEventSideInline")}</span>
      ${fixture.completed ? `<span class="fixtureEventResult ${fixture.outcome}">${escape(resultText)}</span>` : ""}
      </span><span class="fixtureEventLeague">${escape(fixtureLeagueLabel(fixture))}</span><span class="fixtureEventFooter">${personalBadge(fixture)}${fixture.Location && fixture.Location !== "TBC" ? `<span class="fixtureEventVenue" title="${escape(fixture.Location)}">${escape(fixture.Location)}</span>` : ""}</span>`;
    return `<button type="button" ${attrs} aria-label="${label}" data-fixture-index="${index}" aria-haspopup="dialog">${content}</button>`;
  }

  function mountCalendar(initialFixtures, loading = false) {
    let fixtures = initialFixtures;
    let initialMonthChosen = !loading;
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
      openFixtureDetails(fixture);
    }

    function render() {
      const date = new Date(Math.floor(month / 12), month % 12, 1, 12);
      const title = date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      const monthFixtures = fixtures.filter(fixture => monthNumber(fixture.dateObj) === month);
      el("#fixtureCalendarMonth").textContent = title;
      const resultsCount = monthFixtures.filter(fixture => fixture.completed).length;
      const socialCount = monthFixtures.filter(fixture => fixture.EventType === "social").length;
      const fixturesCount = monthFixtures.length - resultsCount - socialCount;
      el("#fixtureCalendarCount").textContent = loading ? "Loading fixtures…" : [
        resultsCount ? `${resultsCount} ${resultsCount === 1 ? "result" : "results"}` : "",
        fixturesCount ? `${fixturesCount} ${fixturesCount === 1 ? "fixture" : "fixtures"}` : "",
        socialCount ? `${socialCount} ${socialCount === 1 ? "social event" : "social events"}` : ""
      ].filter(Boolean).join(" · ") || "No matches";
      previous.disabled = month <= firstMonth();
      next.disabled = month >= lastMonth();
      el("#fixtureNextMatch").disabled = loading || !fixtures.length;
      el("#fixtureCalendar").setAttribute("aria-busy", String(loading));
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
          cells += `<td class="fixtureCalendarDay ${events.length ? "hasFixtures" : "noFixtures"} ${calendarDateState(iso, today)}">
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
      updateFixturePhotoMarks(grid, fixtures);
      el("#fixtureCalendarEmpty").hidden = loading || monthFixtures.length > 0;
    }

    previous.addEventListener("click", () => { if (month > firstMonth()) { month--; render(); } });
    next.addEventListener("click", () => { if (month < lastMonth()) { month++; render(); } });
    el("#fixtureNextMatch").addEventListener("click", () => { month = nextMonth(); render(); });
    document.addEventListener("onm-result-photos-changed", event => {
      updateFixturePhotoMarks(grid, fixtures, event.detail?.resultId);
    });
    grid.addEventListener("click", event => {
      const button = event.target.closest("[data-fixture-index]");
      if (button) openDetails(fixtures[Number(button.dataset.fixtureIndex)]);
    });
    el("#fixtureDetailsClose").addEventListener("click", () => { if (!savingAvailability) dialog.close(); });
    dialog.addEventListener("cancel", event => { if (savingAvailability) event.preventDefault(); });
    function isBackdrop(event) {
      if (event.target !== dialog) return false;
      const { left, right, top, bottom } = dialog.getBoundingClientRect();
      return event.clientX < left || event.clientX >= right || event.clientY < top || event.clientY >= bottom;
    }
    let startedOnBackdrop = false;
    dialog.addEventListener("pointerdown", event => { startedOnBackdrop = isBackdrop(event); });
    dialog.addEventListener("click", event => {
      if (startedOnBackdrop && isBackdrop(event) && !savingAvailability) dialog.close();
      startedOnBackdrop = false;
    });
    dialog.addEventListener("submit", async event => {
      if (event.target.id !== "fixtureAvailabilityForm") return;
      event.preventDefault();
      if (savingAvailability) return;
      const fixture = openedFixture;
      const item = personalFixture(fixture);
      if (!item?.response?.editable) return;
      const status = el("#fixtureAvailabilityChoice").value;
      if (status === item.response.status) return;
      savingAvailability = true;
      openFixtureDetails(fixture);
      el("#fixtureAvailabilityMessage").textContent = "Saving to the availability sheet…";
      let message;
      try {
        const result = await window.ONMFirebase.availability("setPlayerAvailability", { fixtureId: item.response.id, status, previousStatus: item.response.status });
        item.response.status = result.status;
        message = "Saved to the availability sheet.";
      } catch (error) {
        personal.error = error.message || "Could not confirm the save. Please refresh before trying again.";
        personal.fixtures = [];
        message = personal.error;
      } finally {
        savingAvailability = false;
        refreshPersonalViews();
        if (dialog.open) el("#fixtureAvailabilityMessage").textContent = message;
      }
    });
    dialog.addEventListener("click", event => {
      if (event.target.closest(".fxAvailabilityRefresh")) loadPersonalAvailability();
    });
    render();
    return { refresh: render, setFixtures(updated) {
      fixtures = updated;
      loading = false;
      if (!initialMonthChosen && fixtures.length) {
        month = nextMonth();
        initialMonthChosen = true;
      }
      render();
    } };
  }

  function setupFixtureViews() {
    const calendar = el("#fixtureCalendar");
    const carousel = el("#fixturesCarousel");
    const mobile = window.matchMedia?.("(max-width: 700px)");
    const buttons = document.querySelectorAll("[data-fixtures-view]");
    function showView(view) {
      const showCalendar = mobile?.matches || view === "calendar";
      calendar.hidden = !showCalendar;
      carousel.hidden = showCalendar;
      buttons.forEach(button => button.setAttribute("aria-pressed",
        String(button.dataset.fixturesView === (showCalendar ? "calendar" : "cards"))));
    }
    buttons.forEach(button => button.addEventListener("click", () => showView(button.dataset.fixturesView)));
    mobile?.addEventListener?.("change", event => { if (event.matches) showView("calendar"); });
    if (mobile?.matches) showView("calendar");
  }

  async function init() {
    setupFixtureViews();
    renderLoadingSkeleton(3);
    // Paint the dated grid before awaiting any live data.
    const calendar = mountCalendar([], true);

    // 1) Load the live fixture sheet, with the packaged JSON as a fallback.
    const fixturesRaw = window.ONMSeasonData?.fetchFixtures
      ? (await Promise.all([
          window.ONMSeasonData.fetchFixtures("25-26"),
          window.ONMSeasonData.fetchFixtures("26-27")
        ])).flat()
      : await fetch(FIXTURES_URL, { cache: "no-store" }).then(res => {
        if (!res.ok) throw new Error(`Failed to load fixtures JSON: ${res.status}`);
        return res.json();
      });

    const fixturesOnly = normalizeFixturesOnly(fixturesRaw);

    // Mount carousel immediately with JSON-only data
    const carousel = mountCarousel(fixturesOnly.filter(fixture => fixture.EventType !== "social"));
    calendar.setFixtures(fixturesOnly);
    refreshPersonalViews = () => {
      carousel.refresh();
      calendar.refresh();
      if (el("#fixtureDetails").open && openedFixture) openFixtureDetails(openedFixture);
    };
    loadPersonalAvailability();

    // 2) Then load results JSON and patch (non-blocking)
    try {
      const [rows, lastSeasonRows, earlierRows] = await Promise.all([
        window.ONMSeasonData?.fetchResults
          ? window.ONMSeasonData.fetchResults()
          : fetch(RESULTS_URL, { cache: "no-store" }).then(res => {
            if (!res.ok) throw new Error(`Failed to load results JSON: ${res.status}`);
            return res.json();
          }),
        window.ONMSeasonData?.fetchResults
          ? window.ONMSeasonData.fetchResults("25-26")
          : fetch(LAST_SEASON_RESULTS_URL, { cache: "no-store" }).then(res => {
              if (!res.ok) throw new Error(`Failed to load 25/26 results JSON: ${res.status}`);
              return res.json();
            }),
        window.ONMSeasonData?.fetchResults
          ? window.ONMSeasonData.fetchResults("24-25")
          : fetch("data/result-data-24-25.json", { cache: "no-store" }).then(res => {
              if (!res.ok) throw new Error(`Failed to load 24/25 results JSON: ${res.status}`);
              return res.json();
            })
      ]);

      const merged = applyResultsToFixtures(fixturesOnly, [...earlierRows, ...lastSeasonRows, ...rows]);
      const allMatches = mergeCalendarResults(merged, [
        { rows: earlierRows, season: "24-25" },
        { rows: lastSeasonRows, season: "25-26" },
        { rows, season: "26-27" }
      ]);
      calendar.setFixtures(allMatches);
      carousel.setFixtures(allMatches.filter(fixture => fixture.EventType !== "social"));
      if (openedFixture && el("#fixtureDetails").open) {
        openedFixture = allMatches.find(fixture => fixture.dateISO === openedFixture.dateISO &&
          personalTeam(fixture.Opponent) === personalTeam(openedFixture.Opponent) &&
          personalLeague(fixture.League) === personalLeague(openedFixture.League) &&
          personalSide(fixture.HA) === personalSide(openedFixture.HA)) || openedFixture;
        openFixtureDetails(openedFixture);
      }
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
      if (calendar) {
        calendar.setAttribute("aria-busy", "false");
        el("#fixtureCalendarCount").textContent = "Fixtures unavailable";
        const message = el("#fixtureCalendarEmpty");
        message.textContent = "Could not load fixtures. Please try refreshing the page.";
        message.hidden = false;
      }
      const stage = el("#fixturesStage");
      if (stage) stage.innerHTML = `<div class="fixturesCard competition"><div class="leagueLine">Fixtures</div><div class="metaLine"><span>Could not load fixtures/results.</span></div></div>`;
    });
  });
})();
