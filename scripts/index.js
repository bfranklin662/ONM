const HOME_CSVS = {
  allStats: "https://docs.google.com/spreadsheets/d/1svcwpJZujjUG-mJbYHFqiiGtKvqM2QrnyK1FC1ZdiNQ/export?format=csv&gid=590387953",
  banksStats: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=1575634851&single=true&output=csv",
  trafStats: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=1817707297&single=true&output=csv"
};

async function fetchCsvRows(url) {
  const res = await fetch(`${url}&t=${Date.now()}`);
  const text = await res.text();

  return text
    .trim()
    .split("\n")
    .map(row => row.split(",").map(cell => cell.trim()));
}

const LB_SLIDE_DURATION = 260;
const HOME_LEADERBOARD_FILTERS = [
  { key: "appearances", label: "Appearances", valueLabel: "Played", formatter: v => Number(v || 0) },
  { key: "checkouts", label: "Checkouts", valueLabel: "Checkouts", formatter: v => Number(v || 0) },
  { key: "oneEightys", label: "180s", valueLabel: "180s", formatter: v => Number(v || 0) },
  { key: "bulls", label: "Bull-outs", valueLabel: "Bull-outs", formatter: v => Number(v || 0) },
  { key: "tonOuts", label: "Ton+ Outs", valueLabel: "Ton+ Outs", formatter: v => Number(v || 0) },
  { key: "highestCheckout", label: "Highest checkout", valueLabel: "Highest out", formatter: v => Number(v || 0) }
];

let homeLeaderboardPlayers = [];
let activeHomeLeaderboardKey = "appearances";
let homeLeaderboardExpanded = false;

async function fetchHighestCheckouts(playersMap) {
  const res = await fetch(`data/player-profile.json?t=${Date.now()}`);
  const profiles = await res.json();

  Object.entries(profiles).forEach(([name, profile]) => {
    const highest = Number(profile["highest-checkout"] || 0);
    if (!highest) return;

    if (!playersMap[name]) {
      playersMap[name] = {
        name,
        checkouts: 0,
        oneEightys: 0,
        bulls: 0,
        tonOuts: 0,
        appearances: 0,
        highestCheckout: 0,
        owed: 0
      };
    }

    playersMap[name].highestCheckout = highest;
  });
}

function cancelAndGetCurrentHeight(el) {
  if (!el) return 0;
  const current = el.getBoundingClientRect().height;
  if (el._slideAnim) {
    el._slideAnim.cancel();
    el._slideAnim = null;
  }
  return current;
}


function animateOpen(el, duration = LB_SLIDE_DURATION) {
  if (!el) return Promise.resolve();

  const wasHidden = window.getComputedStyle(el).display === "none";
  const prevHeight = cancelAndGetCurrentHeight(el);

  if (wasHidden) el.style.display = "block";

  const startHeight = prevHeight > 0 ? prevHeight : 0;
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

function animateClose(el, duration = LB_SLIDE_DURATION) {
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
      el._slideAnim = null;
      resolve();
    };
    anim.oncancel = () => {
      el._slideAnim = null;
      resolve();
    };
  });
}

function moneyToNumber(value) {
  return Number(String(value || "").replace(/[£,\s]/g, "")) || 0;
}

function numberToMoney(value) {
  return `£${Number(value || 0).toFixed(2)}`;
}

function normalizeName(name) {
  return String(name || "").trim();
}

function addToPlayer(map, name, key, value) {
  if (!name) return;

  if (!map[name]) {
    map[name] = {
      name,
      checkouts: 0,
      oneEightys: 0,
      bulls: 0,
      tonOuts: 0,
      highestCheckout: 0,
      appearances: 0,
      owed: 0
    };
  }

  map[name][key] += Number(value || 0);
}

function readStatRows(rows, playersMap) {
  if (!rows.length) return;

  const headers = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1);

  const nameIdx = headers.findIndex(h =>
    ["Player", "Name"].includes(h)
  );

  const checkoutsIdx = headers.findIndex(h =>
    h.toLowerCase().includes("checkout")
  );

  const one80Idx = headers.findIndex(h =>
    h.toLowerCase().includes("180")
  );

  const bullIdx = headers.findIndex(h =>
    h.toLowerCase().includes("bull")
  );

  const tonIdx = headers.findIndex(h =>
    h.toLowerCase().includes("ton")
  );

  const highestCheckoutIdx = headers.findIndex(h =>
    h.toLowerCase().includes("highest")
  );

  const appearancesIdx = headers.findIndex(h =>
    h.toLowerCase().includes("played")
  );

  dataRows.forEach(row => {
    const name = normalizeName(row[nameIdx]);
    if (!name || name.toLowerCase() === "team") return;

    addToPlayer(playersMap, name, "checkouts", Number(row[checkoutsIdx]) || 0);
    addToPlayer(playersMap, name, "oneEightys", Number(row[one80Idx]) || 0);
    addToPlayer(playersMap, name, "bulls", Number(row[bullIdx]) || 0);
    addToPlayer(playersMap, name, "tonOuts", Number(row[tonIdx]) || 0);
    addToPlayer(playersMap, name, "appearances", Number(row[appearancesIdx]) || 0);

    if (highestCheckoutIdx >= 0) {
      const currentHigh = Number(row[highestCheckoutIdx]) || 0;

      if (!playersMap[name]) {
        addToPlayer(playersMap, name, "highestCheckout", 0);
      }

      playersMap[name].highestCheckout = Math.max(
        playersMap[name].highestCheckout || 0,
        currentHigh
      );
    }
  });
}

