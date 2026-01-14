document.getElementById("resultsGrid").innerHTML = `
      <div class="loading-results">
        <div class="spinner"></div>
        <p>Loading Results...</p>
      </div>
    `;

const CSV_URL = {
  main: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=858987471&single=true&output=csv",
  leagueStats: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=1287781750&single=true&output=csv"
};

// ✅ Reusable CSV fetch + parse
async function fetchCSVData(url) {
  const noCacheUrl = `${url}&t=${Date.now()}`;
  const response = await fetch(noCacheUrl);
  const csvText = await response.text();
  const rows = csvText.trim().split("\n").map(r => r.split(","));
  const headers = rows.shift();
  const data = rows.map(r => Object.fromEntries(r.map((v, i) => [headers[i].trim(), v.trim()])));
  const validData = data.filter(row => row.Date && !isNaN(parseDate(row.Date)));
  validData.sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
  return validData;
}

function formatSeason(season) {
  return season.replace("-", "/");
}


// ✅ Date parser (handles DD/MM/YYYY or MM/DD/YYYY)
function parseDate(dateStr) {
  const [part1, part2, part3] = dateStr.split(/[\/\-]/).map(Number);
  if (!part1 || !part2 || !part3) return new Date(NaN);

  // Handle YYYY-MM-DD first
  if (part1 > 1900) return new Date(part1, part2 - 1, part3);

  // Assume UK format (DD/MM/YYYY)
  return new Date(part3, part2 - 1, part1);
}

function toISO(d) {
  if (!(d instanceof Date) || isNaN(d)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeName(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ");
}




async function fetchLeagueStats(url) {
  const noCacheUrl = `${url}&t=${Date.now()}`;
  const response = await fetch(noCacheUrl);
  const csvText = await response.text();
  const rows = csvText.trim().split("\n").map(r => r.split(","));
  const headers = rows.shift().map(h => h.trim());
  const values = rows[0].map(v => v.trim());

  // Build object from CSV headers and first row
  const stats = {};
  headers.forEach((header, i) => {
    stats[header] = values[i];
  });

  // Transform into easy-to-use format
  const leagueStats = {
    "Banks League": {
      P: stats["Played Banks"] || 0,
      W: stats["Won Banks"] || 0,
      L: stats["Lost Banks"] || 0,
      SheetURL: url
    },
    "Trafalgar League": {
      P: stats["Played Trafalgar"] || 0,
      W: stats["Won Trafalgar"] || 0,
      L: stats["Lost Trafalgar"] || 0,
      SheetURL: url
    }
  };

  return leagueStats;
}

function expandImage(src) {
  const overlay = document.createElement("div");
  overlay.className = "image-overlay";
  overlay.innerHTML = `<img src="${src}" alt="Expanded image" />`;
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}

let currentIndex = 0;
let lightboxImages = [];
let matchInfo = {};

function openLightbox(images, startIndex = 0, event, info = {}) {
  if (event) event.stopPropagation();

  lightboxImages = images;
  currentIndex = startIndex;
  matchInfo = info;

  const lightbox = document.querySelector(".lightbox");
  const img = lightbox.querySelector(".lightbox-img");

  updateLightboxInfo();

  // Show spinner until the first image loads
  setLightboxLoading(true);
  preloadImage(images[startIndex])
    .then(() => {
      img.src = images[startIndex];
    })
    .catch(console.error)
    .finally(() => {
      setLightboxLoading(false);

      // Preload neighbors
      const after = images[(startIndex + 1) % images.length];
      const before = images[(startIndex - 1 + images.length) % images.length];
      preloadImage(after).catch(() => { });
      preloadImage(before).catch(() => { });
    });

  lightbox.classList.add("open");
  document.body.classList.add("no-scroll");
}


let isSwitching = false;
const imageCache = new Map(); // url -> true when loaded

function setLightboxLoading(isLoading) {
  const spinner = document.querySelector(".lightbox-spinner");
  if (!spinner) return;
  spinner.classList.toggle("is-loading", isLoading);
}

function preloadImage(url) {
  if (!url) return Promise.reject(new Error("Missing URL"));
  if (imageCache.get(url)) return Promise.resolve(url);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(url, true);
      resolve(url);
    };
    img.onerror = () => reject(new Error("Failed to load image: " + url));
    img.src = url;
  });
}

async function showImage(index) {
  const imgEl = document.querySelector(".lightbox-img");
  if (!imgEl || !lightboxImages.length) return;

  // prevent spam-click race conditions
  if (isSwitching) return;
  isSwitching = true;

  const nextIndex = (index + lightboxImages.length) % lightboxImages.length;
  const nextUrl = lightboxImages[nextIndex];

  // Update state immediately so UI (counter/title) advances right away
  currentIndex = nextIndex;
  updateLightboxInfo();

  // Show spinner while loading
  setLightboxLoading(true);

  // Optional: fade current image slightly while loading
  imgEl.classList.add("fade-out");

  try {
    await preloadImage(nextUrl);

    // Swap to the new image only after it’s loaded
    imgEl.src = nextUrl;

    // Fade-in
    imgEl.classList.remove("fade-out");
    imgEl.classList.add("fade-in");
    setTimeout(() => imgEl.classList.remove("fade-in"), 200);

  } catch (err) {
    console.error(err);
    // If load fails, you can revert index or show an error message
    // For now: just stop loading spinner.
  } finally {
    setLightboxLoading(false);
    isSwitching = false;

    // Preload neighbors to make navigation instant
    const after = lightboxImages[(currentIndex + 1) % lightboxImages.length];
    const before = lightboxImages[(currentIndex - 1 + lightboxImages.length) % lightboxImages.length];
    preloadImage(after).catch(() => { });
    preloadImage(before).catch(() => { });
  }
}

