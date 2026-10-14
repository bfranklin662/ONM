(function () {
  "use strict";

  const state = {
    user: null,
    fixtures: [],
    results: [],
    players: [],
    playerPhotos: {},
    activeTab: "fixtures",
    editor: null
  };

  const gate = document.getElementById("adminGate");
  const app = document.getElementById("adminApp");
  const overlay = document.getElementById("adminEditorOverlay");
  const form = document.getElementById("adminEditorForm");
  const title = document.getElementById("adminEditorTitle");
  const typeLabel = document.getElementById("adminEditorType");
  const toast = document.getElementById("adminToast");

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function escapeHtml(value) {
    return clean(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showToast(message, error = false) {
    toast.textContent = message;
    toast.style.background = error ? "#842f38" : "#126b5d";
    toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add("hidden"), 3500);
  }

  function rowFor(item) {
    return item?.sheetRow && typeof item.sheetRow === "object" ? item.sheetRow : {};
  }

  function playerValue(row, index) {
    return row[`Player${index}`] ?? row[`Player ${index}`] ?? "";
  }

  function playerPhoto(profile) {
    const stored = clean(profile.photoUrl || profile.photo);
    if (stored && !/^\/?images\/players\//i.test(stored)) return stored;
    const key = window.PlayerData?.photoKey?.(profile.publicName) || "";
    return state.playerPhotos[key] || "images/default.jpg";
  }

  function dateValue(value) {
    const text = clean(value).replace(/(\d+)(st|nd|rd|th)/i, "$1");
    let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12).getTime();
    match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12).getTime();
    const parsed = Date.parse(text);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function inputDate(value) {
    const text = clean(value).replace(/(\d+)(st|nd|rd|th)/i, "$1");
    let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return text;
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return "";
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${parsed.getFullYear()}-${month}-${day}`;
  }

  function resultDate(value) {
    const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : clean(value);
  }

  function ordinal(number) {
    const n = Number(number);
    const ending = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
    return `${n}${ending}`;
  }

  function fixtureDate(value) {
    const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return clean(value);
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
    return `${ordinal(date.getDate())} ${date.toLocaleString("en-GB", { month: "short" })} ${date.getFullYear()}`;
  }

  function dayName(value) {
    const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return "";
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
      .toLocaleString("en-GB", { weekday: "long" });
  }

  function numericOrBlank(value) {
    const text = clean(value);
    if (!text) return "";
    const number = Number(text);
    return Number.isNaN(number) ? text : number;
  }

  function normaliseTeam(value) {
    const name = clean(value).toLowerCase().replace(/&/g, "and").replace(/[’']/g, "").replace(/\s+/g, " ");
    return name === "dogs no more" ? "bb kings" : name;
  }

  function fixtureHasResult(item) {
    const fixture = rowFor(item);
    const fixtureDate = inputDate(fixture.Date);
    const away = clean(fixture.HA).toLowerCase() === "away";
    const expectedHome = away ? fixture.Opponent : "Oche Ness Monsters";
    const expectedAway = away ? "Oche Ness Monsters" : fixture.Opponent;
    return state.results.some(resultItem => {
      const result = rowFor(resultItem);
      return inputDate(result.Date) === fixtureDate &&
        normaliseTeam(result.HomeTeam) === normaliseTeam(expectedHome) &&
        normaliseTeam(result.AwayTeam) === normaliseTeam(expectedAway);
    });
  }

  function fixtureTitle(row) {
    const side = clean(row.HA).toLowerCase() === "away" ? "A" : clean(row.HA).toLowerCase() === "neutral" ? "N" : "H";
    return `${row.Opponent || "Opponent TBA"} (${side})`;
  }

  function resultOutcome(row) {
    const explicit = clean(row.Result).toLowerCase();
    if (explicit.startsWith("won") || explicit === "win" || explicit === "w") return "win";
    if (explicit.startsWith("lost") || explicit === "loss" || explicit === "l") return "loss";
    if (explicit.startsWith("draw") || explicit === "d") return "draw";
    const home = Number(row.HomeScore);
    const away = Number(row.AwayScore);
    if (!Number.isFinite(home) || !Number.isFinite(away)) return "";
    const onmHome = normaliseTeam(row.HomeTeam) === "oche ness monsters";
    const ourScore = onmHome ? home : away;
    const theirScore = onmHome ? away : home;
    return ourScore > theirScore ? "win" : ourScore < theirScore ? "loss" : "draw";
  }

  function fixtureCard(item, actions = true) {
    const row = rowFor(item);
    return `<article class="adminMatchCard">
      <div><div class="adminMatchCardTitle">${escapeHtml(fixtureTitle(row))}</div>
        <div class="adminMatchCardMeta">${escapeHtml(row.Date || "Date TBA")} · ${escapeHtml(row.League || "Competition TBA")} · ${escapeHtml(row.Location || "Venue TBA")}</div></div>
      ${actions ? `<div class="adminMatchCardActions"><button class="adminSmallBtn" type="button" data-edit-fixture="${escapeHtml(item.id)}">Edit</button><button class="adminSmallBtn danger" type="button" data-delete-fixture="${escapeHtml(item.id)}">Delete</button></div>` : ""}
    </article>`;
  }

  function resultCard(item, actions = true) {
    const row = rowFor(item);
    const outcome = resultOutcome(row);
    const score = clean(row.HomeScore) !== "" && clean(row.AwayScore) !== "" ? `${row.HomeScore} - ${row.AwayScore}` : "TBA";
    const outcomeLabel = { win: "W", loss: "L", draw: "D" }[outcome] || "";
    return `<article class="adminMatchCard">
      <div><div class="adminMatchCardTitle">${escapeHtml(row.HomeTeam || "Home")} v ${escapeHtml(row.AwayTeam || "Away")}</div>
        <div class="adminMatchCardMeta">${escapeHtml(row.Date || "Date TBA")} · ${escapeHtml(row.Competition || "Competition TBA")} · ${escapeHtml(row.Venue || "Venue TBA")}</div></div>
      <div class="adminMatchCardActions"><div class="adminScoreBox ${escapeHtml(outcome)}">${escapeHtml(score)}${outcomeLabel ? `<small>${outcomeLabel}</small>` : ""}</div>
        ${actions ? `<button class="adminSmallBtn" type="button" data-edit-result="${escapeHtml(item.id)}">Edit</button><button class="adminSmallBtn danger" type="button" data-delete-result="${escapeHtml(item.id)}">Delete</button>` : ""}
      </div>
    </article>`;
  }

  function renderOverview() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = state.fixtures
      .filter(item => !fixtureHasResult(item) && dateValue(rowFor(item).Date) >= today.getTime())
      .sort((a, b) => dateValue(rowFor(a).Date) - dateValue(rowFor(b).Date))
      .slice(0, 4);
    const recent = [...state.results]
      .sort((a, b) => dateValue(rowFor(b).Date) - dateValue(rowFor(a).Date))
      .slice(0, 4);
    document.getElementById("upcomingFixtures").innerHTML = upcoming.length
      ? upcoming.map(item => fixtureCard(item, false)).join("")
      : '<div class="adminCompactEmpty">No upcoming fixtures.</div>';
    document.getElementById("recentResults").innerHTML = recent.length
      ? recent.map(item => resultCard(item, false)).join("")
      : '<div class="adminCompactEmpty">No results have been submitted.</div>';
  }

  function filtered(items, seasonId, searchId, haystack) {
    const season = document.getElementById(seasonId).value;
    const query = clean(document.getElementById(searchId).value).toLowerCase();
    return items.filter(item => {
      const seasonMatches = season === "all" || item.season === season;
      return seasonMatches && (!query || haystack(item).toLowerCase().includes(query));
    });
  }

  function renderFixtures() {
    const list = document.getElementById("fixturesList");
    const fixtures = filtered(state.fixtures, "fixtureSeasonFilter", "fixtureSearch", item => {
      const row = rowFor(item);
      return `${row.Opponent || ""} ${row.League || ""} ${row.Location || ""}`;
    }).filter(item => !fixtureHasResult(item))
      .sort((a, b) => dateValue(rowFor(a).Date) - dateValue(rowFor(b).Date));

    if (!fixtures.length) {
      list.innerHTML = '<div class="adminEmpty">No fixtures match these filters.</div>';
      return;
    }
    list.innerHTML = `<div class="adminManagedCards">${fixtures.map(item => fixtureCard(item)).join("")}</div>`;
  }

  function renderResults() {
    const list = document.getElementById("resultsList");
    const results = filtered(state.results, "resultSeasonFilter", "resultSearch", item => {
      const row = rowFor(item);
      return `${row.HomeTeam || ""} ${row.AwayTeam || ""} ${row.Competition || ""} ${Array.from({ length: 12 }, (_, index) => playerValue(row, index + 1)).join(" ")}`;
    }).sort((a, b) => dateValue(rowFor(b).Date) - dateValue(rowFor(a).Date));

    if (!results.length) {
      list.innerHTML = '<div class="adminEmpty">No results match these filters.</div>';
      return;
    }
    list.innerHTML = `<div class="adminManagedCards">${results.map(item => resultCard(item)).join("")}</div>`;
  }

  function renderPlayers() {
    const list = document.getElementById("playersList");
    const query = clean(document.getElementById("playerSearch").value).toLowerCase();
    const players = state.players
      .filter(player => !query || `${player.publicName || ""} ${player.nickname || ""} ${player.role || ""}`.toLowerCase().includes(query))
      .sort((a, b) => clean(a.publicName).localeCompare(clean(b.publicName)));
    if (!players.length) {
      list.innerHTML = '<div class="adminEmpty">No players match this search.</div>';
      return;
    }
    list.innerHTML = players.map(player => `<article class="adminPlayerCard">
      <img src="${escapeHtml(playerPhoto(player))}" alt="${escapeHtml(player.publicName)}">
      <div><h3>${escapeHtml(player.publicName || "Unnamed player")}</h3><p>${escapeHtml(player.nickname || player.role || "Player profile")}</p>
        <button class="adminSmallBtn" type="button" data-edit-player="${escapeHtml(player.playerKey)}">Edit player</button></div>
    </article>`).join("");
  }

  function selectOptions(selected) {
    return ["26-27", "25-26", "24-25"].map(value =>
      `<option value="${value}"${value === selected ? " selected" : ""}>${value.replace("-", "/")}</option>`
    ).join("");
  }

  function openFixtureEditor(item = null) {
    const row = rowFor(item);
    state.editor = { type: "fixture", id: item?.id || null };
    typeLabel.textContent = "Fixture";
    title.textContent = item ? "Edit fixture" : "Add fixture";
    form.innerHTML = `<div class="adminGrid">
      <label>Season<select name="season" required>${selectOptions(item?.season || document.getElementById("fixtureSeasonFilter").value || "26-27")}</select></label>
      <label>Date<input name="date" type="date" required value="${escapeHtml(inputDate(row.Date))}"></label>
      <label>Competition<input name="league" required value="${escapeHtml(row.League)}" placeholder="Banks League"></label>
      <label>Opponent<input name="opponent" required value="${escapeHtml(row.Opponent)}"></label>
      <label>Home or away<select name="ha"><option${row.HA === "Home" ? " selected" : ""}>Home</option><option${row.HA === "Away" ? " selected" : ""}>Away</option><option${row.HA === "Neutral" ? " selected" : ""}>Neutral</option></select></label>
      <label>Time<input name="time" type="time" value="${escapeHtml(row.Time)}"></label>
      <label class="wide">Venue<input name="location" value="${escapeHtml(row.Location)}"></label>
    </div>
    <div class="adminFormActions">
      <button class="btn btnGhost" type="button" data-cancel-editor>Cancel</button>
      <button class="btn btnPrimary" type="submit">Save fixture</button>
    </div>`;
    showEditor();
  }

  function playerInputs(row) {
    return Array.from({ length: 12 }, (_, offset) => {
      const index = offset + 1;
      return `<div class="adminPlayerRow">
        <label>Player ${index}<input name="player${index}" value="${escapeHtml(playerValue(row, index))}"></label>
        <label>Checkouts<input name="c${index}" type="number" min="0" step="1" value="${escapeHtml(row[`C${index}`])}"></label>
        <label>Fine £<input name="f${index}" type="number" min="0" step="0.01" value="${escapeHtml(row[`F${index}`])}"></label>
        <label class="doubleFine">Double fine<input name="d${index}" type="checkbox"${[true, "true", "yes", "TRUE", "Yes"].includes(row[`D${index}`]) ? " checked" : ""}></label>
        <label>180s<input name="o${index}" type="number" min="0" step="1" value="${escapeHtml(row[`O${index}`])}"></label>
        <label>Bulls<input name="b${index}" type="number" min="0" step="1" value="${escapeHtml(row[`B${index}`])}"></label>
        <label>Ton outs<input name="t${index}" type="number" min="0" step="1" value="${escapeHtml(row[`T${index}`])}"></label>
      </div>`;
    }).join("");
  }

  function openResultEditor(item = null) {
    const row = rowFor(item);
    state.editor = { type: "result", id: item?.id || null };
    typeLabel.textContent = "Result";
    title.textContent = item ? "Edit result" : "Add result";
    form.innerHTML = `<div class="adminGrid">
      <label>Season<select name="season" required>${selectOptions(item?.season || document.getElementById("resultSeasonFilter").value || "26-27")}</select></label>
      <label>Date<input name="date" type="date" required value="${escapeHtml(inputDate(row.Date))}"></label>
      <label class="wide">Competition<input name="competition" required value="${escapeHtml(row.Competition)}"></label>
      <label>Home team<input name="homeTeam" required value="${escapeHtml(row.HomeTeam)}"></label>
      <label>Away team<input name="awayTeam" required value="${escapeHtml(row.AwayTeam)}"></label>
      <label>Home score<input name="homeScore" type="number" min="0" value="${escapeHtml(row.HomeScore)}"></label>
      <label>Away score<input name="awayScore" type="number" min="0" value="${escapeHtml(row.AwayScore)}"></label>
      <label>Result<input name="result" value="${escapeHtml(row.Result)}" placeholder="Win, Loss or Draw"></label>
      <label>Venue<input name="venue" value="${escapeHtml(row.Venue)}"></label>
      <label>Stage<input name="stage" value="${escapeHtml(row.Stage)}"></label>
      <label class="adminCheckbox">Cup match<input name="cup" type="checkbox"${[true, "true", "yes", "TRUE", "Yes"].includes(row["Cup?"]) ? " checked" : ""}></label>
      <label>Home points<input name="homePoints" type="number" min="0" value="${escapeHtml(row.HomePoints)}"></label>
      <label>Away points<input name="awayPoints" type="number" min="0" value="${escapeHtml(row.AwayPoints)}"></label>
      <label class="wide">Image folder or image URLs<textarea name="imageFolder" rows="3">${escapeHtml(row.IMGFOLDER)}</textarea></label>
    </div>
    <h3 class="adminPlayersTitle">Players and fines</h3>
    ${playerInputs(row)}
    <div class="adminFormActions">
      <button class="btn btnGhost" type="button" data-cancel-editor>Cancel</button>
      <button class="btn btnPrimary" type="submit">Save result</button>
    </div>`;
    showEditor();
  }

  function openPlayerEditor(player) {
    if (!player) return;
    state.editor = { type: "player", id: player.playerKey };
    typeLabel.textContent = "Player profile";
    title.textContent = `Edit ${player.publicName}`;
    form.innerHTML = `<div class="adminPhotoEditRow wide">
      <img id="adminPlayerPhotoPreview" class="adminPlayerPhotoPreview" src="${escapeHtml(playerPhoto(player))}" alt="${escapeHtml(player.publicName)}">
      <label>Replace photo<input name="photoFile" type="file" accept="image/jpeg,image/png,image/webp"><span class="adminFieldHelp">The original Drive photo remains the default until you upload a replacement.</span></label>
    </div>
    <div class="adminGrid">
      <label>Public name<input value="${escapeHtml(player.publicName)}" disabled></label>
      <label>Nickname<input name="nickname" maxlength="80" value="${escapeHtml(player.nickname)}"></label>
      <label>Club role<input name="role" maxlength="50" value="${escapeHtml(player.role)}"></label>
      <label>Highest checkout<input name="highestCheckout" type="number" min="0" max="170" value="${escapeHtml(player.highestCheckout)}"></label>
      <label class="wide">Walkout song link<input name="song" type="url" maxlength="500" value="${escapeHtml(player.song)}"></label>
      <label class="wide">Accolades<input name="accolades" value="${escapeHtml((player.accolades || []).join(", "))}" placeholder="Comma-separated accolade keys"></label>
      <label class="wide">Bio<textarea name="bio" rows="5" maxlength="1000">${escapeHtml(player.bio)}</textarea></label>
      <label class="adminCheckbox">Gooch<input name="gooch" type="checkbox"${[true, "yes", "true"].includes(player.gooch) ? " checked" : ""}></label>
      <label class="adminCheckbox">Visible on website<input name="profileVisible" type="checkbox"${player.profileVisible !== false ? " checked" : ""}></label>
    </div>
    <div class="adminFormActions">
      <button class="btn btnGhost" type="button" data-cancel-editor>Cancel</button>
      <button class="btn btnPrimary" type="submit">Save player</button>
    </div>`;
    form.elements.photoFile.addEventListener("change", () => {
      const file = form.elements.photoFile.files?.[0];
      if (file) document.getElementById("adminPlayerPhotoPreview").src = URL.createObjectURL(file);
    });
    showEditor();
  }

  function showEditor() {
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    form.querySelector("input,select")?.focus();
  }

  function closeEditor() {
    state.editor = null;
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  async function saveFixture(data) {
    const { db, firestoreSdk } = await window.ONMFirebase.ready;
    const existing = state.fixtures.find(item => item.id === state.editor.id);
    const id = existing?.id || firestoreSdk.doc(firestoreSdk.collection(db, "fixtures")).id;
    const date = clean(data.get("date"));
    const sheetRow = {
      ...rowFor(existing),
      League: clean(data.get("league")),
      Day: dayName(date),
      Date: fixtureDate(date),
      Time: clean(data.get("time")),
      Opponent: clean(data.get("opponent")),
      HA: clean(data.get("ha")),
      Location: clean(data.get("location"))
    };
    const saved = {
      sheetRow,
      season: clean(data.get("season")),
      updatedBy: state.user.uid,
      updatedAt: firestoreSdk.serverTimestamp()
    };
    if (!existing) saved.createdAt = firestoreSdk.serverTimestamp();
    await firestoreSdk.setDoc(firestoreSdk.doc(db, "fixtures", id), saved, { merge: true });
    const local = { ...(existing || {}), id, ...saved, sheetRow };
    state.fixtures = existing ? state.fixtures.map(item => item.id === id ? local : item) : [...state.fixtures, local];
    renderFixtures();
    renderOverview();
  }

  async function saveResult(data) {
    const { db, firestoreSdk } = await window.ONMFirebase.ready;
    const existing = state.results.find(item => item.id === state.editor.id);
    const id = existing?.id || firestoreSdk.doc(firestoreSdk.collection(db, "results")).id;
    const sheetRow = {
      ...rowFor(existing),
      Competition: clean(data.get("competition")),
      Date: resultDate(data.get("date")),
      HomeTeam: clean(data.get("homeTeam")),
      AwayTeam: clean(data.get("awayTeam")),
      HomeScore: numericOrBlank(data.get("homeScore")),
      AwayScore: numericOrBlank(data.get("awayScore")),
      Result: clean(data.get("result")),
      Venue: clean(data.get("venue")),
      "Cup?": data.get("cup") === "on",
      Stage: clean(data.get("stage")),
      HomePoints: numericOrBlank(data.get("homePoints")),
      AwayPoints: numericOrBlank(data.get("awayPoints")),
      IMGFOLDER: clean(data.get("imageFolder"))
    };
    for (let index = 1; index <= 12; index += 1) {
      delete sheetRow[`Player ${index}`];
      sheetRow[`Player${index}`] = clean(data.get(`player${index}`));
      sheetRow[`C${index}`] = numericOrBlank(data.get(`c${index}`));
      sheetRow[`F${index}`] = numericOrBlank(data.get(`f${index}`));
      sheetRow[`D${index}`] = data.get(`d${index}`) === "on";
      sheetRow[`O${index}`] = numericOrBlank(data.get(`o${index}`));
      sheetRow[`B${index}`] = numericOrBlank(data.get(`b${index}`));
      sheetRow[`T${index}`] = numericOrBlank(data.get(`t${index}`));
    }
    const saved = {
      sheetRow,
      season: clean(data.get("season")),
      updatedBy: state.user.uid,
      updatedAt: firestoreSdk.serverTimestamp()
    };
    if (!existing) saved.createdAt = firestoreSdk.serverTimestamp();
    await firestoreSdk.setDoc(firestoreSdk.doc(db, "results", id), saved, { merge: true });
    const local = { ...(existing || {}), id, ...saved, sheetRow };
    state.results = existing ? state.results.map(item => item.id === id ? local : item) : [...state.results, local];
    renderResults();
    renderFixtures();
    renderOverview();
  }

  function fileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = () => reject(new Error("Could not read that image."));
      reader.readAsDataURL(file);
    });
  }

  async function savePlayer(data) {
    const player = state.players.find(item => item.playerKey === state.editor.id);
    if (!player) throw new Error("That player profile could not be found.");
    let photoUrl = player.photoUrl || player.photo || "";
    const file = form.elements.photoFile?.files?.[0];
    if (file) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPG, PNG or WebP image.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Choose an image smaller than 5 MB.");
      const uploaded = await window.ONMFirebase.post({
        action: "uploadPlayerPhoto",
        playerKey: player.playerKey,
        fileName: file.name,
        mimeType: file.type,
        imageBase64: await fileAsBase64(file)
      });
      if (!uploaded.success) throw new Error(uploaded.error || "Could not upload that photo.");
      photoUrl = uploaded.photoUrl;
    }
    const profile = {
      nickname: clean(data.get("nickname")),
      photoUrl,
      bio: clean(data.get("bio")),
      accolades: clean(data.get("accolades")).split(",").map(value => value.trim()).filter(Boolean),
      role: clean(data.get("role")),
      song: clean(data.get("song")),
      highestCheckout: clean(data.get("highestCheckout")),
      gooch: data.get("gooch") === "on",
      profileVisible: data.get("profileVisible") === "on"
    };
    const result = await window.ONMFirebase.post({ action: "updatePlayerProfile", playerKey: player.playerKey, profile });
    if (!result.success) throw new Error(result.error || "Could not save that player.");
    state.players = state.players.map(item => item.playerKey === player.playerKey
      ? { ...item, ...profile, gooch: profile.gooch ? "yes" : "" }
      : item);
    renderPlayers();
  }

  async function deleteItem(type, id) {
    const items = type === "fixture" ? state.fixtures : state.results;
    const item = items.find(entry => entry.id === id);
    if (!item) return;
    const row = rowFor(item);
    const description = type === "fixture"
      ? `${row.Opponent || "this fixture"} on ${row.Date || "the selected date"}`
      : `${row.HomeTeam || "Home"} v ${row.AwayTeam || "Away"} on ${row.Date || "the selected date"}`;
    if (!window.confirm(`Delete ${description}?\n\nThis removes it from the live website and cannot be undone.`)) return;
    try {
      const { db, firestoreSdk } = await window.ONMFirebase.ready;
      await firestoreSdk.deleteDoc(firestoreSdk.doc(db, type === "fixture" ? "fixtures" : "results", id));
      if (type === "fixture") {
        state.fixtures = state.fixtures.filter(entry => entry.id !== id);
        renderFixtures();
      } else {
        state.results = state.results.filter(entry => entry.id !== id);
        renderResults();
        renderFixtures();
      }
      renderOverview();
      showToast(`${type === "fixture" ? "Fixture" : "Result"} deleted.`);
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not delete that item.", true);
    }
  }

  async function loadCollection(name) {
    const { db, firestoreSdk } = await window.ONMFirebase.ready;
    const snapshot = await firestoreSdk.getDocs(firestoreSdk.collection(db, name));
    return snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
  }

  function attachListeners() {
    document.querySelectorAll("[data-admin-tab]").forEach(button => button.addEventListener("click", () => {
      state.activeTab = button.dataset.adminTab;
      document.querySelectorAll("[data-admin-tab]").forEach(item => item.classList.toggle("active", item === button));
      document.getElementById("fixturesPanel").classList.toggle("hidden", state.activeTab !== "fixtures");
      document.getElementById("resultsPanel").classList.toggle("hidden", state.activeTab !== "results");
      document.getElementById("playersPanel").classList.toggle("hidden", state.activeTab !== "players");
    }));
    document.getElementById("fixtureSeasonFilter").addEventListener("change", renderFixtures);
    document.getElementById("fixtureSearch").addEventListener("input", renderFixtures);
    document.getElementById("resultSeasonFilter").addEventListener("change", renderResults);
    document.getElementById("resultSearch").addEventListener("input", renderResults);
    document.getElementById("playerSearch").addEventListener("input", renderPlayers);
    document.getElementById("addFixtureBtn").addEventListener("click", () => openFixtureEditor());
    document.getElementById("addResultBtn").addEventListener("click", () => openResultEditor());
    document.getElementById("closeAdminEditor").addEventListener("click", closeEditor);
    overlay.addEventListener("click", event => { if (event.target === overlay) closeEditor(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !overlay.classList.contains("hidden")) closeEditor(); });
    document.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.hasAttribute("data-cancel-editor")) closeEditor();
      if (button.dataset.editFixture) openFixtureEditor(state.fixtures.find(item => item.id === button.dataset.editFixture));
      if (button.dataset.editResult) openResultEditor(state.results.find(item => item.id === button.dataset.editResult));
      if (button.dataset.editPlayer) openPlayerEditor(state.players.find(item => item.playerKey === button.dataset.editPlayer));
      if (button.dataset.deleteFixture) deleteItem("fixture", button.dataset.deleteFixture);
      if (button.dataset.deleteResult) deleteItem("result", button.dataset.deleteResult);
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      submit.textContent = "Saving…";
      try {
        const data = new FormData(form);
        if (state.editor.type === "fixture") await saveFixture(data);
        else if (state.editor.type === "result") await saveResult(data);
        else await savePlayer(data);
        const label = state.editor.type === "fixture" ? "Fixture" : state.editor.type === "result" ? "Result" : "Player";
        closeEditor();
        showToast(`${label} saved. The live website has been updated.`);
      } catch (error) {
        console.error(error);
        showToast(error.message || "Could not save those changes.", true);
        submit.disabled = false;
        submit.textContent = state.editor.type === "fixture" ? "Save fixture" : state.editor.type === "result" ? "Save result" : "Save player";
      }
    });
  }

  async function initialise() {
    try {
      if (!window.ONMFirebase) throw new Error("Firebase did not load.");
      state.user = await window.ONMFirebase.loadOwnUser();
      if (!state.user) {
        gate.innerHTML = '<h2>Sign in required</h2><p>Please sign in on the website first, then return to this page.</p><a class="btn btnPrimary" href="index.html">Go to sign in</a>';
        return;
      }
      if (!["owner", "admin"].includes(state.user.role)) {
        gate.innerHTML = '<h2>Administrator access required</h2><p>This area is only available to club owners and administrators.</p><a class="btn btnGhost" href="index.html">Back to website</a>';
        return;
      }
      document.getElementById("adminIdentity").textContent = `Signed in as ${state.user.firstName || state.user.email}`;
      const profilesRequest = window.ONMFirebase.post({ action: "getPublicPlayerProfiles" });
      const photosRequest = window.PlayerData?.fetchPlayerPhotosFromDrive?.().catch(() => ({})) || Promise.resolve({});
      const [fixtures, results, profileResult, photos] = await Promise.all([
        loadCollection("fixtures"), loadCollection("results"), profilesRequest, photosRequest
      ]);
      state.fixtures = fixtures;
      state.results = results;
      state.players = profileResult.success ? profileResult.profiles : [];
      state.playerPhotos = photos || {};
      gate.classList.add("hidden");
      app.classList.remove("hidden");
      attachListeners();
      renderOverview();
      renderFixtures();
      renderResults();
      renderPlayers();
    } catch (error) {
      console.error(error);
      gate.innerHTML = `<h2>Could not open the admin area</h2><p>${escapeHtml(error.message || "Please try again.")}</p>`;
    }
  }

  initialise();
})();
