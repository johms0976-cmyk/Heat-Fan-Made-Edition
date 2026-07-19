/* ===== Spa — built with the REVUP track builder =====
   Paste this whole block into the game file (Heatindex.html) anywhere AFTER
   the defineTrack() helper — the end of the track list is the natural spot.
   Nothing else to change: defineTrack registers it in TRACKS and the picker
   lists every registered circuit automatically. */
const TRACK_MYTRACK = defineTrack({
  key:"mytrack",
  brief:"Insert track description for track selector screen",
  name:"Spa", spaces:94, defaultLaps:2, heat:6, stress:3,
  image:"tracks/Spa.jpg", imgW:1200, imgH:800,
  eyebrow:"Custom Grand Prix · My Circuit",
  subtitle:"Custom build",
  tagline:"Hand-built fan board",
  terrain:"oval",

  /* layout — "loop" is a normal circuit: the last space joins back to space 0 and
     the chequer sits on the join. "open" is point-to-point: space 0 is the START
     line, the last space is the FINISH, and the two ends never join, so the race is
     a single run (defaultLaps 1), tunnels can't wrap and nothing crosses the flag
     and carries on. Drag strips, sprints and hillclimbs use this.
     "leadin" is a one-off run-up joined to a lap: spaces 0 .. lapStart-1 are driven
     ONCE off the start line, then the cars join the circuit at space lapStart and go
     round spaces lapStart .. spaces-1 for defaultLaps laps — the last space joins back
     to lapStart (NOT to space 0).
       startLine  — the first space AFTER the START line: spaces 0..startLine-1 are grid
                    room only, so racing distance starts at startLine (default 0).
       finishLine — the last space BEFORE the flag: the chequer sits on the join just
                    past it, wrapping to lapStart when it is the last space (default
                    spaces-1, which puts the flag back on the junction).
     Total racing distance = (lapStart - startLine) + (defaultLaps - 1) * lapLen
                           + ((finishLine - lapStart) mod lapLen) + 1,  lapLen = spaces - lapStart. */
  layout:"loop",
  plate:{ x:-337, y:348, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"MY CIRCUIT",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:1131,y:61}, podium:{x:877,y:400},
  weatherTok:{x:1129,y:50,r:38},

  /* Corners — `at` is the space the corner line sits BEFORE, `limit` the speed you
     must be at or under crossing it. `chicane:n` groups consecutive corner lines
     into a chicane: same speed limit, blue kerbs, and ONE Road Condition token for
     the whole thing — a corner token modifies every line in it, a sector token
     modifies the sector AFTER it. Each line is still checked separately. */
  corners:[ {at:5, limit:2, bx:12, by:32}, {at:42, limit:2, bx:958, by:741}, {at:55, limit:5, bx:849, by:235}, {at:68, limit:4, bx:829, by:725}, {at:77, limit:5, bx:312, by:725} ],

  /* Gravel — space indices whose inner (Race Line) Spot and/or outer Spot is gravel.
     A space in both lists has gravel right across it. Rule: at the end of your turn
     (step 9), if your car is on a gravel Spot you must pay 1 Heat if you have any in
     the Engine; if the Engine is empty, ignore it. */
  gravel:{ inner:[], outer:[] },

  /* Tunnels — inclusive runs of Spaces (from > to means the run wraps past space 0).
     Rule: while a car is on a tunnel Space its player cannot discard from hand, and
     this beats any Event / Upgrade / Road Condition that would otherwise let them.
     Cooling down (card goes to the Engine) and Scrap (card comes off the top of the
     draw deck) are not discards, so both are still allowed inside a tunnel. */
  tunnels:[  ],

  /* Trackside props — what the first-person cockpit cam (fpview.js) builds
     beside the road. Inclusive space runs (wrapping past 0 on loops); side
     \"out\" = away from the Race Line, \"in\" = the Race Line side; kind is
     one of the TS_KINDS keys (beach, grandstand, pits, buildings, forest…).
     Purely visual — no effect on the rules. Unclaimed spaces keep the
     terrain's usual random scenery. */
  trackside:[ {from:93, to:6, side:"out", kind:"grandstand"}, {from:93, to:10, side:"in", kind:"pits"}, {from:7, to:10, side:"out", kind:"pits"}, {from:11, to:32, side:"out", kind:"forest"}, {from:11, to:41, side:"in", kind:"forest"}, {from:33, to:41, side:"out", kind:"field"}, {from:42, to:54, side:"out", kind:"forest"} ],

  legendsLine:7,
  spacePts:[[190,166],[151,160],[109,160],[48,154],[21,97],[66,61],[127,70],[172,64],[214,61],[259,58],[305,61],[350,61],[398,64],[443,61],[488,58],[534,52],[582,52],[627,52],[669,55],[715,55],[757,61],[808,70],[844,79],[895,91],[932,103],[977,118],[1022,139],[1055,163],[1097,196],[1125,229],[1152,275],[1170,314],[1176,365],[1176,407],[1170,465],[1161,498],[1146,549],[1131,585],[1116,630],[1107,667],[1091,715],[1031,745],[1007,682],[1022,643],[1040,594],[1058,552],[1073,513],[1091,462],[1091,419],[1067,359],[1028,320],[995,293],[962,260],[929,232],[895,202],[841,178],[781,199],[745,232],[712,263],[678,305],[666,359],[678,416],[690,447],[715,498],[733,540],[757,573],[781,618],[793,664],[766,733],[703,748],[657,745],[612,742],[567,742],[522,745],[482,748],[425,745],[371,727],[341,670],[365,618],[392,582],[425,552],[455,525],[494,498],[534,462],[558,422],[567,365],[549,311],[501,284],[458,271],[413,251],[371,229],[329,208],[292,190],[247,175]]
});

/* Older game files without defineTrack(): delete the wrapper above (use
   `const TRACK_MYTRACK = { … };`) and register it by hand with:
   TRACKS["mytrack"] = TRACK_MYTRACK;  */