function nextImage() {
  showImage(currentIndex + 1);
}
function prevImage() {
  showImage(currentIndex - 1);
}



function closeLightbox() {
  document.querySelector(".lightbox").classList.remove("open");
  document.body.classList.remove("no-scroll");
}
function handleLightboxClick(event) {
  // close if you clicked the backdrop (or the overlay itself)
  if (
    event.target.classList.contains("lightbox-backdrop") ||
    event.target.classList.contains("lightbox")
  ) {
    closeLightbox();
  }
}


function updateLightboxInfo() {
  const topInfo = document.querySelector(".lightbox-info-top");
  const bottomInfo = document.querySelector(".lightbox-info-bottom");

  if (!topInfo || !bottomInfo) return;

  const { homeTeam, awayTeam, date, venue } = matchInfo;

  // Match info (top)
  topInfo.innerHTML = `
    <h3>${homeTeam} vs ${awayTeam}</h3>
    <p>${date}${venue ? ` — ${venue}` : ""}</p>
  `;

  // Counter (bottom)
  bottomInfo.innerHTML = `
    <p class="lightbox-counter">Image ${currentIndex + 1} / ${lightboxImages.length}</p>
  `;
}


// Optional: keyboard navigation
document.addEventListener("keydown", (e) => {
  const lightbox = document.querySelector(".lightbox.open");
  if (!lightbox) return;

  if (e.key === "ArrowRight") nextImage();
  if (e.key === "ArrowLeft") prevImage();
  if (e.key === "Escape") closeLightbox();
});


function updateLeagueHeadings(season) {
  document.querySelectorAll(".league-tab, .league-heading").forEach(el => {
    if (el.textContent.includes("Banks")) {
      el.textContent = `Banks League ${formatSeason(season)}`;
    } else if (el.textContent.includes("Trafalgar")) {
      el.textContent = `Trafalgar League ${formatSeason(season)}`;
    }
  });
}


// ✅ Shared image fetcher (works for both seasons)
async function fetchDriveImages(folderId) {
  const apiKey = "AIzaSyDlAZ7wv_8BNA1Nes1uBMrbZWhL0aaz1xw";
  const q = encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/'`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&key=${apiKey}&fields=files(id,name,mimeType)`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("Drive API returned", res.status);
      return [];
    }
    const data = await res.json();
    if (!data.files || !data.files.length) return [];
    return data.files.map((f) => `https://drive.google.com/thumbnail?id=${f.id}&sz=w400`);
  } catch (err) {
    console.error("fetchDriveImages error", err);
    return [];
  }
}
// 🔹 Restore saved preferences before DOM ready
let currentSeason = localStorage.getItem("season") || "25-26";
let currentViewMode = localStorage.getItem("viewMode") || "results";
let currentLeague = "banks"; // if applicable

function saveUserPrefs() {
  localStorage.setItem("season", currentSeason);
  localStorage.setItem("viewMode", currentViewMode);
}

async function fetchJSONData(url) {
  const response = await fetch(url);
  const data = await response.json();

  data.sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
  return data;
}


const SHEETS = {
  banks: {
    "25-26": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=1575634851&single=true&output=csv",
    "24-25": "data/banks-stats-24-25.json",
  },
  traf: {
    "25-26": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=1817707297&single=true&output=csv",
  },
};

function csvToStyledTable(csv) {
  const lines = csv.trim().split("\n");
  const headers = lines[0].split(",");
  const rows = lines.slice(1).map(r => r.split(","));
  const teamStats = rows[0];
  const playerRows = rows.slice(1);

  let html = `<table class="stats-table"><thead><tr>`;
  headers.forEach(h => html += `<th>${h}</th>`);
  html += `</tr></thead><tbody>`;
  html += `<tr class="team-stats-row">${teamStats.map(c => `<td>${c}</td>`).join("")}</tr>`;
  playerRows.forEach(r => {
    html += `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`;
  });
  html += `</tbody></table>`;
  return html;
}




