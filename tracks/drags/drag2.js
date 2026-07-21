/* ===== Drag1 — built with the REVUP track builder =====
   Paste this whole block into the game file (Heatindex.html) anywhere AFTER
   the defineTrack() helper — the end of the track list is the natural spot.
   Nothing else to change: defineTrack registers it in TRACKS and the picker
   lists every registered circuit automatically. */
const TRACK_DRAG2 = defineTrack({
  key:"drag2",
  brief:"Insert track description for track selector screen",
  name:"Drag2", spaces:35, defaultLaps:1, heat:6, stress:3,
  image:"", imgW:1200, imgH:800,
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
  layout:"open",
  plate:{ x:697, y:423, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"MY CIRCUIT 2",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:292,y:122}, podium:{x:552,y:117},
  weatherTok:{x:296,y:119,r:38},

  /* Corners — `at` is the space the corner line sits BEFORE, `limit` the speed you
     must be at or under crossing it. `chicane:n` groups consecutive corner lines
     into a chicane: same speed limit, blue kerbs, and ONE Road Condition token for
     the whole thing — a corner token modifies every line in it, a sector token
     modifies the sector AFTER it. Each line is still checked separately. */
  corners:[ {at:9, limit:5}, {at:26, limit:5} ],

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
  trackside:[  ],

  legendsLine:7,
  spacePts:[[70,400],[96,432],[122,463],[149,494],[177,523],[207,551],[240,576],[275,595],[315,606],[355,606],[395,595],[430,576],[463,551],[493,523],[521,494],[548,463],[574,432],[600,400],[626,368],[652,337],[679,306],[707,277],[737,249],[770,224],[805,205],[845,194],[885,194],[925,205],[960,224],[993,249],[1023,277],[1051,306],[1078,337],[1104,368],[1130,400]]
});

/* Older game files without defineTrack(): delete the wrapper above (use
   `const TRACK_DRAG1 = { … };`) and register it by hand with:
   TRACKS["drag1"] = TRACK_DRAG1;  */
