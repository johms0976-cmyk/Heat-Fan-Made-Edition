/* =====================================================================
   TRACK · Pukekohe   (key: "pukekohe")
   Self-registering circuit. Loaded by index.html AFTER js/track-registry.js.
   Edit this file alone to change the board — nothing else needs touching.
   To add a new circuit: drop a new file in tracks/ and add one <script>
   line to index.html in the TRACKS block.
   ===================================================================== */
/* ===== Pukekohe — built with the REVUP track builder =====
   Paste this whole block into the game file (Heatindex.html) anywhere AFTER
   the defineTrack() helper — the end of the track list is the natural spot.
   Nothing else to change: defineTrack registers it in TRACKS and the picker
   lists every registered circuit automatically. */
const TRACK_PUKEKOHE = defineTrack({
  key:"pukekohe",
  brief:"New Zealand's home Grand Prix, a flowing road course wrapped around the Pukekohe horse-racing oval. Two quick infield corners set the lap up, then it's a long run round the outside to the fast right-hander onto the main straight.",
  name:"Pukekohe", spaces:73, defaultLaps:2, heat:6, stress:3,
  image:"tracks/Pukekohe.png", imgW:1200, imgH:800,
  eyebrow:"New Zealand International Grand Prix · Pukekohe",
  subtitle:"Kiwi Grand Prix",
  tagline:"New Zealand International Grand Prix — fan table, private garage build",
  terrain:"aotearoa",
  plate:{ x:875, y:655, w:300, h:115, rot:-2, title:"NEW ZEALAND GRAND PRIX", sub:"PUKEKOHE",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:666,y:263}, podium:{x:442,y:167},
  weatherTok:{x:668,y:257,r:38},

  /* Corners — `at` is the space the corner line sits BEFORE, `limit` the speed you
     must be at or under crossing it. `chicane:n` groups consecutive corner lines
     into a chicane: same speed limit, blue kerbs, and ONE Road Condition token for
     the whole thing — a corner token modifies every line in it, a sector token
     modifies the sector AFTER it. Each line is still checked separately. */
  corners:[ {at:9, limit:3, bx:126, by:420}, {at:15, limit:3, bx:132, by:707}, {at:32, limit:7, bx:74, by:20}, {at:57, limit:4, bx:1111, by:254} ],

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
  spacePts:[[531,585],[494,570],[446,549],[407,534],[362,513],[326,492],[280,468],[235,453],[190,447],[136,481],[130,552],[145,585],[166,630],[190,682],[184,724],[124,760],[69,745],[36,688],[39,643],[42,603],[45,558],[45,519],[48,474],[51,428],[54,389],[54,347],[57,305],[60,260],[60,220],[63,175],[63,133],[84,79],[124,46],[190,46],[220,46],[268,49],[311,46],[356,49],[401,46],[437,46],[482,46],[521,42],[568,39],[615,36],[651,36],[699,42],[739,49],[784,58],[826,76],[862,91],[908,112],[944,124],[989,142],[1022,157],[1064,175],[1104,190],[1152,214],[1146,284],[1110,323],[1067,329],[1008,337],[974,347],[929,371],[889,401],[853,440],[829,481],[811,516],[790,552],[754,594],[705,612],[663,621],[618,618],[570,603]]
});