async function fetchResults(season = currentSeason, viewMode = currentViewMode) {

  const grid = document.getElementById("resultsGrid");
  grid.innerHTML = `<div class="loading-results"><div class="spinner"></div> Loading ${viewMode}...</div>`;

  try {
    // 🎯 Select season URLs
    const urls =
      season === "24-25"
        ? {
          main: "data/result-data-24-25.json",
          leagueStats:
            "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=1942826343&single=true&output=csv",
        }
        : {
          main: CSV_URL.main,
          leagueStats: CSV_URL.leagueStats,
        };

    // 📊 Fetch both CSVs
    const mainData = urls.main.endsWith(".json")
      ? await fetchJSONData(urls.main)
      : await fetchCSVData(urls.main);

    const leagueStats = urls.leagueStats.endsWith(".json")
      ? await fetchJSONData(urls.leagueStats)
      : await fetchLeagueStats(urls.leagueStats);



    if (viewMode === "stats") {
      console.log("📊 Fetching stats view for", season);
      await fetchStats(season); // ✅ Just call your new stats function
      return; // ⛔️ Stop further rendering
    }

    // 🧩 Group by competition
    const grouped = {};
    mainData.forEach((row) => {
      if (!grouped[row.Competition]) grouped[row.Competition] = [];
      grouped[row.Competition].push(row);
    });

    const order = ["Banks League", "Trafalgar League"];

    // 🖼️ GALLERY MODE 
    if (viewMode === "gallery") {
      console.log("🖼️ Building gallery mode...");

      const allMatches = Object.values(grouped).flat();
      allMatches.sort((a, b) => {
        const toTime = (d) => {
          if (!d) return -Infinity;
          const parts = String(d).trim().split(/[\/\-]/).map(Number);
          if (parts[0] > 1900) return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1).getTime();
          if (parts[0] > 12) return new Date(parts[2], (parts[1] || 1) - 1, parts[0]).getTime();
          return new Date(parts[2], (parts[1] || 1) - 1, parts[0]).getTime();
        };
        return toTime(b.Date) - toTime(a.Date);
      });

      const galleryCards = await Promise.all(
        allMatches.map(async (match) => {
          let images = [];
          const folderUrl = match.IMGFOLDER?.trim();
          if (folderUrl) {
            const folderMatch = folderUrl.match(/(?:[?&]id=|\/folders\/)([a-zA-Z0-9_-]+)/);
            const folderId = folderMatch ? folderMatch[1] : null;
            if (folderId) images = await fetchDriveImages(folderId);
          }


          const matchInfo = {
            homeTeam: match.HomeTeam || "",
            awayTeam: match.AwayTeam || "",
            date: match.Date || "",
            venue: match.Venue || "",
          };

          // ✅ JSON-safe for inline onclick (prevents apostrophe breaking)
          const matchInfoJson = JSON.stringify(matchInfo)
            .replace(/</g, "\\u003c")
            .replace(/'/g, "\\u0027");

          const galleryImages = images.length
            ? `<div class="gallery-grid">${images
              .map(
                (src, i) =>
                  `<img src="${src}"
                    data-drive-thumb="1"
                    loading="lazy"
                    decoding="async"
                    alt="Match ${i + 1}"
                    class="gallery-thumb"
                onclick='openLightbox(${JSON.stringify(images)}, ${i}, event, ${matchInfoJson})'>`
              )
              .join("")}</div>`
            : `<div class="no-images">No photos available.</div>`;


          return `
            <div class="gallery-card ${(match.Result || "").toLowerCase()} ${match.Competition}">
              <div class="gallery-header">
                <h3>${match.HomeTeam} vs ${match.AwayTeam}</h3>
                <p class="gallery-meta">${match.Date} • ${match.Venue || "Venue TBA"}</p>
                <span class="gallery-result-label">${match.HomeScore} – ${match.AwayScore}</span>  
                <span class="gallery-league"></span>              
              </div>
              ${galleryImages}
            </div>
          `;
        })
      );

      document.getElementById("resultsGrid").innerHTML = `
        <div class="gallery-container">
          ${galleryCards.join("")}
        </div>
      `;
      return; // ✅ Exit early so league layout doesn’t render
    }

    // 🧱 DEFAULT LEAGUE MODE (existing working logic)

    const htmlMain = await (async () => {
      const leagueSections = await Promise.all(
        order.map(async (league) => {
          const matches = grouped[league] || [];
          const summary = leagueStats[league] || { P: 0, W: 0, L: 0, SheetURL: "#" };

          // If there are no matches for this league
          if (matches.length === 0) {
            return `
                  <section class="league-column ${league === "Banks League" ? "banks-league" : "trafalgar-league"}">
                    <div class="league-header">
                      <h2>${league} ${formatSeason(season)}</h2>
                      <div class="pwl-grid">
                        <a class="pwl played">P: 0</a>
                        <a class="pwl won">W: 0</a>
                        <a class="pwl lost">L: 0</a>
                      </div>
                    </div>
                    <div class="no-data">No data available for ${league} ${season.replace("-", "/")}.</div>
                  </section>
                `;
          }



          // 🧮 Build HTML for each match (existing logic unchanged)
          const matchHTMLs = await Promise.all(
            matches.map(async (match) => {
              const players = [
                { name: match.Player1, score: match.C1, fines: match.F1, doubleFines: match.D1, oneEightys: match.O1, bulls: match.B1, tonOuts: match.T1 },
                { name: match.Player2, score: match.C2, fines: match.F2, doubleFines: match.D2, oneEightys: match.O2, bulls: match.B2, tonOuts: match.T2 },
                { name: match.Player3, score: match.C3, fines: match.F3, doubleFines: match.D3, oneEightys: match.O3, bulls: match.B3, tonOuts: match.T3 },
                { name: match.Player4, score: match.C4, fines: match.F4, doubleFines: match.D4, oneEightys: match.O4, bulls: match.B4, tonOuts: match.T4 },
                { name: match.Player5, score: match.C5, fines: match.F5, doubleFines: match.D5, oneEightys: match.O5, bulls: match.B5, tonOuts: match.T5 },
                { name: match.Player6, score: match.C6, fines: match.F6, doubleFines: match.D6, oneEightys: match.O6, bulls: match.B6, tonOuts: match.T6 },
              ].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

              const isoDate = toISO(parseDate(match.Date));
              const teamN = normalizeName("Oche Ness Monsters");
              const homeN = normalizeName(match.HomeTeam);
              const awayN = normalizeName(match.AwayTeam);

              // opponent is "the team that isn't us"
              const opp = homeN === teamN ? match.AwayTeam : match.HomeTeam;
              const ha = homeN === teamN ? "Home" : "Away";

              const cardKey = `${isoDate}|${normalizeName(opp)}|${ha.toLowerCase()}`;


              // 🎞️ Fetch images
              let images = [];
              const folderUrl = match.IMGFOLDER?.trim();
              // 🖼️ If we're in gallery mode, just return gallery card instead of full result card
              if (viewMode === "gallery") {
                const matchInfo = {
                  homeTeam: match.HomeTeam || "",
                  awayTeam: match.AwayTeam || "",
                  date: match.Date || "",
                  venue: match.Venue || "",
                };
                const matchInfoJson = JSON.stringify(matchInfo)
                  .replace(/</g, "\\u003c")
                  .replace(/'/g, "\\u0027"); // ✅ escape apostrophes for inline onclick


                const galleryImages = images.length
                  ? `
                        <div class="gallery-grid">
                          ${images.map(
                    (src, i) => `
                              <img 
                                src="${src}" 
                                alt="Match photo ${i + 1}" 
                                class="gallery-thumb"
                                onclick='openLightbox(${JSON.stringify(images)}, ${i}, event, ${matchInfoJson})'>
                            `
                  ).join("")}
                        </div>`
                  : `<div class="no-images">No photos available.</div>`;

                const resultClass = (match.Result || "").toLowerCase();

                return `
                      <div class="gallery-card ${resultClass}">
                        <div class="gallery-league-tag ${league.toLowerCase().includes("trafalgar") ? "trafalgar" : "banks"}">
                          ${league.toLowerCase().includes("trafalgar") ? "TRAFALGAR" : "BANKS"}
                        </div>
                        <div class="gallery-header">
                          <h3>${match.HomeTeam} vs ${match.AwayTeam}</h3>
                          <p class="gallery-meta">${match.Date} • ${match.Venue || "Venue TBA"}</p>
                          <span class="gallery-score">${match.HomeScore} – ${match.AwayScore}</span>
                          <span class="result-label">${match.Result}</span>
                        </div>
                        ${galleryImages}
                      </div>
                    `;

              }

              if (folderUrl) {
                const folderMatch = folderUrl.match(/(?:[?&]id=|\/folders\/)([a-zA-Z0-9_-]+)/);
                const folderId = folderMatch ? folderMatch[1] : null;
                if (folderId) {
                  images = await fetchDriveImages(folderId);
                }
              }
              const visible = images.slice(0, 4);
              const extraCount = Math.max(0, images.length - visible.length);


              const matchInfo = {
                homeTeam: match.HomeTeam || "",
                awayTeam: match.AwayTeam || "",
                date: match.Date || "",
                venue: match.Venue || "",
              };
              const matchInfoJson = JSON.stringify(matchInfo)
                .replace(/</g, "\\u003c")
                .replace(/'/g, "\\u0027"); // ✅ escape apostrophes for inline onclick


              // 🧱 Build image grid
              const imageGrid = images.length
                ? `
                  <div class="match-image-grid">
                    ${visible
                  .map(
                    (src, i) => `
                      <div class="${i === 3 && extraCount > 0 ? "image-count-overlay" : ""
                      }"
                        data-extra="${i === 3 && extraCount > 0 ? "+" + extraCount : ""
                      }"
                        ${i === 3 && extraCount > 0
                        ? `onclick='openLightbox(${JSON.stringify(
                          images
                        )}, ${i}, event, ${matchInfoJson})'`
                        : ""
                      }>
                        <img src="${src}"
                          data-drive-thumb="1"
                          loading="lazy"
                          decoding="async"
                          alt="Match photo ${i + 1}"
                            onclick='openLightbox(${JSON.stringify(
                        images
                      )}, ${i}, event, ${matchInfoJson})'>
                      </div>`
                  )
                  .join("")}
                  </div>`
                : "";

              // 🧾 Player table HTML
              const playerHTML = `
                <div class="player-data player-stats" style="display: none;">
                  <div class="flex-layout">
                    <div class="player-table-wrapper">
                      <table class="player-table">
                        <thead>
                          <tr>
                            <th>Player</th>
                            <th>Checkouts</th>
                            <th>Fines</th>
                            <th>Specials</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${players
                  .map((p) => {
                    const hasDoubleFine =
                      p.doubleFines === "TRUE" || p.doubleFines === true;
                    const fineClass = hasDoubleFine ? "fine-highlight" : "";
                    const specials = [];
                    if (p.oneEightys && Number(p.oneEightys) > 0) {
                      const count =
                        Number(p.oneEightys) > 1
                          ? `×${p.oneEightys}`
                          : "";
                      specials.push(
                        `<span class="badge badge-180" title="Hit a 180">180${count}</span>`
                      );
                    }
                    if (p.bulls && Number(p.bulls) > 0) {
                      const count =
                        Number(p.bulls) > 1 ? `×${p.bulls}` : "";
                      specials.push(
                        `<span class="badge badge-bull" title="Bull checkout">Bull${count}</span>`
                      );
                    }
                    if (p.tonOuts && Number(p.tonOuts) > 0) {
                      const count =
                        Number(p.tonOuts) > 1 ? `×${p.tonOuts}` : "";
                      specials.push(
                        `<span class="badge badge-ton" title="Ton+ checkout">Ton+${count}</span>`
                      );
                    }
                    return `
                                <tr>
                                  <td>${p.name
                        ? `<a href="player.html?name=${encodeURIComponent(
                          p.name
                        )}" class="player-link">${p.name}</a>`
                        : ""
                      }<td>${p.score && Number(p.score) === 0
                        ? `<span class="bagel" title="No checkouts">🥯</span>`
                        : p.score || ""
                      }</td>
                                  <td class="${fineClass}">${p.fines || ""}</td>
                                  <td><div class="specials-container">${specials.join(
                        " "
                      )}</div></td>
                                </tr>`;
                  })
                  .join("")}
                        </tbody>
                      </table>
                    </div>
                    <div class="player-images">${imageGrid}</div>
                  </div>

                  ${match.Venue
                  ? `<div class="match-venue">
                          <img src="https://cdn.jsdelivr.net/npm/lucide-static/icons/map-pin.svg" alt="Venue" class="venue-icon">
                          <span class="venue-name">${match.Venue}</span>
                        </div>`
                  : ""
                }
                </div>
                `;

              // 🏁 Match card
              return `
                <div class="result-card ${(match.Result || "").toLowerCase()}"
                  data-key="${cardKey}"
                  data-date="${isoDate}"
                  data-opp="${normalizeName(opp)}"
                  data-ha="${ha.toLowerCase()}">
                  ${match["Cup?"]?.toLowerCase() === "true" ||
                  match["Cup?"]?.toLowerCase() === "yes"
                  ? `<img src="https://cdn.jsdelivr.net/npm/lucide-static/icons/trophy.svg"
                          alt="Cup Match" class="cup-icon" title="Cup Match">`
                  : ""
                }
                  <div class="teams">
                    <span class="team home">${match.HomeTeam}</span>
                    <span class="score">${match.HomeScore} – ${match.AwayScore}</span>
                    <span class="team away">${match.AwayTeam}</span>
                  </div>
                  <p class="date">${match.Date}</p>
                  <div class="result-label-wrapper">
                    ${images.length
                  ? `
                        <div class="result-images-corner"
                          onclick='event.stopPropagation(); openLightbox(${JSON.stringify(
                    images
                  )}, 0, event, ${matchInfoJson})'
                            title="Match photos">
                          <img src="https://cdn.jsdelivr.net/npm/lucide-static/icons/image.svg"
                              alt="Images" class="result-has-images">
                          <span class="image-count">${images.length}</span>
                        </div>`
                  : ""
                }
                    <span class="result-label">${match.Result}</span>
                  </div>

                  ${playerHTML}
                  <button class="toggle-players" onclick="togglePlayers(this)" title="Match details">▽</button>
                </div>
                  `;
            })
          );


          return `
                  <section class="league-column ${league === "Banks League" ? "banks-league" : "trafalgar-league"}">
                    <div class="league-header">
                      <h2>${league} ${formatSeason(season)}</h2>
                      <div class="pwl-grid">
                        <a class="pwl played">P: ${summary.P}</a>
                        <a class="pwl won">W: ${summary.W}</a>
                        <a class="pwl lost">L: ${summary.L}</a>
                      </div>
                    </div>
                    ${matchHTMLs.join("")}
                  </section>
                `;
        })
      );

      return leagueSections.join("");
    })();

    // 🎨 Render
    document.getElementById("resultsGrid").innerHTML = htmlMain;
    requestAnimationFrame(() => openResultFromQuery());


  } catch (err) {
    console.error(err);
    document.getElementById("resultsGrid").innerHTML = "<p>Error loading results.</p>";
  }
}

