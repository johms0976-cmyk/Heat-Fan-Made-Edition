/* ===== Hungary — built with the REVUP track builder =====
   Paste this whole block into the game file (Heatindex.html) anywhere AFTER
   the defineTrack() helper — the end of the track list is the natural spot.
   Nothing else to change: defineTrack registers it in TRACKS and the picker
   lists every registered circuit automatically. */
const TRACK_HUNGARY = defineTrack({
  key:"hungary",
  brief:"Insert track description for track selector screen",
  name:"Hungary", spaces:91, defaultLaps:2, heat:6, stress:3,
  image:"tracks/Hungary.jpg", imgW:1200, imgH:800,
  eyebrow:"Grand Prix · Hungary",
  subtitle:"Custom build",
  tagline:"Hand-built fan board",
  terrain:"parkland",

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
  plate:{ x:483, y:878, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"MY CIRCUIT",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:477,y:970}, podium:{x:690,y:370},
  weatherTok:{x:522,y:466,r:38},

  /* Corners — `at` is the space the corner line sits BEFORE, `limit` the speed you
     must be at or under crossing it. `chicane:n` groups consecutive corner lines
     into a chicane: same speed limit, blue kerbs, and ONE Road Condition token for
     the whole thing — a corner token modifies every line in it, a sector token
     modifies the sector AFTER it. Each line is still checked separately. */
  corners:[ {at:9, limit:4, bx:115, by:92}, {at:18, limit:5, bx:295, by:303}, {at:38, limit:4, bx:1099, by:89}, {at:54, limit:8, bx:949, by:676}, {at:67, limit:6, bx:441, by:702}, {at:74, limit:3, bx:289, by:495}, {at:83, limit:4, bx:119, by:707} ],

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
  trackside:[ {from:83, to:8, side:"in", kind:"grandstand"}, {from:83, to:8, side:"in", kind:"grandstand"}, {from:7, to:10, side:"out", kind:"pits"}, {from:11, to:32, side:"out", kind:"forest"}, {from:11, to:41, side:"in", kind:"forest"}, {from:33, to:41, side:"out", kind:"field"}, {from:42, to:54, side:"out", kind:"forest"} ],


  legendsLine:7,
  spacePts:[[33,404],[33,356],[33,308],[33,278],[33,232],[36,184],[36,136],[39,94],[75,46],[127,30],[190,52],[214,91],[223,148],[223,181],[220,226],[220,278],[246,332],[286,362],[353,338],[374,308],[404,278],[440,245],[461,217],[507,184],[546,169],[588,160],[630,151],[672,142],[712,130],[753,119],[799,103],[838,97],[877,88],[920,73],[959,67],[998,55],[1043,42],[1101,27],[1149,55],[1170,115],[1158,160],[1146,196],[1134,241],[1125,278],[1113,329],[1104,359],[1091,404],[1079,450],[1070,483],[1055,531],[1046,567],[1034,609],[1022,652],[1010,694],[968,733],[923,754],[874,760],[832,757],[793,757],[742,757],[703,754],[666,754],[615,757],[579,757],[537,754],[491,757],[452,754],[401,745],[362,697],[362,649],[362,612],[359,567],[356,528],[338,462],[277,437],[232,477],[223,522],[223,567],[220,615],[220,649],[214,709],[178,757],[130,769],[66,748],[36,703],[36,655],[36,612],[36,576],[33,525],[33,498],[33,440]]
});

/* Older game files without defineTrack(): delete the wrapper above (use
   `const TRACK_HUNGARY = { … };`) and register it by hand with:
   TRACKS["hungary"] = TRACK_HUNGARY;  */
