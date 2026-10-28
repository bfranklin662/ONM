function toggleSidebar(){
  const sidebar=document.getElementById("sidebar"),button=document.querySelector(".hamburger");
  sidebar.classList.toggle("active");button.setAttribute("aria-expanded",String(sidebar.classList.contains("active")));
}
document.querySelectorAll("#sidebar a").forEach(link=>link.addEventListener("click",()=>{document.getElementById("sidebar").classList.remove("active");document.querySelector(".hamburger").setAttribute("aria-expanded","false");}));
