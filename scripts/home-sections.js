(() => {
  const menu = document.querySelector(".homeSectionMenu");
  if (!menu) return;
  const links = [...menu.querySelectorAll('a[href^="#"]')];
  const sections = links.map(link => document.getElementById(link.hash.slice(1)));
  let scheduled = false;
  function update() {
    scheduled = false;
    const threshold = menu.getBoundingClientRect().bottom + 24;
    let active = 0;
    sections.forEach((section,index) => {
      if (section && section.getBoundingClientRect().top <= threshold) active = index;
    });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) active = links.length - 1;
    links.forEach((link,index) => {
      if (index === active) link.setAttribute("aria-current","location");
      else link.removeAttribute("aria-current");
    });
  }
  menu.addEventListener("click", event => {
    const link = event.target.closest("a");
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const section = document.getElementById(link.hash.slice(1));
    if (!section) return;
    event.preventDefault();
    history.replaceState(null,"",link.hash);
    section.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",block:"start"});
  });
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } };
  window.addEventListener("scroll",schedule,{passive:true});
  window.addEventListener("resize",schedule);
  window.addEventListener("load",schedule,{once:true});
  update();
})();
