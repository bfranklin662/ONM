document.addEventListener("DOMContentLoaded", () => {
  const tabs = [...document.querySelectorAll("[data-merch-tab]")];
  const panels = [...document.querySelectorAll("[data-merch-panel]")];

  function showMerchPanel(name, { focus = false } = {}) {
    tabs.forEach(tab => {
      const selected = tab.dataset.merchTab === name;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });

    panels.forEach(panel => {
      panel.hidden = panel.dataset.merchPanel !== name;
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showMerchPanel(tab.dataset.merchTab));
    tab.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const next = tabs[(index + direction + tabs.length) % tabs.length];
      showMerchPanel(next.dataset.merchTab, { focus: true });
    });
  });

  showMerchPanel("shirt");
});
