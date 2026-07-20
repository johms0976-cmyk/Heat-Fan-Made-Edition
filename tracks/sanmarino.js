/* ===== My Circuit 2 — built with the REVUP track builder =====
   Paste this whole block into the game file (Heatindex.html) anywhere AFTER
   the defineTrack() helper — the end of the track list is the natural spot.
   Nothing else to change: defineTrack registers it in TRACKS and the picker
   lists every registered circuit automatically. */
const TRACK_SANMARINO = defineTrack({
  key:"sanmarino",
  brief:"Insert track description for track selector screen",
  name:"San Marino", spaces:71, defaultLaps:2, heat:6, stress:3,
  image:"", imgW:1200, imgH:800,
  eyebrow:"Grand Prix · San Marino",
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
  plate:{ x:273, y:975, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"MY CIRCUIT 2",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:-74,y:970}, podium:{x:1120,y:433},
  weatherTok:{x:734,y:118,r:38},

  /* Corners — `at` is the space the corner line sits BEFORE, `limit` the speed you
     must be at or under crossing it. `chicane:n` groups consecutive corner lines
     into a chicane: same speed limit, blue kerbs, and ONE Road Condition token for
     the whole thing — a corner token modifies every line in it, a sector token
     modifies the sector AFTER it. Each line is still checked separately. */
  corners:[ {at:14, limit:6, chicane:1, bx:37, by:451}, {at:18, limit:6, chicane:1, bx:292, by:514}, {at:29, limit:2, bx:615, by:83}, {at:33, limit:3}, {at:45, limit:7, bx:1122, by:122}, {at:55, limit:2, bx:769, by:555}, {at:62, limit:4, bx:1102, by:725} ],

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
  tunnels:[ {from:15, to:20}, {from:24, to:26}, {from:30, to:37}, {from:50, to:53}, {from:56, to:58} ],

  legendsLine:7,
  spacePts:[[608,704],[576,729],[521,746],[476,752],[421,739],[380,713],[343,680],[300,656],[256,638],[205,626],[162,623],[112,611],[63,578],[60,505],[99,461],[156,452],[210,463],[259,468],[310,459],[355,420],[375,375],[384,325],[381,279],[375,220],[391,174],[420,130],[456,96],[501,68],[552,61],[564,116],[541,171],[531,205],[525,263],[559,316],[623,308],[665,278],[703,250],[748,229],[793,214],[840,193],[876,153],[912,117],[955,98],[1014,96],[1064,124],[1096,171],[1095,235],[1058,280],[1023,312],[1003,355],[968,401],[934,432],[881,450],[830,459],[785,484],[824,536],[885,546],[928,546],[973,548],[1024,553],[1082,597],[1082,668],[1042,718],[975,728],[926,700],[886,678],[841,650],[788,636],[743,633],[693,650],[654,675]]
});
