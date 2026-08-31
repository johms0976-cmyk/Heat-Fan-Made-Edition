/* soundtrack controller */
(function(){
  const opening = document.getElementById("heatOpening");
  const race    = document.getElementById("heatRace");
  const win      = document.getElementById("heatWin");
  const crash   = document.getElementById("heatCrash");
  if(!opening) return;

  /* target volumes for each track */
  const VOL = { opening:0.7, race:0.6, win:0.85, crash:0.9 };
  opening.volume = VOL.opening;
  race.volume    = 0;            // starts silent, faded up when the race begins
  win.volume     = VOL.win;
  crash.volume   = VOL.crash;

  let phase = "opening";         // opening → race → win

  /* Smooth volume fade driven by the animation clock. Using elapsed time (not a
     fixed step count) keeps the fade correct even if the main thread is briefly
     busy right after a fade starts — e.g. "Start your engines" kicks off the race
     build immediately, and a time-based fade just resumes at the right volume
     instead of stalling or jumping. Ease-in-out makes it feel natural. */
  function fade(el, to, ms, done){
    if(el._fadeRAF){ cancelAnimationFrame(el._fadeRAF); el._fadeRAF=null; }
    if(el._fadeTimer){ clearInterval(el._fadeTimer); el._fadeTimer=null; }
    to = Math.max(0, Math.min(1, to));
    if(ms<=0){ el.volume = to; if(done) done(); return; }
    const from = el.volume, t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0)/ms);
      const e = k<0.5 ? 2*k*k : 1-Math.pow(-2*k+2,2)/2;   // easeInOutQuad
      el.volume = Math.max(0, Math.min(1, from + (to-from)*e));
      if(k<1){ el._fadeRAF = requestAnimationFrame(tick); }
      else   { el._fadeRAF = null; if(done) done(); }
    };
    el._fadeRAF = requestAnimationFrame(tick);
  }

  /* Single-page build: the attract track lives here and is never torn down,
     so it plays continuously from the loading screen through to the race.
     No cross-page hand-off needed. */
  const tryPlay = () => (phase==="opening") ? opening.play() : Promise.resolve();
  tryPlay().catch(()=>{});

  /* Browsers may block autoplay until a gesture — if so, the first tap,
     touch or key anywhere on the selection screen resumes the music. */
  const unlockEvents = ["pointerdown","touchstart","keydown","click"];
  const unlock = () => { tryPlay().catch(()=>{}); unlockEvents.forEach(ev => document.removeEventListener(ev, unlock, true)); };
  unlockEvents.forEach(ev => document.addEventListener(ev, unlock, true));

  const HeatAudio = {
    /* race start: slow crossfade the attract music out and the race loop in.
       Longer, overlapping fades so the hand-off is gentle rather than a hard cut. */
    toRace(){
      if(phase !== "opening") return;   // idempotent
      phase = "race";
      try{ sessionStorage.removeItem("heat_openingTime"); }catch(e){}
      fade(opening, 0, 5800, () => opening.pause());   // opening.mp3 slowly fades out
      race.volume = 0;
      race.play().catch(()=>{});
      fade(race, VOL.race, 6000);                      // race.mp3 slowly fades in
    },
    /* race over: stop the race loop and play the win sting once */
    win(){
      if(phase === "win") return;       // don't restack on repeat calls
      phase = "win";
      fade(opening, 0, 300, () => opening.pause());
      fade(race, 0, 600, () => { race.pause(); try{ race.currentTime = 0; }catch(e){} });
      try{ win.currentTime = 0; }catch(e){}
      win.volume = VOL.win;
      win.play().catch(()=>{});
    },
    /* restart: force the race loop from any phase (used by "Restart race") */
    race(){
      phase = "race";
      try{ win.pause(); win.currentTime = 0; }catch(e){}
      fade(opening, 0, 250, () => opening.pause());
      if(race.paused){ try{ race.currentTime = 0; }catch(e){} race.volume = 0; race.play().catch(()=>{}); }
      fade(race, VOL.race, 500);
    },
    /* back to the attract track (used by "New game" → setup screen) */
    toOpening(){
      phase = "opening";
      try{ win.pause(); win.currentTime = 0; }catch(e){}
      fade(race, 0, 300, () => race.pause());
      if(opening.paused){ opening.volume = 0; opening.play().catch(()=>{}); }
      fade(opening, VOL.opening, 500);
    },
    /* one-shot crash sting layered over whatever is playing (race keeps looping) */
    crash(){
      try{ crash.currentTime = 0; }catch(e){}
      crash.volume = VOL.crash;
      crash.play().catch(()=>{});
    }
  };
  window.HeatAudio = HeatAudio;
  /* helpers used by the loading/title overlay in this same page */
  HeatAudio.opening = opening;
  HeatAudio.ensureOpening = tryPlay;                       // returns the play() promise
  HeatAudio.isOpeningPlaying = () => !opening.paused && phase === "opening";

  /* Lights out — hand the soundtrack over to the race loop. These are the
     buttons that actually launch a race: the single-race summary, the
     championship summary and the pass & play sheet. (The rules sheet's
     "Pick your car" button no longer starts anything, so it must NOT switch
     the music.) Capture phase so this runs before the button's own handler —
     the click itself is the gesture that unlocks race playback. */
  const RACE_GO = "#sumGo, #csGo, #hsstart";
  document.addEventListener("click", (e) => {
    if(e.target.closest && e.target.closest(RACE_GO)) HeatAudio.race();
  }, true);

  /* spin-out image modal: show the art, play the crash, wait for the player */
  window.showSpinOut = function(sub){
    const m = document.getElementById("spinModal");
    if(sub){ const s = document.getElementById("spinSub"); if(s) s.textContent = sub; }
    if(m) m.style.display = "flex";
    HeatAudio.crash();
  };
  const closeBtn = document.getElementById("spinClose");
  if(closeBtn) closeBtn.onclick = () => {
    const m = document.getElementById("spinModal");
    if(m) m.style.display = "none";
  };
})();