saveUserPrefs();

// ✅ Robust thumbnail fallback + retry (for Drive thumbnails)
(function setupImageFallbacks() {
  // Captures image load errors anywhere on the page
  document.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement)) return;

      // Only handle images we mark
      if (!img.dataset.driveThumb) return;

      const tries = Number(img.dataset.tries || "0");
      if (tries >= 2) return; // stop after 2 attempts

      img.dataset.tries = String(tries + 1);

      const orig = img.dataset.srcOrig || img.src;
      img.dataset.srcOrig = orig;

      // 1) First retry: same URL with cache-buster
      if (tries === 0) {
        img.src = addCacheBust(orig);
        return;
      }

      // 2) Second retry: swap to an alternate URL format
      // Works well when thumbnail endpoint is flaky
      const alt = driveThumbToUc(orig);
      if (alt && alt !== img.src) {
        img.src = addCacheBust(alt);
      }
    },
    true // IMPORTANT: capture phase to catch image load errors
  );

  function addCacheBust(url) {
    try {
      const u = new URL(url, window.location.href);
      u.searchParams.set("cb", Date.now().toString());
      return u.toString();
    } catch {
      // fallback if URL() fails
      const sep = url.includes("?") ? "&" : "?";
      return url + sep + "cb=" + Date.now();
    }
  }

  function driveThumbToUc(url) {
    // from: https://drive.google.com/thumbnail?id=FILEID&sz=w800
    // to:   https://drive.google.com/uc?export=view&id=FILEID
    const m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (!m) return "";
    const id = m[1];
    return `https://drive.google.com/uc?export=view&id=${id}`;
  }
})();




