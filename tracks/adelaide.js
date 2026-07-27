/* =====================================================================
   TRACK · adelaide   (key: "adelaide")
   Self-registering circuit. Loaded by index.html AFTER js/track-registry.js.
   Edit this file alone to change the board — nothing else needs touching.
   To add a new circuit: drop a new file in tracks/ and add one <script>
   line to index.html in the TRACKS block.
   ===================================================================== */
/* ===== My Circuit — built with the REVUP track builder =====
   Paste this whole block into the game file (Heatindex.html) anywhere AFTER
   the defineTrack() helper — the end of the track list is the natural spot.
   Nothing else to change: defineTrack registers it in TRACKS and the picker
   lists every registered circuit automatically. */
const TRACK_ADELAIDE = defineTrack({
  key:"adelaide",
  brief:"Insert track description for track selector screen",
  name:"adelaide", spaces:102, defaultLaps:2, heat:6, stress:3,
  image:"tracks/Adelaide.jpg", imgW:1200, imgH:800,
  eyebrow:"Custom Grand Prix · My Circuit",
  subtitle:"Custom build",
  tagline:"Hand-built fan board",
  terrain:"street",
  plate:{ x:397, y:876, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"ADELAIDE",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:681,y:462}, podium:{x:145,y:492},
  weatherTok:{x:720,y:458,r:38},

  /* Corners — `at` is the space the corner line sits BEFORE, `limit` the speed you
     must be at or under crossing it. `chicane:n` groups consecutive corner lines
     into a chicane: same speed limit, blue kerbs, and ONE Road Condition token for
     the whole thing — a corner token modifies every line in it, a sector token
     modifies the sector AFTER it. Each line is still checked separately. */
  corners:[ {at:11, limit:3, bx:374, by:602}, {at:17, limit:3, bx:362, by:318}, {at:23, limit:3, bx:80, by:292}, {at:29, limit:3, bx:80, by:76}, {at:55, limit:2, bx:1138, by:68}, {at:72, limit:5, bx:532, by:180}, {at:84, limit:7, bx:952, by:312}, {at:92, limit:2, bx:1124, by:728} ],

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
  spacePts:[[816,663],[773,649],[709,642],[675,648],[640,646],[595,646],[551,645],[506,649],[461,649],[416,649],[369,659],[324,601],[329,563],[331,518],[331,473],[329,431],[328,386],[297,345],[241,341],[202,341],[157,342],[119,342],[79,338],[27,307],[28,240],[27,205],[23,160],[26,115],[32,72],[64,24],[125,25],[169,25],[209,25],[249,28],[295,26],[339,24],[381,28],[421,27],[463,27],[508,27],[548,24],[591,27],[634,27],[673,26],[720,26],[759,24],[802,23],[846,25],[888,26],[927,26],[973,27],[1015,24],[1057,24],[1097,24],[1142,27],[1183,70],[1139,110],[1102,109],[1055,109],[1014,108],[970,108],[930,109],[883,109],[847,110],[798,112],[766,111],[712,109],[677,112],[631,111],[589,110],[551,120],[494,140],[467,197],[499,251],[545,265],[586,278],[627,286],[670,300],[709,307],[751,318],[795,325],[836,336],[880,348],[915,354],[968,372],[1004,408],[1030,448],[1049,488],[1070,531],[1089,564],[1106,599],[1127,642],[1143,668],[1179,714],[1144,782],[1098,763],[1058,752],[1016,740],[978,720],[941,709],[899,693],[859,675]]
});
