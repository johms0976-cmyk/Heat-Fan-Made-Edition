/*  Fix first: two spaces are almost on top of each other  */

/* ===== New York — built with the REVUP track builder =====
   Paste this whole block into the game file (Heatindex.html) anywhere AFTER
   the defineTrack() helper — the end of the track list is the natural spot.
   Nothing else to change: defineTrack registers it in TRACKS and the picker
   lists every registered circuit automatically. */
const TRACK_NEWYORK = defineTrack({
  key:"newyork",
  brief:"Insert track description for track selector screen",
  name:"New York", spaces:76, defaultLaps:2, heat:6, stress:3,
  image:"tracks/newyork.jpg", imgW:1200, imgH:800,
  eyebrow:"Custom Grand Prix · My Circuit 2",
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
  layout:"leadin",
  lapStart:11,   /* first space of the repeating lap */
  startLine:4,   /* START line sits just before this space */
  finishLine:27,   /* flag sits just after this space */
  plate:{ x:1213, y:556, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"MY CIRCUIT 2",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:1022,y:155}, podium:{x:835,y:201},
  weatherTok:{x:1020,y:161,r:38},

  /* Corners — `at` is the space the corner line sits BEFORE, `limit` the speed you
     must be at or under crossing it. `chicane:n` groups consecutive corner lines
     into a chicane: same speed limit, blue kerbs, and ONE Road Condition token for
     the whole thing — a corner token modifies every line in it, a sector token
     modifies the sector AFTER it. Each line is still checked separately. */
  corners:[ {at:13, limit:4, chicane:1, bx:18, by:676}, {at:15, limit:4, chicane:1, bx:178, by:728}, {at:33, limit:3, bx:1029, by:689}, {at:40, limit:2, bx:1180, by:319}, {at:60, limit:5, bx:394, by:40}, {at:68, limit:2, bx:483, by:373} ],

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
  trackside:[ {from:0, to:40, side:"out", kind:"buildings"}, {from:0, to:10, side:"in", kind:"crowdbank"}, {from:41, to:51, side:"out", kind:"beach"}, {from:16, to:21, side:"in", kind:"industry"}, {from:52, to:75, side:"in", kind:"field"}, {from:52, to:75, side:"out", kind:"field"}, {from:11, to:15, side:"out", kind:"pits"} ],


  legendsLine:7,
  spacePts:[[99,76],[102,122],[104,169],[105,215],[106,261],[106,308],[106,354],[105,401],[104,447],[103,501],[103,540],[109,594],[66,655],[69,703],[136,715],[175,679],[235,673],[274,673],[323,676],[368,676],[413,676],[461,676],[507,673],[552,673],[597,673],[645,673],[687,673],[730,676],[787,679],[826,676],[877,676],[917,673],[971,673],[1016,636],[1040,579],[1055,546],[1070,486],[1094,453],[1119,407],[1140,362],[1113,308],[1079,341],[1052,407],[1028,440],[977,483],[932,498],[877,501],[823,492],[778,480],[736,456],[690,428],[660,401],[627,350],[606,317],[582,272],[564,238],[549,181],[519,142],[476,109],[425,85],[368,88],[317,124],[295,166],[286,220],[295,269],[329,314],[362,332],[425,368],[434,419],[377,431],[320,409],[274,407],[223,431],[193,477],[175,516],
            [160,561]]
});

/* Older game files without defineTrack(): delete the wrapper above (use
   `const TRACK_NEWYORK = { … };`) and register it by hand with:
   TRACKS["newyork"] = TRACK_NEWYORK;  */
