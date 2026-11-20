(function () {
  const container = document.getElementById("adminAccolades");
  if (!container) return;
  const awards = {
    guthrie_cup_winner_25_26: "Guthrie Cup winner · 2025/26",
    banks_winner_24_25: "Banks Div 2 winner · 2024/25",
    alex_beckett_winner_25: "Alex Beckett winner · 2024/25",
    mpl_winner_25: "Monsters Premier League winner · 2025"
  };
  const escape = value => String(value || "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const normalise = value => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  let players = [], busy = false;
  container.innerHTML = `<details><summary>Award player accolades</summary><p>Choose an award and players. Existing accolades are kept.</p><label>Accolade<select id="adminAccoladeChoice">${Object.entries(awards).map(([key,label])=>`<option value="${key}">${label}</option>`).join("")}<option value="custom">New custom accolade…</option></select></label><label id="customAwardLabel" hidden>New accolade title<input id="customAwardTitle" maxlength="100" placeholder="For example: Club player of the year 2026"></label><div class="adminFormActions"><button class="btn btnGhost" id="loadAwardPlayers" type="button">Choose players</button><button class="btn btnGhost" id="findGuthriePlayers" type="button">Select 2025/26 Banks Cup players</button></div><div id="awardPlayerChoices" class="adminAwardChoices"></div><button class="btn btnPrimary" id="savePlayerAwards" type="button" hidden>Award selected players</button><p id="awardPlayerStatus" role="status" aria-live="polite"></p></details>`;
  document.getElementById("adminAccoladeChoice").addEventListener("change", event => { document.getElementById("customAwardLabel").hidden = event.target.value !== "custom"; });
  const status = text => { document.getElementById("awardPlayerStatus").textContent = text; };
  function setBusy(value) { busy = value; container.querySelectorAll("button,input,select").forEach(control=>{control.disabled=value;}); }
  async function loadPlayers() {
    const account = await window.ONMFirebase.loadOwnUser();
    if (account?.status !== "Active" || !["owner","admin"].includes(account.role)) throw Error("Administrator access required.");
    const {db,firestoreSdk:sdk} = await window.ONMFirebase.ready;
    const [privatePlayers,publicPlayers] = await Promise.all([sdk.getDocs(sdk.collection(db,"players")),sdk.getDocs(sdk.collection(db,"publicPlayers"))]);
    const roster = new Map();
    for (const doc of [...publicPlayers.docs,...privatePlayers.docs]) roster.set(doc.id,{...roster.get(doc.id),...doc.data(),playerKey:doc.id});
    players = [...roster.values()].filter(player=>player.publicName).sort((a,b)=>a.publicName.localeCompare(b.publicName));
    document.getElementById("awardPlayerChoices").innerHTML = players.map((player,index)=>`<label><input type="checkbox" data-award-index="${index}"><span>${escape(player.fullName || player.publicName)}${player.fullName && player.fullName!==player.publicName ? ` (${escape(player.publicName)})` : ""}</span></label>`).join("");
    document.getElementById("savePlayerAwards").hidden = false;
    return {db,sdk};
  }
  document.getElementById("loadAwardPlayers").addEventListener("click",async()=>{
    if(busy)return;setBusy(true);
    try{await loadPlayers();status("Select the players to receive this accolade.");}catch(error){status(error.message);}finally{setBusy(false);}
  });
  document.getElementById("findGuthriePlayers").addEventListener("click",async()=>{
    if(busy)return;setBusy(true);status("Checking last season's submitted Banks Cup lineups…");
    try {
      const {db,sdk}=await loadPlayers();
      const results=await sdk.getDocs(sdk.collection(db,"results"));
      const names=new Set();let matches=0;
      for(const doc of results.docs){const item=doc.data(),row=item.sheetRow||item;if(item.season!=="25-26" || !/banks/i.test(row.Competition||"") || !window.ONMLeagueDivisions.isCup(row))continue;matches++;for(let i=1;i<=12;i++){const name=normalise(row[`Player${i}`]||row[`Player ${i}`]);if(name)names.add(name);}}
      const matched=new Set();let selected=0;
      container.querySelectorAll("[data-award-index]").forEach(box=>{const player=players[Number(box.dataset.awardIndex)];const aliases=[player.publicName,player.fullName,...(player.aliases||[])].map(normalise);box.checked=aliases.some(name=>names.has(name));if(box.checked){selected++;aliases.forEach(name=>{if(names.has(name))matched.add(name);});}});
      document.getElementById("adminAccoladeChoice").value="guthrie_cup_winner_25_26";
      const missing=[...names].filter(name=>!matched.has(name));
      status(`${selected} players selected from ${matches} Banks Cup matches. Review the list, then award them.${missing.length ? ` Could not match: ${missing.join(", ")}.` : ""}`);
    }catch(error){status(error.message);}finally{setBusy(false);}
  });
  document.getElementById("savePlayerAwards").addEventListener("click",async()=>{
    if(busy)return;
    const selected=[...container.querySelectorAll("[data-award-index]:checked")].map(box=>players[Number(box.dataset.awardIndex)]);
    let key=document.getElementById("adminAccoladeChoice").value;
    const customTitle=document.getElementById("customAwardTitle").value.trim();
    const awardLabel=key==="custom" ? customTitle : awards[key];
    if(key==="custom" && customTitle) key="custom:"+encodeURIComponent(customTitle);
    if(!selected.length || !awardLabel){status("Choose an accolade and at least one player.");return;}
    setBusy(true);let saved=0;
    try{
      const account=await window.ONMFirebase.loadOwnUser();
      if(account?.status!=="Active"||!["admin","owner"].includes(account.role))throw Error("Administrator access required.");
      const {db,firestoreSdk:sdk}=await window.ONMFirebase.ready;
      for(const player of selected){status(`Awarding ${saved+1} of ${selected.length}…`);await sdk.runTransaction(db,async transaction=>{
        const privateRef=sdk.doc(db,"players",player.playerKey),publicRef=sdk.doc(db,"publicPlayers",player.playerKey);
        const [privateDoc,publicDoc]=await Promise.all([transaction.get(privateRef),transaction.get(publicRef)]);
        const accolades=[...new Set([...(privateDoc.data()?.accolades||[]),...(publicDoc.data()?.accolades||[]),key])];
        transaction.set(privateRef,{accolades},{merge:true});transaction.set(publicRef,{accolades},{merge:true});
      });saved++;}
      status(`✓ ${awardLabel} awarded to ${saved} ${saved===1?"player":"players"}. Their cards and profiles will show it after refresh.`);
    }catch(error){status(`${saved} players saved. ${error.message} You can retry without duplicating awards.`);}finally{setBusy(false);}
  });
})();
