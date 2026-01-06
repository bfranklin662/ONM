// === CONFIG: Google Sheet CSV URLs ===
const SHEETS = {
      banks: {
        "25-26": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=1575634851&single=true&output=csv",
        "24-25": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSeeA_wG4oiO36aIbXiYRYVxw_5jrIeL-ZG9hPHS5XD9nZuzFbGf7Tn64Tu6PrS_hb0UAArz-m7MQoE/pub?gid=1483412373&single=true&output=csv"
      },
      traf: {
        "25-26": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=1817707297&single=true&output=csv"
      }
    };


// === GET PLAYER NAME FROM URL ===
const params = new URLSearchParams(window.location.search);
const playerName = params.get("player");
document.getElementById("playerName").textContent = playerName || "Unknown Player";

// === OPTIONAL PLAYER IMAGE / NICKNAME MAP ===
const playerProfiles = {
  Ricky: { photo: "images/ricky.jpg", nickname: '"The Plowman"' },
  Nick: { photo: "images/nick.jpg", nickname: '"The Monster"' },
  Phil: { photo: "images/phil1.jpg", nickname: '"The Surgeon"' },
  // add others...
};

const profile = playerProfiles[playerName] || {};
document.getElementById("playerPhoto").src = profile.photo || "images/default.jpg";
document.getElementById("playerNickname").textContent = profile.nickname || "";

