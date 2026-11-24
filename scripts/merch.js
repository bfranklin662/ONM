document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-merch-scroll]").forEach(button => {
    button.addEventListener("click", () => {
      const rail = document.getElementById(button.getAttribute("aria-controls"));
      const firstCard = rail?.firstElementChild;
      if (!firstCard) return;
      const step = firstCard.getBoundingClientRect().width + parseFloat(getComputedStyle(rail).columnGap);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rail.scrollBy({
        left: Number(button.dataset.merchScroll) * step,
        behavior: reduced ? "instant" : "smooth"
      });
    });
  });
});
