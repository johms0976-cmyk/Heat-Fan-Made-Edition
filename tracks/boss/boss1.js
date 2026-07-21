/* ===== Rouen — built with the REVUP track builder =====
   Paste this whole block into the game file (Heatindex.html) anywhere AFTER
   the defineTrack() helper — the end of the track list is the natural spot.
   Nothing else to change: defineTrack registers it in TRACKS and the picker
   lists every registered circuit automatically. */
const TRACK_BOSS1 = defineTrack({
  key:"boss1",
  brief:"Insert track description for track selector screen",
  name:"Rouen", spaces:61, defaultLaps:2, heat:6, stress:3,
  image:"", imgW:1200, imgH:800,
  eyebrow:"Custom Grand Prix · My Circuit",
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
  plate:{ x:55, y:935, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"MY CIRCUIT",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:341,y:1048}, podium:{x:883,y:334},
  weatherTok:{x:1134,y:53,r:38},

  /* Corners — `at` is the space the corner line sits BEFORE, `limit` the speed you
     must be at or under crossing it. `chicane:n` groups consecutive corner lines
     into a chicane: same speed limit, blue kerbs, and ONE Road Condition token for
     the whole thing — a corner token modifies every line in it, a sector token
     modifies the sector AFTER it. Each line is still checked separately. */
  corners:[ {at:9, limit:4, bx:409, by:352}, {at:13, limit:5, bx:120, by:317}, {at:17, limit:2, bx:21, by:88}, {at:25, limit:5, bx:408, by:192}, {at:28, limit:4, bx:457, by:54}, {at:40, limit:8, bx:1082, by:200}, {at:49, limit:5, bx:1101, by:631} ],

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

  legendsLine:7,
  spacePts:[[567,706],[528,688],[488,664],[443,639],[413,600],[386,543],[378,512],[368,450],[365,407],[338,344],[295,332],[235,323],[175,302],[145,260],[136,220],[112,169],[75,121],[84,58],[139,61],[178,91],[220,133],[247,175],[289,217],[323,232],[389,269],[461,232],[479,181],[476,109],[519,64],[573,46],[627,55],[669,67],[718,82],[757,94],[799,106],[847,121],[895,133],[935,148],[983,172],[1025,205],[1055,254],[1076,296],[1085,341],[1104,395],[1113,431],[1125,486],[1140,525],[1155,573],[1155,636],[1131,679],[1079,712],[1034,724],[992,736],[941,745],[902,751],[844,751],[805,745],[751,736],[718,730],[657,721],[615,715]]
});