// === MPL DATA (your in-memory array) ===
const mplMatches = {
      "Filip": {
        photo: "images/filip.jpg",
        nickname: "The Hammer",
        stats: { Played: 9, Won: 8, Drawn: 0, Lost: 1, LegsFor: 32, LegsAgainst: 11, Bulls: 0 },
        results: [
          { fixture: 1, opponent: "George", result: "Win", score: "4–0", bulls: 0 },
          { fixture: 2, opponent: "Ricky", result: "Win", score: "4–0", bulls: 0 },
          { fixture: 3, opponent: "Jack", result: "Win", score: "4–2", bulls: 0 },
          { fixture: 4, opponent: "James", result: "Loss", score: "0–4", bulls: 0 },
          { fixture: 5, opponent: "Nick", result: "Win", score: "4–1", bulls: 0 },
          { fixture: 6, opponent: "Paddy", result: "Win", score: "4–0", bulls: 0 },
          { fixture: 7, opponent: "Codon", result: "Win", score: "4–2", bulls: 0 },
          { fixture: 8, opponent: "Phil", result: "Win", score: "4–0", bulls: 0 },
          { fixture: 9, opponent: "Rob", result: "Win", score: "4–2", bulls: 0 },
        ]
      },
      "Ricky": {
        photo: "images/ricky1.jpg",
        nickname: "The Plowman",
        stats: { Played: 8, Won: 5, Drawn: 1, Lost: 2, LegsFor: 25, LegsAgainst: 16, Bulls: 2 },
        results: [
          { fixture: 1, opponent: "Jack", result: "Loss", score: "4-3", bulls: 1 },
          { fixture: 2, opponent: "Filip", result: "Loss", score: "0-4", bulls: 0 },
          { fixture: 3, opponent: "Nick", result: "Win", score: "4-0", bulls: 0 },
          { fixture: 4, opponent: "Paddy", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 5, opponent: "Codon", result: "Win", score: "4-2", bulls: 0 },
          { fixture: 6, opponent: "Phil", result: "Win", score: "4-1", bulls: 0 },
          { fixture: 7, opponent: "Rob", result: "Draw", score: "3-3", bulls: 1 },
          { fixture: 8, opponent: "George", result: "Win", score: "4-0", bulls: 0 },
          { fixture: 9, opponent: "James", result: "Win", score: "4-2", bulls: 0 }
        ]
      },
      "Jack": {
        photo: "images/jack.jpg",
        nickname: "The Chill Zill",
        stats: { Played: 7, Won: 6, Drawn: 0, Lost: 1, LegsFor: 26, LegsAgainst: 13, Bulls: 1 },
        results: [
          { fixture: 1, opponent: "Ricky", result: "Win", score: "4-2", bulls: 0 },
          { fixture: 2, opponent: "James", result: "Win", score: "4-1", bulls: 0 },
          { fixture: 3, opponent: "Filip", result: "Loss", score: "2-4", bulls: 0 },
          { fixture: 4, opponent: "Nick", result: "Win", score: "4-1", bulls: 0 },
          { fixture: 5, opponent: "Paddy", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 6, opponent: "Codon", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 7, opponent: "Phil", result: "Win", score: "4-2", bulls: 0 },
          { fixture: 8, opponent: "Rob", result: "Win", score: "4-1", bulls: 0 },
          { fixture: 9, opponent: "George", result: "Win", score: "4-2", bulls: 0 }
        ]
      },
      "Rob": {
        photo: "images/rob1.jpg",
        nickname: "Pie Man",
        stats: { Played: 9, Won: 4, Drawn: 2, Lost: 3, LegsFor: 25, LegsAgainst: 21, Bulls: 3 },
        results: [
          { fixture: 1, opponent: "Nick", result: "Win", score: "4-1", bulls: 0 },
          { fixture: 2, opponent: "Paddy", result: "Win", score: "4-0", bulls: 0 },
          { fixture: 3, opponent: "Codon", result: "Loss", score: "0-4", bulls: 0 },
          { fixture: 4, opponent: "Phil", result: "Draw", score: "3-3", bulls: 1 },
          { fixture: 5, opponent: "Billiams", result: "Win", score: "4-2", bulls: 0 },
          { fixture: 6, opponent: "George", result: "Win", score: "4-0", bulls: 1 },
          { fixture: 7, opponent: "Ricky", result: "Draw", score: "3-3", bulls: 1 },
          { fixture: 8, opponent: "Jack", result: "Loss", score: "1-4", bulls: 0 },
          { fixture: 8, opponent: "Filip", result: "Loss", score: "2-4", bulls: 0 }
        ]
      },
      "Phil": {
        photo: "images/phil1.jpg",
        nickname: "The Surgeon",
        stats: { Played: 9, Won: 3, Drawn: 3, Lost: 3, LegsFor: 24, LegsAgainst: 26, Bulls: 1 },
        results: [
          { fixture: 1, opponent: "Paddy", result: "Loss", score: "3-4", bulls: 0 },
          { fixture: 2, opponent: "Codon", result: "Draw", score: "3-3", bulls: 0 },
          { fixture: 3, opponent: "Billiams", result: "Win", score: "4-1", bulls: 0 },
          { fixture: 4, opponent: "Rob", result: "Draw", score: "3-3", bulls: 0 },
          { fixture: 5, opponent: "George", result: "Loss", score: "2-4", bulls: 0 },
          { fixture: 6, opponent: "Ricky", result: "Loss", score: "1-4", bulls: 0 },
          { fixture: 7, opponent: "Jack", result: "Loss", score: "1-4", bulls: 0 },
          { fixture: 8, opponent: "Filip", result: "Loss", score: "0-4", bulls: 0 },
          { fixture: 9, opponent: "Nick", result: "Win", score: "4-2", bulls: 1 }
        ]
      },
      "Codon": {
        photo: "images/codon1.jpg",
        nickname: "C-Dub",
        stats: { Played: 6, Won: 3, Drawn: 1, Lost: 2, LegsFor: 19, LegsAgainst: 14, Bulls: 1 },
        results: [
          { fixture: 1, opponent: "James", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 2, opponent: "Phil", result: "Draw", score: "3-3", bulls: 1 },
          { fixture: 3, opponent: "Rob", result: "Win", score: "4-0", bulls: 0 },
          { fixture: 4, opponent: "George", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 5, opponent: "Ricky", result: "Loss", score: "2-4", bulls: 0 },
          { fixture: 6, opponent: "Jack", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 7, opponent: "Filip", result: "Loss", score: "2-4", bulls: 0 },
          { fixture: 8, opponent: "Nick", result: "Win", score: "4-2", bulls: 0 },
          { fixture: 9, opponent: "Paddy", result: "Win", score: "4-2", bulls: 0 }
        ]
      },
      "Billiams": {
        photo: "images/billy1.jpg",
        nickname: "Billiams",
        stats: { Played: 5, Won: 2, Drawn: 0, Lost: 3, LegsFor: 15, LegsAgainst: 13, Bulls: 0 },
        results: [
          { fixture: 1, opponent: "Codon", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 2, opponent: "Jack", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 3, opponent: "Phil", result: "Loss", score: "1-4", bulls: 0 },
          { fixture: 4, opponent: "Filip", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 5, opponent: "Rob", result: "Loss", score: "2-4", bulls: 0 },
          { fixture: 6, opponent: "Nick", result: "Win", score: "4-0", bulls: 0 },
          { fixture: 7, opponent: "George", result: "Win", score: "4-1", bulls: 0 },
          { fixture: 8, opponent: "Paddy", result: "Loss", score: "0-4", bulls: 0 },
          { fixture: 9, opponent: "Ricky", result: "NA", score: "NA", bulls: "NA" }
        ]
      },
      "James": {
        photo: "images/james.jpg",
        nickname: "The Baby Guinness",
        stats: { Played: 3, Won: 1, Drawn: 0, Lost: 2, LegsFor: 7, LegsAgainst: 8, Bulls: 0 },
        results: [
          { fixture: 1, opponent: "Codon", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 2, opponent: "Jack", result: "Loss", score: "1-4", bulls: 0 },
          { fixture: 3, opponent: "Phil", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 4, opponent: "Filip", result: "Win", score: "4-0", bulls: 0 },
          { fixture: 5, opponent: "Rob", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 6, opponent: "Nick", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 7, opponent: "George", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 8, opponent: "Paddy", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 9, opponent: "Ricky", result: "Loss", score: "2-4", bulls: 0 }
        ]
      },
      "Paddy": {
        photo: "images/paddy1.jpg",
        nickname: "The Cope",
        stats: { Played: 8, Won: 7, Drawn: 1, Lost: 3, LegsFor: 14, LegsAgainst: 21, Bulls: 2 },
        results: [
          { fixture: 1, opponent: "Phil", result: "Draw", score: "3-3", bulls: 0 },
          { fixture: 2, opponent: "Rob", result: "Loss", score: "0-4", bulls: 0 },
          { fixture: 3, opponent: "George", result: "Draw", score: "3-3", bulls: 1 },
          { fixture: 4, opponent: "Ricky", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 5, opponent: "Jack", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 6, opponent: "Filip", result: "Loss", score: "0-4", bulls: 0 },
          { fixture: 7, opponent: "Nick", result: "Draw", score: "3-3", bulls: 1 },
          { fixture: 8, opponent: "Billy", result: "Win", score: "4-0", bulls: 0 },
          { fixture: 9, opponent: "Codon", result: "Loss", score: "1-4", bulls: 0 }
        ]
      },
      "Nick": {
        photo: "images/nick.jpg",
        nickname: "The Monster",
        stats: { Played: 9, Won: 1, Drawn: 1, Lost: 7, LegsFor: 14, LegsAgainst: 33, Bulls: 0 },
        results: [
          { fixture: 1, opponent: "Rob", result: "Loss", score: "1-4", bulls: 0 },
          { fixture: 2, opponent: "George", result: "Win", score: "4-2", bulls: 0 },
          { fixture: 3, opponent: "Ricky", result: "Loss", score: "0-4", bulls: 0 },
          { fixture: 4, opponent: "Jack", result: "Loss", score: "1-4", bulls: 0 },
          { fixture: 5, opponent: "Filip", result: "Loss", score: "1-4", bulls: 0 },
          { fixture: 6, opponent: "Billiams", result: "Loss", score: "0-4", bulls: 0 },
          { fixture: 7, opponent: "Paddy", result: "Draw", score: "3-3", bulls: 0 },
          { fixture: 8, opponent: "Codon", result: "Loss", score: "2-4", bulls: 0 },
          { fixture: 9, opponent: "Phil", result: "Loss", score: "2-4", bulls: 0 }
        ]
      },
      "George": {
        photo: "images/george1.jpg",
        nickname: "Welsh Wizard",
        stats: { Played: 8, Won: 0, Drawn: 1, Lost: 7, LegsFor: 10, LegsAgainst: 31, Bulls: 0 },
        results: [
          { fixture: 1, opponent: "Filip", result: "Loss", score: "0-4", bulls: 0 },
          { fixture: 2, opponent: "Nick", result: "Loss", score: "2-4", bulls: 0 },
          { fixture: 3, opponent: "Paddy", result: "Draw", score: "3-3", bulls: 0 },
          { fixture: 4, opponent: "Codon", result: "NA", score: "NA", bulls: "NA" },
          { fixture: 5, opponent: "Phil", result: "Loss", score: "2-4", bulls: 0 },
          { fixture: 6, opponent: "Rob", result: "Loss", score: "0-4", bulls: 0 },
          { fixture: 7, opponent: "Billiams", result: "Loss", score: "1-4", bulls: 0 },
          { fixture: 8, opponent: "Ricky", result: "Loss", score: "0-4", bulls: 0 },
          { fixture: 9, opponent: "Jack", result: "Loss", score: "2-4", bulls: 0 }
        ]
      }
    };

