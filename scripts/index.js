const HOME_CSVS = {
  fines26: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOwv79tu3ymEo-hs92a68mmdm4z6BB2eX1ty10iZfa4JjBgBQOsEbRavREU5ewFOuiZITHkJ7VH4pu/pub?gid=1227331675&single=true&output=csv",
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
        owed: 0
      };
    }

    playersMap[name].owed = owed;
  });
}

function makeLeaderboardCard({ title, rows, key, formatter }) {
  const sorted = rows
    .filter(p => Number(p[key]) > 0)
    .sort((a, b) => Number(b[key]) - Number(a[key]));

  const topFive = sorted.slice(0, 5);
  const rest = sorted.slice(5);

  const makeRows = (list, startRank = 1) => list.map((p, i) => `
    <div class="leaderboard-row">
      <span class="leaderboard-rank">${startRank + i}</span>
      <a href="player-profile.html?name=${encodeURIComponent(p.name)}" class="player-link leaderboard-name">
        ${p.name}
      </a>
      <span class="leaderboard-value ${key === "owed" ? "leaderboard-value-overdue" : ""}">
        ${formatter(p[key])}
      </span>
    </div>
  `).join("");

  return `
    <article class="leaderboard-card leaderboard-${key}">
      <h3>
        ${title}
        ${key === "owed" ? `<button class="leaderboard-info-btn" type="button" aria-label="Payment details">i</button>` : ""}
      </h3>

      <div class="leaderboard-list">
        ${topFive.length ? makeRows(topFive, 1) : `<div class="leaderboard-empty">No data yet</div>`}
      </div>

      ${rest.length ? `
        <div class="leaderboard-extra" style="display:none;">
          ${makeRows(rest, 6)}
        </div>

        <button class="leaderboard-toggle" type="button" aria-label="Show more">
          ▽
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
    const [finesRows, banksRows, trafRows] = await Promise.all([
      fetchCsvRows(HOME_CSVS.fines26),
      fetchCsvRows(HOME_CSVS.banksStats),
      fetchCsvRows(HOME_CSVS.trafStats)
    ]);

    const playersMap = {};

    readStatRows(banksRows, playersMap);
    readStatRows(trafRows, playersMap);
    readFinesRows(finesRows, playersMap);
    await fetchHighestCheckouts(playersMap);

    const players = Object.values(playersMap);

    grid.innerHTML = `
      ${makeLeaderboardCard({
      title: "Season checkouts",
      rows: players,
      key: "checkouts",
      formatter: v => Number(v)
    })}

    ${makeLeaderboardCard({
      title: "Appearances",
      rows: players,
      key: "appearances",
      formatter: v => Number(v)
    })}

      ${makeLeaderboardCard({
      title: "Season 180s",
      rows: players,
      key: "oneEightys",
      formatter: v => Number(v)
    })}

      ${makeLeaderboardCard({
      title: "Season Bull-outs",
      rows: players,
      key: "bulls",
      formatter: v => Number(v)
    })}

      ${makeLeaderboardCard({
      title: "Season Ton+ outs",
      rows: players,
      key: "tonOuts",
      formatter: v => Number(v)
    })}

      ${makeLeaderboardCard({
      title: "Highest checkout",
      rows: players,
      key: "highestCheckout",
      formatter: v => Number(v)
    })}

      

      ${makeLeaderboardCard({
      title: "Outstanding fines",
      rows: players,
      key: "owed",
      formatter: numberToMoney
    })}
    `;

    document.querySelectorAll(".leaderboard-toggle").forEach(btn => {
      btn.addEventListener("click", async () => {
        const card = btn.closest(".leaderboard-card");
        const extra = card?.querySelector(".leaderboard-extra");
        if (!extra) return;

        btn.disabled = true;

        const isHidden = window.getComputedStyle(extra).display === "none";

        if (isHidden) {
          await animateOpen(extra);
          btn.textContent = "△";
          btn.setAttribute("aria-expanded", "true");
        } else {
          await animateClose(extra);
          btn.textContent = "▽";
          btn.setAttribute("aria-expanded", "false");
        }

        btn.disabled = false;
      });
    });

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
  const infoBtn = e.target.closest(".leaderboard-info-btn");
  const closeBtn = e.target.closest("#closePaymentModal");
  const copyBtn = e.target.closest(".copy-btn");
  const paymentModal = document.getElementById("paymentModal");

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
