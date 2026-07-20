/* =====================================================================
   TRACK · Jarama   (key: "jarama")
   Self-registering circuit. Loaded by index.html AFTER js/track-registry.js.
   Edit this file alone to change the board — nothing else needs touching.
   To add a new circuit: drop a new file in tracks/ and add one <script>
   line to index.html in the TRACKS block.
   ===================================================================== */
/* ===== Jarama — built with the REVUP track builder =====
   Paste this whole block into the game file (Heatindex.html) anywhere AFTER
   the defineTrack() helper — the end of the track list is the natural spot.
   Nothing else to change: defineTrack registers it in TRACKS and the picker
   lists every registered circuit automatically. */
const TRACK_JARAMA = defineTrack({
  key:"jarama",
  brief:"brief description of track",
  name:"Jarama", spaces:90, defaultLaps:2, heat:7, stress:3,
  image:"tracks/Jarama.png", imgW:1200, imgH:800,
  eyebrow:"Custom Grand Prix · My Circuit",
  subtitle:"Custom build",
  tagline:"Hand-built fan board",
  terrain:"farmland",
  plate:{ x:31, y:-155, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"MY CIRCUIT",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:108,y:337}, podium:{x:498,y:131},
  weatherTok:{x:105,y:332,r:38},

  /* Corners — `at` is the space the corner line sits BEFORE, `limit` the speed you
     must be at or under crossing it. `chicane:n` groups consecutive corner lines
     into a chicane: same speed limit, blue kerbs, and ONE Road Condition token for
     the whole thing — a corner token modifies every line in it, a sector token
     modifies the sector AFTER it. Each line is still checked separately. */
  corners:[ {at:14, limit:6, bx:92, by:657}, {at:26, limit:4, bx:417, by:528}, {at:30, limit:2}, {at:37, limit:7}, {at:46, limit:5, bx:820, by:61}, {at:51, limit:4, bx:1099, by:105}, {at:62, limit:2, bx:712, by:494}, {at:73, limit:5, bx:1147, by:216} ],

  /* Gravel — space indices whose inner (Race Line) Spot and/or outer Spot is gravel.
     A space in both lists has gravel right across it. Rule: at the end of your turn
     (step 9), if your car is on a gravel Spot you must pay 1 Heat if you have any in
     the Engine; if the Engine is empty, ignore it. */
  gravel:{ inner:[20,21,22,23,24,26,27,28,30,54,55,56,59,60,61,62,63], outer:[15,16,17,18,19,22,23,30,31,32,33,57,58,59,60,61,62,63,64,65] },

  /* Tunnels — inclusive runs of Spaces (from > to means the run wraps past space 0).
     Rule: while a car is on a tunnel Space its player cannot discard from hand, and
     this beats any Event / Upgrade / Road Condition that would otherwise let them.
     Cooling down (card goes to the Engine) and Scrap (card comes off the top of the
     draw deck) are not discards, so both are still allowed inside a tunnel. */
  tunnels:[  ],

  legendsLine:7,
  spacePts:[[616,631],[579,640],[535,648],[497,655],[454,662],[412,669],[376,675],[333,680],[291,690],[253,693],[211,699],[171,704],[128,708],[77,708],[44,674],[36,618],[63,584],[110,558],[141,539],[176,520],[228,510],[266,518],[307,539],[344,556],[386,574],[440,577],[469,527],[441,484],[388,463],[361,452],[309,407],[359,389],[413,394],[447,398],[486,405],[530,408],[571,407],[624,390],[656,369],[685,327],[702,297],[725,256],[743,226],[761,185],[787,149],[816,112],[863,93],[903,91],[944,92],[997,94],[1034,101],[1066,157],[1034,197],[987,218],[947,240],[915,256],[876,280],[849,309],[827,348],[819,399],[809,438],[765,473],[760,530],[822,527],[856,512],[899,486],[934,459],[957,421],[982,388],[1000,355],[1021,320],[1043,281],[1098,250],[1152,277],[1166,328],[1151,374],[1135,405],[1115,455],[1096,485],[1060,521],[1023,543],[986,563],[948,578],[902,588],[862,595],[825,603],[781,609],[744,616],[697,623],[662,625]]
});
