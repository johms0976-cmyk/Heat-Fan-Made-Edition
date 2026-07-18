/* =====================================================================
   TRACK · Zandvoort   (key: "zandvoort")
   Self-registering circuit. Loaded by index.html AFTER js/track-registry.js.
   Edit this file alone to change the board — nothing else needs touching.
   To add a new circuit: drop a new file in tracks/ and add one <script>
   line to index.html in the TRACKS block.
   ===================================================================== */
 /* ===== Zandvoort — built with the HEAT track builder =====
   Paste this whole block into index_20.html at the very END of the file,
   on the line just above the last closing script tag. Nothing else to change:
   it registers itself in TRACKS and adds its own card to the track picker. */
const TRACK_ZANDVOORT = defineTrack({
  key:"zandvoort",
  brief:"test.",
  name:"Zandvoort", spaces:65, defaultLaps:2, heat:7, stress:3,
  image:"", imgW:1200, imgH:800,
  eyebrow:"Grand Prix · Zandvoort",
  subtitle:"Custom build",
  tagline:"Hand-built fan board",
  terrain:"oval",
  plate:{ x:824, y:990, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"MY CIRCUIT",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:983,y:56}, podium:{x:1116,y:222},
  weatherTok:{x:977,y:62,r:38},

  /* Corners — `at` is the space the corner line sits BEFORE, `limit` the speed you
     must be at or under crossing it. `chicane:n` groups consecutive corner lines
     into a chicane: same speed limit, blue kerbs, and ONE Road Condition token for
     the whole thing — a corner token modifies every line in it, a sector token
     modifies the sector AFTER it. Each line is still checked separately. */
  corners:[ {at:8, limit:4, bx:66, by:732}, {at:16, limit:3, bx:442, by:561}, {at:27, limit:7, bx:32, by:224}, {at:52, limit:8} ],

  /* Gravel — space indices whose inner (Race Line) Spot and/or outer Spot is gravel.
     A space in both lists has gravel right across it. Rule: at the end of your turn
     (step 9), if your car is on a gravel Spot you must pay 1 Heat if you have any in
     the Engine; if the Engine is empty, ignore it. */
  gravel:{ inner:[10,11,12,13,14,15,16,17,18,47,48,49,50,51,52,53,54], outer:[4,5,6,7,8,9,10,11,12,13,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56] },

  /* Tunnels — inclusive runs of Spaces (from > to means the run wraps past space 0).
     Rule: while a car is on a tunnel Space its player cannot discard from hand, and
     this beats any Event / Upgrade / Road Condition that would otherwise let them.
     Cooldown (card goes to the Engine) and Scrap (card comes off the top of the
     draw deck) are not discards, so both are still allowed inside a tunnel. */
  tunnels:[  ],

  legendsLine:7,
  spacePts:[[467,715],[419,724],[371,733],[329,745],[277,757],[238,766],[187,775],[120,747],[109,698],[154,643],[208,636],[262,630],[317,609],[365,606],[422,621],[482,609],[504,552],[449,516],[401,495],[353,465],[314,434],[274,413],[223,395],[166,380],[124,362],[81,323],[66,266],[90,217],[133,190],[187,175],[235,169],[286,154],[326,133],[374,112],[410,94],[458,70],[504,55],[555,49],[600,46],[657,46],[699,49],[751,61],[796,85],[832,115],[865,163],[883,199],[908,248],[947,284],[980,308],[1016,350],[1034,395],[1043,444],[1028,504],[1001,537],[962,573],[926,597],[877,621],[829,633],[784,643],[739,652],[693,661],[648,673],[603,685],[555,694],[510,703]]
});
