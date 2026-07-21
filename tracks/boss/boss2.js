/* ===== My Circuit — built with the REVUP track builder =====
   Paste this whole block into the game file (Heatindex.html) anywhere AFTER
   the defineTrack() helper — the end of the track list is the natural spot.
   Nothing else to change: defineTrack registers it in TRACKS and the picker
   lists every registered circuit automatically. */
const TRACK_BOSS2 = defineTrack({
  key:"boss2",
  brief:"Insert track description for track selector screen",
  name:"Boss Mexico", spaces:87, defaultLaps:2, heat:6, stress:3,
  image:"tracks/bossmexico.png", imgW:1200, imgH:800,
  eyebrow:"Boss Grand Prix · Mexico",
  subtitle:"Custom build",
  tagline:"Hand-built fan board",
  terrain:"mexico",

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
  plate:{ x:1203, y:787, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"MY CIRCUIT",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:534,y:927}, podium:{x:678,y:463},
  weatherTok:{x:715,y:140,r:38},

  /* Corners — `at` is the space the corner line sits BEFORE, `limit` the speed you
     must be at or under crossing it. `chicane:n` groups consecutive corner lines
     into a chicane: same speed limit, blue kerbs, and ONE Road Condition token for
     the whole thing — a corner token modifies every line in it, a sector token
     modifies the sector AFTER it. Each line is still checked separately. */
  corners:[ {at:10, limit:4, bx:639, by:716}, {at:14, limit:2, chicane:1, bx:507, by:662}, {at:15, limit:2, chicane:1, bx:618, by:638}, {at:24, limit:3, chicane:2, bx:355, by:419}, {at:26, limit:3, chicane:2, bx:265, by:516}, {at:38, limit:4, bx:253, by:60}, {at:51, limit:5}, {at:55, limit:3, chicane:3, bx:598, by:322}, {at:56, limit:3, chicane:3, bx:502, by:340}, {at:60, limit:4, chicane:4, bx:631, by:187}, {at:63, limit:4, chicane:4, bx:755, by:237}, {at:73, limit:6, bx:927, by:41} ],

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
  spacePts:[[805,498],[793,522],[778,549],[766,577],[751,606],[736,636],[724,664],[712,688],[696,718],[666,748],[636,760],[597,745],[573,727],[549,691],[570,658],[573,621],[546,594],[522,573],[501,555],[473,537],[446,519],[419,501],[398,483],[371,462],[338,462],[308,483],[268,462],[260,424],[256,398],[253,365],[250,335],[250,305],[244,272],[241,238],[238,205],[235,178],[229,142],[247,106],[283,100],[305,124],[317,163],[332,190],[353,217],[374,241],[386,263],[410,287],[428,320],[440,347],[449,383],[461,413],[482,440],[525,453],[564,437],[579,401],[573,362],[549,335],[528,305],[537,263],[558,232],[597,220],[636,238],[654,269],[675,305],[718,311],[748,284],[763,260],[775,232],[787,205],[805,181],[820,151],[832,121],[859,91],[892,79],[932,88],[953,115],[965,148],[959,187],[941,220],[929,245],[917,269],[902,299],[889,326],[874,359],[862,383],[850,407],[835,440],[820,468]]
});

