/* =====================================================================
   TRACK · Deutchland   (key: "germany")
   Self-registering circuit. Loaded by index.html AFTER js/track-registry.js.
   Edit this file alone to change the board — nothing else needs touching.
   To add a new circuit: drop a new file in tracks/ and add one <script>
   line to index.html in the TRACKS block.
   ===================================================================== */
    /* ===== Deutchland — built with the HEAT track builder =====
   Paste this whole block into index_20.html at the very END of the file,
   on the line just above the last closing script tag. Nothing else to change:
   it registers itself in TRACKS and adds its own card to the track picker. */
const TRACK_GERMANY = defineTrack({
  key:"germany",
  brief:"test.",
  name:"Deutchland", spaces:62, defaultLaps:2, heat:5, stress:3,
  image:"tracks/germany.JPG", imgW:1200, imgH:800,
  eyebrow:"German Grand Prix",
  subtitle:"Rocky Road Expansion",
  tagline:"",
  terrain:"oval",
  plate:{ x:-95, y:920, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"MY CIRCUIT",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:250,y:1259}, podium:{x:102,y:482},
  weatherTok:{x:302,y:541,r:38},

  /* Corners — `at` is the space the corner line sits BEFORE, `limit` the speed you
     must be at or under crossing it. `chicane:n` groups consecutive corner lines
     into a chicane: same speed limit, blue kerbs, and ONE Road Condition token for
     the whole thing — a corner token modifies every line in it, a sector token
     modifies the sector AFTER it. Each line is still checked separately. */
  corners:[ {at:11, limit:5, bx:162, by:178}, {at:23, limit:2, chicane:1, bx:642, by:195}, {at:24, limit:2, chicane:1, bx:739, by:67}, {at:37, limit:6, bx:1117, by:700}, {at:45, limit:4, bx:603, by:712}, {at:52, limit:4, bx:929, by:553} ],

  /* Gravel — space indices whose inner (Race Line) Spot and/or outer Spot is gravel.
     A space in both lists has gravel right across it. Rule: at the end of your turn
     (step 9), if your car is on a gravel Spot you must pay 1 Heat if you have any in
     the Engine; if the Engine is empty, ignore it. */
  gravel:{ inner:[], outer:[] },

  /* Tunnels — inclusive runs of Spaces (from > to means the run wraps past space 0).
     Rule: while a car is on a tunnel Space its player cannot discard from hand, and
     this beats any Event / Upgrade / Road Condition that would otherwise let them.
     Cooldown (card goes to the Engine) and Scrap (card comes off the top of the
     draw deck) are not discards, so both are still allowed inside a tunnel. */
  tunnels:[  ],

  legendsLine:7,
  spacePts:[[549,380],[507,383],[443,386],[410,383],[347,380],[298,371],[247,353],[196,323],[160,299],[115,248],[87,205],[99,127],[127,85],[190,55],[241,52],[298,52],[347,58],[398,67],[446,73],[482,82],[540,94],[591,112],[636,127],[690,133],[754,142],[793,172],[832,202],[871,232],[911,266],[947,296],[986,344],[1013,380],[1037,431],[1058,474],[1079,525],[1091,570],[1091,643],[1052,697],[983,718],[932,718],[892,724],[844,730],[790,733],[745,733],[669,715],[648,658],[678,591],[754,582],[802,591],[847,612],[898,630],[977,609],[1004,552],[986,495],[947,450],[892,422],[853,401],[802,380],[751,374],[703,368],[657,371],[597,374]]
});
