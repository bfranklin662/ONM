(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") !== "bot") return;
  const names = ["Billy", "Croft", "Venton", "Istan", "Nick", "Ricky", "Aussie", "Andre", "Bailey", "Filip"];
  const name = names[Number(params.get("level")) - 1];
  const format = params.get("casual")==="1" ? `Casual · BO${Number(params.get("legs"))||1}` : {1:"BO1",3:"BO3",5:"BO5",7:"BO7",9:"Bull or Bust"}[params.get("format")];
  const splash = document.getElementById("monsterBotSplash");
  document.body.classList.add("monsterBotLoading");
  document.getElementById("monsterBotLoadingText").textContent = name && format ? `Loading ${name} Bot · ${format}` : "Loading Monster Bot…";
  splash.hidden = false;
})();