function initPage() {
  // 1️⃣ Load saved preferences
  let savedSeason = localStorage.getItem("season");
  let savedView = localStorage.getItem("viewMode");

  window.currentSeason = savedSeason || "25-26";
  window.currentViewMode = savedView || "results";
  window.currentLeague = "banks";

  applyHashViewMode();

  // 2️⃣ Apply visual active states
  document.querySelectorAll(".season-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.season === currentSeason);
  });
  document.querySelectorAll(".view-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === currentViewMode);
  });

  // 3️⃣ Season switching
  document.querySelectorAll(".season-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("active")) return;

      document.querySelectorAll(".season-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      currentSeason = btn.dataset.season;
      saveUserPrefs();
      updateTitle(currentViewMode, currentSeason);
      if (currentViewMode === "stats") {
        fetchStats(currentSeason);
      } else {
        fetchResults(currentSeason, currentViewMode);
      }
    });
  });

  // 4️⃣ View switching
  const resultsGrid = document.querySelector("#resultsGrid");
  const galleryGrid = document.querySelector("#galleryGrid");
  const statsGrid = document.querySelector("#statsGrid");

  document.querySelectorAll(".view-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("active")) return;

      document.querySelectorAll(".view-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      currentViewMode = btn.dataset.view;

      // ✅ keep URL in sync (no reload)
      history.replaceState(null, "", `#${currentViewMode}`);
      saveUserPrefs();
      updateTitle(currentViewMode, currentSeason);

      if (currentViewMode === "stats") {
        fetchStats(currentSeason); // load the special stats layout
      } else {
        fetchResults(currentSeason, currentViewMode); // load normal results/gallery
      }
    });

  });

  // 5️⃣ Initial fetch
  updateTitle(currentViewMode, currentSeason);
  if (currentViewMode === "stats") {
    fetchStats(currentSeason);
  } else {
    fetchResults(currentSeason, currentViewMode);
  }
}

