document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll("[data-merch-scroll]").forEach(button=>button.addEventListener("click",()=>{
    const rail=document.getElementById(button.getAttribute("aria-controls"));if(!rail)return;
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollBy({left:Number(button.dataset.merchScroll)*(rail.clientWidth+12),behavior:reduced?"instant":"smooth"});
  }));
});
