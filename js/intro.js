/* ================= INTRO: loading animation + title, single-page ==================
   Lives in the same document as the game, so the attract track (owned by
   HeatAudio) is never torn down — it plays continuously from here into the
   race. "Start Game" just lifts the title overlay; nothing navigates. */
(function(){
  const stage    = document.getElementById("stage");
  const loader   = document.getElementById("loader");
  const loadFill = document.getElementById("loadFill");
  const loadStatus = document.getElementById("loadStatus");
  const loadSound  = document.getElementById("loadSound");
  const soundNote  = document.getElementById("soundNote");
  const lamps    = loader ? [...loader.querySelectorAll(".lamp")] : [];

  /* ---- music: reuse the persistent track owned by HeatAudio ---- */
  let musicOn = false;
  function showBlockedPrompt(){
    const loaderUp = loader && loader.style.display !== "none" && !loader.classList.contains("done");
    if(loaderUp){ if(loadSound) loadSound.style.display = "block"; }
    else if(soundNote){ soundNote.classList.add("show"); }
  }
  function hidePrompts(){
    if(loadSound) loadSound.style.display = "none";
    if(soundNote) soundNote.classList.remove("show");
  }
  function startMusic(){
    if(musicOn || !window.HeatAudio) return;
    window.HeatAudio.ensureOpening()
      .then(() => { musicOn = true; hidePrompts(); removeUnlock(); })
      .catch(() => showBlockedPrompt());
  }
  function onUnlock(){ startMusic(); }
  function removeUnlock(){ ["pointerdown","touchstart","keydown"].forEach(ev => window.removeEventListener(ev, onUnlock, true)); }
  ["pointerdown","touchstart","keydown"].forEach(ev => window.addEventListener(ev, onUnlock, true));
  if(soundNote) soundNote.addEventListener("click", startMusic);
  startMusic();   // try immediately (returning visitors / relaxed autoplay policy)

  /* ---- loading screen ---- */
  const t0 = performance.now();
  const MIN_MS = 1500, MAX_MS = 9000;
  let bgLoaded = false, progress = 0, done = false;
  const bg = new Image();
  bg.onload = bg.onerror = () => { bgLoaded = true; };
  bg.src = "screens/background.png";

  /* ---- loader artwork: backdrop + skull grid lights ----------------------
     Everything here is opt-in. The stylesheet ships the original round lamps
     and the text wordmark as the baseline; we only upgrade to the artwork once
     each file is proven to load, so a missing asset degrades silently instead
     of leaving a blank screen or a red square.

     Three outcomes for the skull:
       body.skulls        PNG loaded, has real transparency, mask supported
                          → masked silhouette, colour + glow driven by CSS
       body.skulls-solid  PNG loaded but is opaque (or no mask support)
                          → draw the art and tint it with filters
       (neither)          PNG missing → the original round lights stay
     Either skull path is purely cosmetic: renderLoad() still just toggles
     .on, so the lighting sequence is untouched. */
  (function loaderArt(){
    /* "auto" picks a skull mode by probing the file. Force it here if you'd
       rather not rely on the probe: "mask" | "solid" | "off" (round lamps). */
    const SKULL_MODE = "auto";

    const loaderEl = document.getElementById("loader");

    // 1. backdrop
    const art = new Image();
    art.onload  = () => { if(loaderEl) loaderEl.classList.add("art"); };
    art.src = "assets/loading.png";

    // 2. wordmark — warm the cache; the <img> onerror handles the miss
    const word = new Image();
    word.src = "assets/titlename.png";

    // 3. skulls
    if(SKULL_MODE === "off") return;

    const maskOK = window.CSS && CSS.supports &&
      (CSS.supports("mask-image", "url(x.png)") || CSS.supports("-webkit-mask-image", "url(x.png)"));

    const skull = new Image();
    skull.onerror = () => {};                       // file missing → round lamps
    skull.onload = () => {
      if(SKULL_MODE === "mask" || SKULL_MODE === "solid"){
        document.body.classList.add(SKULL_MODE === "mask" ? "skulls" : "skulls-solid");
        return;
      }
      if(!maskOK){ document.body.classList.add("skulls-solid"); return; }
      let transparent = false;
      try{
        // Sample the alpha channel: a cut-out skull has see-through corners.
        const c = document.createElement("canvas");
        const w = c.width  = Math.min(skull.naturalWidth  || 64, 64);
        const h = c.height = Math.min(skull.naturalHeight || 64, 64);
        const ctx = c.getContext("2d", { willReadFrequently:true });
        ctx.drawImage(skull, 0, 0, w, h);
        const px = ctx.getImageData(0, 0, w, h).data;
        let clear = 0;
        for(let i = 3; i < px.length; i += 4) if(px[i] < 16) clear++;
        transparent = clear > (px.length / 4) * 0.08;   // ≥8% fully see-through
      }catch(e){
        /* Canvas is tainted — happens when the page is opened straight off
           file:// rather than served. We can't read the alpha, so take the mode
           that looks right either way: "solid" draws the art itself, and its
           drop-shadow still respects transparency if the PNG has any. Serve the
           page over http (or set SKULL_MODE="mask") to get the masked version. */
        return void document.body.classList.add("skulls-solid");
      }
      document.body.classList.add(transparent ? "skulls" : "skulls-solid");
    };
    skull.src = "assets/loading/skull1.png";
  })();

  /* The car-select art is fetched here too, so by the time the player reaches
     the garage carousel every PNG is already decoded and in cache — no emoji
     fallback flashing past. MAX_MS still caps the wait. */
  let artLoaded = false;
  if(typeof preloadDeckArt === "function") preloadDeckArt().then(()=>{ artLoaded = true; });
  else artLoaded = true;

  function renderLoad(p){
    if(loadFill) loadFill.style.width = (p*100).toFixed(1) + "%";
    lamps.forEach((l,i) => l.classList.toggle("on", p >= (i+1)/5 - 0.001));
    if(loadStatus) loadStatus.textContent =
      p<0.2 ? "Warming up the engine…" : p<0.4 ? "Priming the Heat pump…" :
      p<0.6 ? "Checking tyre pressures…" : p<0.8 ? "Rolling onto the grid…" :
      p<1   ? "Formation lap…" : "Lights out!";
  }
  function loadFrame(now){
    const elapsed = now - t0;
    const ready = (bgLoaded && artLoaded && elapsed >= MIN_MS) || elapsed >= MAX_MS;
    const target = ready ? 1 : 0.9;
    progress += (target - progress) * 0.06;
    if(target === 1 && progress > 0.995) progress = 1;
    renderLoad(progress);
    if(progress >= 1){ finishLoad(); return; }
    requestAnimationFrame(loadFrame);
  }
  function finishLoad(){
    if(done) return; done = true;
    renderLoad(1);
    setTimeout(() => {
      lamps.forEach(l => l.classList.remove("on"));
      if(loadStatus) loadStatus.textContent = "Go!";
      setTimeout(() => {
        if(loader){ loader.classList.add("done"); setTimeout(() => { loader.style.display = "none"; }, 650); }
        startMusic();   // retry now the title is showing
      }, 260);
    }, 500);
  }
  requestAnimationFrame(loadFrame);

  /* ---- title → game: lift the overlay, no navigation ----
     Fire on "click" (not pointerdown) so the whole tap — down, up and the
     browser's synthetic click — resolves on the overlay itself. Dismissing on
     pointerdown removed the overlay mid-tap, so the trailing click landed on
     whatever setup button happened to sit underneath. A short capture-phase
     guard also swallows any stray ghost click some mobile browsers still
     dispatch just after the overlay is gone. */
  let launched = false;
  function swallowNextClicks(ms){
    const block = (e) => { e.stopPropagation(); e.preventDefault(); };
    document.addEventListener("click", block, true);
    setTimeout(() => document.removeEventListener("click", block, true), ms);
  }
  function beginGame(){
    if(launched) return; launched = true;
    startMusic();                                  // the tap guarantees sound
    if(stage) stage.classList.add("hide");
    swallowNextClicks(400);
    setTimeout(() => { if(stage) stage.style.display = "none"; }, 750);
  }
  if(stage){
    stage.addEventListener("click", beginGame);
    stage.addEventListener("keydown", (e) => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); beginGame(); } });
  }
})();
