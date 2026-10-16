(function () {
  "use strict";
  let fixtures = [];
  let loaded = false;
  let loading = false;
  let saving = false;
  const list = document.getElementById("accountAvailabilityList");
  const message = document.getElementById("availabilityMessage");
  const refresh = document.getElementById("refreshAvailability");
  const choices = ["Available", "Unavailable", "Not sure"];
  const tabs = [document.getElementById("accountDetailsTab"), document.getElementById("accountFixturesTab")];
  const escape = value => String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));

  function render() {
    const available = fixtures.filter(fixture => fixture.status === "Available").length;
    document.getElementById("availabilitySummary").textContent = `You're available for ${available} of ${fixtures.length} upcoming fixtures.`;
    list.innerHTML = fixtures.map(fixture => {
      const date = new Date(`${fixture.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
      return `<article class="accountAvailabilityFixture">
        <div><span class="accountEyebrow">${escape(fixture.league)}</span><h3>${escape(fixture.opponent)} (${escape(fixture.side)})</h3><p>${escape(date)} · ${escape(fixture.time)}<br>${escape(fixture.venue)}</p></div>
        <label>My availability<select data-fixture-id="${escape(fixture.id)}"${!fixture.editable || saving ? " disabled" : ""} aria-label="Availability against ${escape(fixture.opponent)} on ${escape(date)}">
          <option value=""${fixture.status === "" ? " selected" : ""}>Not answered</option>
          ${choices.map(choice => `<option${fixture.status === choice ? " selected" : ""}>${choice}</option>`).join("")}
        </select>${!fixture.editable ? '<small>Duplicate fixture in the sheet—please ask an administrator to check.</small>' : ""}</label>
      </article>`;
    }).join("") || '<p>No upcoming fixtures are listed in the availability sheet.</p>';
  }

  async function load() {
    if (loading || saving) return;
    loading = true;
    refresh.disabled = true;
    list.querySelectorAll("select").forEach(select => { select.disabled = true; });
    message.textContent = "Loading availability from the sheet…";
    try {
      const data = await window.ONMFirebase.availability("getPlayerAvailability");
      fixtures = data.fixtures;
      loaded = true;
      render();
      message.textContent = "Up to date with the availability sheet.";
    } catch (error) {
      message.textContent = error.code === "functions/failed-precondition" || error.code === "functions/permission-denied"
        ? error.message : "Availability is temporarily unavailable here. You can still use the sheet directly.";
      // Keep old responses disabled after a failed refresh rather than saving stale values.
    } finally {
      loading = false;
      refresh.disabled = false;
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      tabs.forEach((item, itemIndex) => {
        item.classList.toggle("active", itemIndex === index);
        item.setAttribute("aria-selected", String(itemIndex === index));
        item.tabIndex = itemIndex === index ? 0 : -1;
      });
      document.getElementById("accountDetailsPanel").classList.toggle("hidden", index !== 0);
      document.getElementById("accountFixturesPanel").classList.toggle("hidden", index !== 1);
      if (index === 1 && !loaded) load();
    });
    tab.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
      tabs[next].focus();
      tabs[next].click();
    });
  });
  refresh.addEventListener("click", load);
  list.addEventListener("change", async event => {
    const select = event.target.closest("select[data-fixture-id]");
    if (!select || saving || loading) return;
    const fixture = fixtures.find(item => item.id === select.dataset.fixtureId);
    if (!fixture) return;
    const status = select.value;
    saving = true;
    refresh.disabled = true;
    list.querySelectorAll("select").forEach(input => { input.disabled = true; });
    message.textContent = "Saving your response to the sheet…";
    try {
      const result = await window.ONMFirebase.availability("setPlayerAvailability", { fixtureId: fixture.id, status, previousStatus: fixture.status });
      fixture.status = result.status;
      message.textContent = "Saved to the availability sheet.";
    } catch (error) {
      message.textContent = error.code === "functions/aborted" ? error.message : "Could not confirm the save. Refresh to check the sheet before trying again.";
      loaded = false;
    } finally {
      saving = false;
      refresh.disabled = false;
      render();
      if (!loaded) list.querySelectorAll("select").forEach(input => { input.disabled = true; });
    }
  });
})();