// ✅ If not already in DOMContentLoaded, safely call it when ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage);
} else {
  initPage();
}



async function fetchStats(season) {
  const grid = document.getElementById("resultsGrid");

  // 🌀 Loading spinner
  grid.innerHTML = `
    <div class="loading-results">
      <div class="spinner"></div>
      <p>Loading Stats...</p>
    </div>
  `;

  await new Promise(r => setTimeout(r, 50));

  // === Sheet URLs ===
  const SHEETS = {
    banks: {
      "25-26": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=1575634851&single=true&output=csv",
      "24-25": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSeeA_wG4oiO36aIbXiYRYVxw_5jrIeL-ZG9hPHS5XD9nZuzFbGf7Tn64Tu6PrS_hb0UAArz-m7MQoE/pub?gid=1483412373&single=true&output=csv"
    },
    traf: {
      "25-26": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=1817707297&single=true&output=csv",
      "24-25": null
    }
  };

  // === League Stats URLs (P/W/L) ===
  const LEAGUE_STATS_URLS = {
    "25-26": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=1287781750&single=true&output=csv",
    "24-25": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=1942826343&single=true&output=csv"
  };

  async function fetchCSV(url) {
    if (!url) return null;
    try {
      const res = await fetch(url + "&t=" + Date.now());
      if (!res.ok) throw new Error("Network error");
      return await res.text();
    } catch (err) {
      console.warn("CSV fetch failed:", err);
      return null;
    }
  }

  // === Fetch CSV data ===
  const [banksCsv, trafCsv, leagueStats] = await Promise.all([
    fetchCSV(SHEETS.banks[season]),
    fetchCSV(SHEETS.traf[season]),
    fetchLeagueStats(LEAGUE_STATS_URLS[season])
  ]);

  const formattedSeason = season.replace("-", "/");

  // === Convert CSV to table ===
  function csvToStyledTable(csv) {
    if (!csv) return "<div class='no-data'>No data available.</div>";

    const lines = csv.trim().split("\n");
    const headers = lines[0].split(",");
    const rows = lines.slice(1).map(l => l.split(","));
    const headerHTML = headers.map(h => `<th>${h.trim()}</th>`).join("");

    const bodyHTML = rows.map((row, i) => {
      let rowClass = "";
      let style = "";

      if (i === 0) {
        rowClass = "team-stats-row";
        style = "background: rgba(255, 230, 0, 0.15); color: #ffe600; font-weight: 700;";
      } else if (i === 1) {
        rowClass = "top-player-row";
        style = "background: rgba(0, 255, 100, 0.15); color: #00ff7f; font-weight: 700;";
      }

      return `
        <tr class="${rowClass}" style="${style}">
          ${row.map((cell, j) => {
        const text = cell.trim();
        if (i >= 1 && j === 0 && text && text !== "-") {
          const href = `player.html?name=${encodeURIComponent(text)}`;
          return `<td><a href="${href}" class="player-link">${text}</a></td>`;
        }
        return `<td>${text}</td>`;
      }).join("")}
        </tr>
      `;
    }).join("");

    return `
      <div class="table-container top-scroll">
        <div class="scrollbar-top"></div>
        <table>
          <thead><tr>${headerHTML}</tr></thead>
          <tbody>${bodyHTML}</tbody>
        </table>
      </div>
    `;
  }

  // === Build HTML ===
  const banksStats = leagueStats?.["Banks League"] || { P: 0, W: 0, L: 0 };
  const trafStats = leagueStats?.["Trafalgar League"] || { P: 0, W: 0, L: 0 };

  const html = `
    <div class="stats-container">

      <!-- ⚙️ Stats Grid -->
      <div class="stats-grid">
        <div class="league-box banks-league active">
          <div class="league-header">
            <h2>Banks League ${formattedSeason}</h2>
            <div class="pwl-grid">
              <a class="pwl played">P: ${banksStats.P || 0}</a>
              <a class="pwl won">W: ${banksStats.W || 0}</a>
              <a class="pwl lost">L: ${banksStats.L || 0}</a>
            </div>
          </div>
          ${csvToStyledTable(banksCsv)}
        </div>

        <div class="league-box trafalgar-league">
          <div class="league-header">
            <h2>Trafalgar League ${formattedSeason}</h2>
            <div class="pwl-grid">
              <a class="pwl played">P: ${trafStats.P || 0}</a>
              <a class="pwl won">W: ${trafStats.W || 0}</a>
              <a class="pwl lost">L: ${trafStats.L || 0}</a>
            </div>
          </div>
          ${trafCsv
      ? csvToStyledTable(trafCsv)
      : `<div class="no-data">No data available for Trafalgar League ${formattedSeason}.</div>`}
        </div>
      </div>
    </div>
  `;

  // === Render ===
  grid.innerHTML = html;

  // === League tab switching (mobile only) ===
  document.querySelectorAll(".league-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const targetLeague = tab.dataset.league;
      document.querySelectorAll(".league-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      document.querySelectorAll(".league-box").forEach(box => {
        box.classList.toggle("active", box.classList.contains(`${targetLeague}-league`));
      });
    });
  });

  // === Enable horizontal drag scroll ===
  function enableHorizontalDragScroll() {
    document.querySelectorAll(".table-container").forEach(container => {
      let isDown = false, startX, scrollLeft;
      container.addEventListener("mousedown", e => {
        isDown = true;
        container.classList.add("dragging");
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
      });
      container.addEventListener("mouseleave", () => {
        isDown = false;
        container.classList.remove("dragging");
      });
      container.addEventListener("mouseup", () => {
        isDown = false;
        container.classList.remove("dragging");
      });
      container.addEventListener("mousemove", e => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 1;
        container.scrollLeft = scrollLeft - walk;
      });
    });
  }

  await new Promise(r => requestAnimationFrame(r));
  enableHorizontalDragScroll();
}