function readFinesRows(rows, playersMap) {
  rows.forEach(row => {
    const name = normalizeName(row[0]); // Column A
    const owed = moneyToNumber(row[6]); // Column G

    if (!name || owed <= 0) return;

    if (!playersMap[name]) {
      playersMap[name] = {
        name,
        checkouts: 0,
        oneEightys: 0,
        bulls: 0,
        tonOuts: 0,
        highestCheckout: 0,
        appearances: 0,
        owed: 0
      };
    }

    playersMap[name].owed = owed;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getActiveHomeLeaderboardFilter() {
  return HOME_LEADERBOARD_FILTERS.find(filter => filter.key === activeHomeLeaderboardKey) ||
    HOME_LEADERBOARD_FILTERS[0];
}

function renderHomeLeaderboardPills() {
  const pills = document.getElementById("homeLeaderboardPills");
  if (!pills) return;

  pills.innerHTML = HOME_LEADERBOARD_FILTERS.map(filter => `
    <button
      class="${filter.key === activeHomeLeaderboardKey ? "active" : ""}"
      type="button"
      data-home-leaderboard-filter="${filter.key}"
    >
      ${filter.label}
    </button>
  `).join("");
}

function renderHomeLeaderboard() {
  const grid = document.getElementById("homeLeaderboardsGrid");
  if (!grid) return;

  const filter = getActiveHomeLeaderboardFilter();
  const sorted = homeLeaderboardPlayers
    .filter(player => Number(player[filter.key]) > 0)
    .sort((a, b) => Number(b[filter.key] || 0) - Number(a[filter.key] || 0));
  const visibleRows = homeLeaderboardExpanded ? sorted : sorted.slice(0, 10);
  const hasMoreRows = sorted.length > 10;

  renderHomeLeaderboardPills();

  grid.innerHTML = `
    <article class="home-leaderboard-table leaderboard-${filter.key}">
      <div class="home-leaderboard-table-title">
        <h3>${filter.label}</h3>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>${filter.valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          ${visibleRows.length ? visibleRows.map((player, index) => `
            <tr class="${index === 0 ? "top-player-row" : ""}">
              <td>${index + 1}</td>
              <td>
                <a href="player-profile.html?name=${encodeURIComponent(player.name)}" class="player-link">
                  ${escapeHtml(player.name)}
                </a>
              </td>
              <td>${filter.formatter(player[filter.key])}</td>
            </tr>
          `).join("") : `
            <tr>
              <td colspan="3" class="leaderboard-empty">No data yet</td>
            </tr>
          `}
        </tbody>
      </table>
      ${hasMoreRows ? `
        <button class="homeLeaderboardExpand" type="button" data-home-leaderboard-expand aria-expanded="${homeLeaderboardExpanded}">
          ${homeLeaderboardExpanded ? "△" : "▽"}
        </button>
      ` : ""}
    </article>
  `;
}

async function loadHomeLeaderboards() {
  const grid = document.getElementById("homeLeaderboardsGrid");
  if (!grid) return;

  grid.innerHTML = `
    <div class="loading-season-leaders">
      <div class="spinner"></div>
      <p>Loading Season Leaders...</p>
    </div>
  `;

  try {
    const allStatsRows = await fetchCsvRows(HOME_CSVS.allStats);

    const playersMap = {};

    readStatRows(allStatsRows, playersMap);
    await fetchHighestCheckouts(playersMap);

    homeLeaderboardPlayers = Object.values(playersMap);
    renderHomeLeaderboard();

  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="leaderboard-empty">Could not load leaderboards.</div>`;
  }
}

function openPaymentModal() {
  const paymentModal = document.getElementById("paymentModal");
  paymentModal?.classList.remove("hidden");
  paymentModal?.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closePaymentDetailsModal() {
  const paymentModal = document.getElementById("paymentModal");
  paymentModal?.classList.add("hidden");
  paymentModal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

document.addEventListener("click", async (e) => {
  const homeLeaderboardPill = e.target.closest("[data-home-leaderboard-filter]");
  const homeLeaderboardExpand = e.target.closest("[data-home-leaderboard-expand]");
  const infoBtn = e.target.closest(".leaderboard-info-btn");
  const closeBtn = e.target.closest("#closePaymentModal");
  const copyBtn = e.target.closest(".copy-btn");
  const paymentModal = document.getElementById("paymentModal");

  if (homeLeaderboardPill) {
    activeHomeLeaderboardKey = homeLeaderboardPill.dataset.homeLeaderboardFilter;
    homeLeaderboardExpanded = false;
    renderHomeLeaderboard();
    return;
  }

  if (homeLeaderboardExpand) {
    homeLeaderboardExpanded = !homeLeaderboardExpanded;
    renderHomeLeaderboard();
    return;
  }

  if (infoBtn) {
    e.preventDefault();
    e.stopPropagation();
    openPaymentModal();
    return;
  }

  if (closeBtn) {
    closePaymentDetailsModal();
    return;
  }

  if (paymentModal && e.target === paymentModal) {
    closePaymentDetailsModal();
    return;
  }

  if (copyBtn) {
    const value = copyBtn.getAttribute("data-copy");
    if (!value) return;

    await navigator.clipboard.writeText(value);
    copyBtn.classList.add("copied");

    setTimeout(() => {
      copyBtn.classList.remove("copied");
    }, 1200);
  }
});

document.addEventListener("DOMContentLoaded", loadHomeLeaderboards);