// === CSV FETCH HELPER ===
async function fetchCSV(url) {
  const res = await fetch(url);
  const text = await res.text();
  const [headerLine, ...rows] = text.split("\n").filter(r => r.trim());
  const headers = headerLine.split(",").map(h => h.trim());
  return rows.map(r => {
    const values = r.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ? values[i].trim() : ""]));
  });
}

// === GENERATE STATS CARDS ===
function buildStats(data) {
  if (!data.length) return `<p>No data found.</p>`;

  const appearances = data.length;
  const totalWins = data.filter(d => d.result === "Win" || d.Result === "Win").length;
  const totalLosses = data.filter(d => d.result === "Loss" || d.Result === "Loss").length;
  const total180s = data.reduce((a, r) => a + (Number(r.oneEightys || r["180s"]) || 0), 0);
  const totalCheckouts = data.reduce((a, r) => a + (Number(r.checkouts || r["Checkouts"]) || 0), 0);

  return `
    <div class="stat-card"><h3>${appearances}</h3><p>Appearances</p></div>
    <div class="stat-card"><h3>${totalWins}</h3><p>Wins</p></div>
    <div class="stat-card"><h3>${totalLosses}</h3><p>Losses</p></div>
    <div class="stat-card"><h3>${totalCheckouts}</h3><p>Checkouts</p></div>
    <div class="stat-card"><h3>${total180s}</h3><p>180s</p></div>
  `;
}