async function fetchSheetToTableSafe(leagueKey, seasonKey) {
  const containerId = leagueKey === "banks" ? "banks-table-container" : "traf-table-container";
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn("Missing container:", containerId);
    return;
  }

  // Immediately set a loading state so stale content is not visible
  container.innerHTML = `<div class="loading-results"><div class="spinner"></div><p>Loading ${leagueKey} Stats...</p></div>`;

  const CSV_URL = SHEETS[leagueKey]?.[seasonKey];
  console.log(`[stats] fetchSheetToTableSafe: league=${leagueKey} season=${seasonKey} url=${CSV_URL ? 'FOUND' : 'MISSING'}`);

  // If there is no sheet URL for this league/season, show explicit 'no data' and return
  if (!CSV_URL) {
    container.innerHTML = `<p class="no-data">No data available for ${leagueKey === 'traf' || leagueKey === 'trafalgar' ? 'Trafalgar' : 'Banks'} ${seasonKey.replace('-', '/')}.</p>`;
    return;
  }

  try {
    const resp = await fetch(CSV_URL + "&t=" + Date.now(), { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const csv = await resp.text();

    // build minimal stylable table (you can keep your csvToStyledTable impl)
    const tableHtml = csvToStyledTable(csv);
    container.innerHTML = tableHtml;
  } catch (err) {
    console.error(`Error loading ${leagueKey} Stats (${seasonKey}):`, err);
    container.innerHTML = `<p class="error-msg">Failed to load ${leagueKey === 'traf' ? 'Trafalgar' : 'Banks'} stats.</p>`;
  }
}

function setupLeagueToggle(viewMode) {
  const toggle = document.querySelector(".league-toggle");
  const banksBox = document.querySelector(".banks-league");
  const trafBox = document.querySelector(".trafalgar-league");

  // Hide toggle completely for gallery view
  if (viewMode === "gallery") {
    toggle.style.display = "none";
    banksBox?.classList.add("active");
    trafBox?.classList.add("active");
    return;
  }

  // Mobile toggle visible for results + stats
  if (window.innerWidth < 768) {
    toggle.style.display = "flex";

    const banksTab = toggle.querySelector('[data-league="banks"]');
    const trafTab = toggle.querySelector('[data-league="trafalgar"]');

    const switchLeague = (league) => {
      if (league === "banks") {
        banksTab.classList.add("active");
        trafTab.classList.remove("active");
        banksBox.classList.add("active");
        trafBox.classList.remove("active");
      } else {
        trafTab.classList.add("active");
        banksTab.classList.remove("active");
        trafBox.classList.add("active");
        banksBox.classList.remove("active");
      }
    };

    banksTab.onclick = () => switchLeague("banks");
    trafTab.onclick = () => switchLeague("trafalgar");

    // Default to Banks League
    switchLeague("banks");
  } else {
    toggle.style.display = "none";
    banksBox?.classList.add("active");
    trafBox?.classList.add("active");
  }
}








const SLIDE_DURATION = 260; // ms





function updateTitle(currentViewMode, currentSeason) {
  const titleEl = document.querySelector(".results-title, .results-title2");
  if (!titleEl) return;

  let viewLabel;
  switch (currentViewMode) {
    case "results":
      viewLabel = "Results";
      break;
    case "gallery":
      viewLabel = "Gallery";
      break;
    case "stats":
      viewLabel = "Stats";
      break;
    default:
      viewLabel = "Results";
  }

  titleEl.textContent = `${viewLabel} ${formatSeason(currentSeason)}`;
}

// cancel an existing animation and return the current computed height (px) if any
function cancelAndGetCurrentHeight(el) {
  if (!el) return 0;
  const current = el.getBoundingClientRect().height;
  if (el._slideAnim) {
    el._slideAnim.cancel();
    el._slideAnim = null;
  }
  return current;
}

document.addEventListener("click", (e) => {
  // ✅ if user clicked an image (or image icon), don't toggle the card
  if (e.target.closest(".result-images-corner, .match-image-grid, .gallery-thumb")) {
    return;
  }

  const card = e.target.closest(".result-card");
  if (!card) return;

  const btn = card.querySelector(".toggle-players");
  const playerData = card.querySelector(".player-data");
  const imageIcon = card.querySelector(".result-images-corner"); // ✅ ADD THIS

  if (!playerData || !btn) return;

  btn.disabled = true;

  const isHidden = window.getComputedStyle(playerData).display === "none";

  // ✅ Hide image icon when opening, show when closing
  if (imageIcon) {
    imageIcon.style.display = isHidden ? "none" : "flex";
  }

  const promise = isHidden ? animateOpen(playerData) : animateClose(playerData);

  promise.then(() => {
    btn.disabled = false;
    btn.textContent = isHidden ? "△" : "▽";
    btn.setAttribute("aria-expanded", isHidden ? "true" : "false");
  });
});


function animateOpen(el, duration = SLIDE_DURATION) {
  if (!el) return Promise.resolve();

  // ✅ make sure CSS switches to "open" rules
  el.classList.add("expanded");

  const wasHidden = window.getComputedStyle(el).display === "none";
  const prevHeight = cancelAndGetCurrentHeight(el);

  if (wasHidden) el.style.display = "block";

  const startHeight = (prevHeight > 0) ? prevHeight : 0;
  const targetHeight = el.scrollHeight;

  el.style.overflow = "hidden";
  el.style.height = startHeight + "px";

  const anim = el.animate(
    [{ height: startHeight + "px", opacity: 0 }, { height: targetHeight + "px", opacity: 1 }],
    { duration, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }
  );

  el._slideAnim = anim;

  return new Promise(resolve => {
    anim.onfinish = () => {
      el.style.removeProperty("height");
      el.style.removeProperty("overflow");
      el.style.removeProperty("opacity");
      el._slideAnim = null;
      resolve();
    };
    anim.oncancel = () => {
      el._slideAnim = null;
      resolve();
    };
  });
}

function animateClose(el, duration = SLIDE_DURATION) {
  if (!el) return Promise.resolve();

  const startHeight = cancelAndGetCurrentHeight(el) || el.getBoundingClientRect().height;

  el.style.overflow = "hidden";
  el.style.height = startHeight + "px";

  const anim = el.animate(
    [{ height: startHeight + "px", opacity: 1 }, { height: "0px", opacity: 0 }],
    { duration, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }
  );

  el._slideAnim = anim;

  return new Promise(resolve => {
    anim.onfinish = () => {
      el.style.display = "none";
      el.style.removeProperty("height");
      el.style.removeProperty("overflow");
      el.style.removeProperty("opacity");

      // ✅ remove the CSS "open" rules
      el.classList.remove("expanded");

      el._slideAnim = null;
      resolve();
    };
    anim.oncancel = () => {
      el._slideAnim = null;
      resolve();
    };
  });
}



function applyHashViewMode() {
  const hash = (window.location.hash || "").replace("#", "").toLowerCase();

  // only allow your real modes
  if (hash === "results" || hash === "gallery" || hash === "stats") {
    currentViewMode = hash;
    localStorage.setItem("viewMode", currentViewMode);
    return true;
  }
  return false;
}

function openResultFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const date = (params.get("date") || "").trim();           // YYYY-MM-DD
  const opp = normalizeName(params.get("opp") || "");
  const ha = (params.get("ha") || "").trim().toLowerCase(); // home/away

  if (!date || !opp || !ha) return;

  const key = `${date}|${opp}|${ha}`;
  const card = document.querySelector(`.result-card[data-key="${CSS.escape(key)}"]`);
  if (!card) return;

  // scroll to it
  card.scrollIntoView({ behavior: "smooth", block: "center" });

  // “open” it: click the toggle button if it exists
  const btn = card.querySelector(".toggle-players");
  if (btn) {
    // Only open if currently closed
    const playerData = card.querySelector(".player-data");
    const isHidden = playerData && window.getComputedStyle(playerData).display === "none";
    if (isHidden) btn.click();
  }

  // optional highlight flash
  card.classList.add("deep-link-highlight");
  setTimeout(() => card.classList.remove("deep-link-highlight"), 1600);
}

