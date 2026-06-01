window.PlayerSeasonVote = {
  init,
  open
};

let playerSeasonVoteData = null;
let playerSeasonVoteInitialised = false;

async function init() {
  if (playerSeasonVoteInitialised) return;
  if (isInsideActiveMatch()) return;

  const user = window.ONMSession?.getUser?.() || window.loggedInUser;
  if (!user?.userId) return;

  playerSeasonVoteInitialised = true;

  try {
    const result = await postDartMatch({
      action: "getPlayerSeasonVoteData",
      userId: user.userId
    });

    if (!result.success || !result.shouldShow) return;

    playerSeasonVoteData = result;
    renderVoteModal(result);
    bindVoteEvents();

    if (localStorage.getItem(`psoVoteDismissed_${user.userId}`) === "true") {
      showLauncher();
    } else {
      open();
    }
  } catch (err) {
    console.warn("Could not load player season vote:", err);
  }
}

function open() {
  if (isInsideActiveMatch()) return;

  document.getElementById("playerSeasonVoteOverlay")?.classList.remove("hidden");
  document.getElementById("playerSeasonVoteLauncher")?.classList.add("hidden");
}

function close() {
  const user = window.ONMSession?.getUser?.() || window.loggedInUser;

  document.getElementById("playerSeasonVoteOverlay")?.classList.add("hidden");

  if (user?.userId) {
    localStorage.setItem(`psoVoteDismissed_${user.userId}`, "true");
  }

  showLauncher();
}

function showLauncher() {
  if (isInsideActiveMatch()) return;
  document.getElementById("playerSeasonVoteLauncher")?.classList.remove("hidden");
}

function hideEverything() {
  document.getElementById("playerSeasonVoteOverlay")?.classList.add("hidden");
  document.getElementById("playerSeasonVoteLauncher")?.classList.add("hidden");
}

function renderVoteModal(data) {
  const select = document.getElementById("playerSeasonVoteSelect");
  const table = document.getElementById("playerSeasonVoteStatsTable");

  if (!select || !table) return;

  const players = data.players || [];

  select.innerHTML = `
    <option value="">Select a player...</option>
    ${players.map(player => `
      <option value="${escapeHtml(player.Player)}">${escapeHtml(player.Player)}</option>
    `).join("")}
  `;

  renderStatsTable(players.slice(0, 10));
}

function renderStatsTable(players) {
  const table = document.getElementById("playerSeasonVoteStatsTable");
  if (!table) return;

  const headers = [
    "Player",
    "Played",
    "Checkouts",
    "Checkouts/game",
    "Fines",
    "Fines/game",
    "Double Fines",
    "180s",
    "Bull-outs",
    "Ton+ Outs"
  ];

  table.innerHTML = `
    <thead>
      <tr>
        ${headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${players.map(player => `
              <tr>
                ${headers.map(header => {
    let value = player[header] ?? "";

    if (
      header === "Checkouts/game" ||
      header === "Fines" ||
      header === "Fines/game"
    ) {
      const num = Number(value);

      if (!isNaN(num)) {
        if (header === "Fines" || header === "Fines/game") {
          value = `£${num.toFixed(2)}`;
        } else {
          value = num.toFixed(2);
        }
      }
    }

    return `<td>${escapeHtml(value)}</td>`;
  }).join("")}
        </tr>
      `).join("")}
    </tbody>
  `;
}

function bindVoteEvents() {
  document.getElementById("closePlayerSeasonVoteBtn")?.addEventListener("click", close);
  document.getElementById("playerSeasonVoteLauncher")?.addEventListener("click", open);

  document.getElementById("expandPlayerSeasonStatsBtn")?.addEventListener("click", event => {
    const players = playerSeasonVoteData?.players || [];
    const expanded = event.currentTarget.dataset.expanded === "true";

    if (expanded) {
      renderStatsTable(players.slice(0, 10));
      event.currentTarget.textContent = "Show all players";
      event.currentTarget.dataset.expanded = "false";
    } else {
      renderStatsTable(players);
      event.currentTarget.textContent = "Show top 10";
      event.currentTarget.dataset.expanded = "true";
    }
  });

  document.getElementById("submitPlayerSeasonVoteBtn")?.addEventListener("click", submitVote);
}

async function submitVote() {
  const user = window.ONMSession?.getUser?.() || window.loggedInUser;
  const select = document.getElementById("playerSeasonVoteSelect");
  const button = document.getElementById("submitPlayerSeasonVoteBtn");

  const vote = select?.value || "";

  if (!user?.userId || !vote) {
    alert("Please select a player.");
    return;
  }

  button.disabled = true;
  button.textContent = "Submitting...";

  try {
    const result = await postDartMatch({
      action: "submitPlayerSeasonVote",
      userId: user.userId,
      vote
    });

    if (!result.success) {
      alert(result.error || "Could not submit vote.");
      button.disabled = false;
      button.textContent = "Submit Vote";
      return;
    }

    localStorage.removeItem(`psoVoteDismissed_${user.userId}`);

    button.textContent = "Vote submitted ✓";

    setTimeout(() => {
      alert("Thanks — your Players' Player of the Season vote has been submitted.");
      hideEverything();
    }, 300);
  } catch (err) {
    console.warn("Could not submit vote:", err);
    alert("Could not submit vote. Please try again.");
    button.disabled = false;
    button.textContent = "Submit Vote";
  }
}

function isInsideActiveMatch() {
  const scorerVisible =
    document.querySelector(".scorerCard") &&
    !document.querySelector(".scorerCard").classList.contains("hidden");

  const readyLobbyVisible =
    document.getElementById("competitiveReadyOverlay") &&
    !document.getElementById("competitiveReadyOverlay").classList.contains("hidden");

  return Boolean(
    scorerVisible ||
    readyLobbyVisible ||
    window.onlineMatchId ||
    window.currentOnlineMatch
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}