// === LOAD MPL STATS FROM ARRAY ===
function loadMPLStats() {
  const filtered = mplMatches.filter(m => m.player === playerName);
  document.getElementById("mplStats").innerHTML = buildStats(filtered);
}

// === LOAD BANKS LEAGUE DATA WITH SEASON FILTER ===
async function loadBanksStats(season = "25/26") {
  const data = await fetchCSV(SHEET_URLS.banks);
  const filtered = data.filter(
    row => (row.Player === playerName || row.Name === playerName) && (row.Season === season)
  );
  document.getElementById("banksStats").innerHTML = buildStats(filtered);
}

// === LOAD TRAFALGAR LEAGUE DATA ===
async function loadTrafalgarStats() {
  const data = await fetchCSV(SHEET_URLS.trafalgar);
  const filtered = data.filter(row => row.Player === playerName || row.Name === playerName);
  document.getElementById("trafalgarStats").innerHTML = buildStats(filtered);
}

// === CREATE SEASON DROPDOWN FOR BANKS TAB ===
function createSeasonDropdown() {
  const banksSection = document.getElementById("banks");
  const dropdown = document.createElement("select");
  dropdown.id = "seasonSelect";
  dropdown.style.marginBottom = "1rem";
  dropdown.innerHTML = `
    <option value="25/26" selected>2025/26 Season</option>
    <option value="24/25">2024/25 Season</option>
  `;
  dropdown.addEventListener("change", e => loadBanksStats(e.target.value));
  banksSection.insertBefore(dropdown, document.getElementById("banksStats"));
}

// === TAB SWITCHING ===
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// === INIT ===
loadMPLStats();
loadBanksStats();
loadTrafalgarStats();
createSeasonDropdown();


// === FILTER + STATS BUILDER ===
function buildStats(data) {
  if (!data.length) return `<p>No data found.</p>`;

  const appearances = data.length;
  const total180s = data.reduce((acc, r) => acc + (Number(r["180s"]) || 0), 0);
  const totalCheckouts = data.reduce((acc, r) => acc + (Number(r["Checkouts"]) || 0), 0);
  const totalWins = data.reduce((acc, r) => acc + (r["Result"] === "Win" ? 1 : 0), 0);
  const totalLosses = data.reduce((acc, r) => acc + (r["Result"] === "Loss" ? 1 : 0), 0);

  return `
    <div class="stat-card"><h3>${appearances}</h3><p>Appearances</p></div>
    <div class="stat-card"><h3>${totalWins}</h3><p>Wins</p></div>
    <div class="stat-card"><h3>${totalLosses}</h3><p>Losses</p></div>
    <div class="stat-card"><h3>${totalCheckouts}</h3><p>Checkouts</p></div>
    <div class="stat-card"><h3>${total180s}</h3><p>180s</p></div>
  `;
}

// === LOAD DATA FOR ALL LEAGUES ===
async function loadStats() {
  for (const [key, url] of Object.entries(SHEET_URLS)) {
    const data = await fetchCSV(url);
    const filtered = data.filter(row => Object.values(row).includes(playerName));
    const html = buildStats(filtered);
    document.getElementById(`${key}Stats`).innerHTML = html;
  }
}

// === TAB SWITCHING ===
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// === INIT ===
loadMPLStats();
loadBanksStats();
loadTrafalgarStats();
createSeasonDropdown();
