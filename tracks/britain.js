/* =====================================================================
   TRACK · Great Britain   (key: "britain")
   Self-registering circuit. Loaded by index.html AFTER js/track-registry.js.
   Edit this file alone to change the board — nothing else needs touching.
   To add a new circuit: drop a new file in tracks/ and add one <script>
   line to index.html in the TRACKS block.
   ===================================================================== */
/* ===== Great Britain — built with the HEAT track builder =====
   Paste this whole block into index_20.html at the very END of the file,
   on the line just above the last closing script tag. Nothing else to change:
   it registers itself in TRACKS and adds its own card to the track picker. */
const TRACK_BRITAIN = defineTrack({
  key:"britain",
  brief:"The base-game British board. Compact and technical, with a fiddly infield section and a fast run down to the flag.",
  name:"Great Britain", spaces:63, defaultLaps:2, heat:6, stress:3,
  image:"tracks/Britain.jpg", imgW:1200, imgH:800,
  eyebrow:"British Grand Prix",
  subtitle:"Base Game",
  tagline:"",
  terrain:"farmland",
  plate:{ x:19, y:625, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"The Palace",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:123,y:481}, podium:{x:96,y:96},
  weatherTok:{x:112,y:478,r:38},

  /* Corners — `at` is the space the corner line sits BEFORE, `limit` the speed you
     must be at or under crossing it. `chicane:n` groups consecutive corner lines
     into a chicane: same speed limit, blue kerbs, and ONE Road Condition token for
     the whole thing — a corner token modifies every line in it, a sector token
     modifies the sector AFTER it. Each line is still checked separately. */
  corners:[ {at:15, limit:10, bx:1108, by:34}, {at:30, limit:6, bx:865, by:769}, {at:37, limit:5, bx:892, by:349}, {at:43, limit:4, bx:474, by:405}, {at:49, limit:3, bx:659, by:626} ],

  /* Gravel — space indices whose inner (Race Line) Spot and/or outer Spot is gravel.
     A space in both lists has gravel right across it. Rule: at the end of your turn
     (step 9), if your car is on a gravel Spot you must pay 1 Heat if you have any in
     the Engine; if the Engine is empty, ignore it. */
  gravel:{ inner:[], outer:[] },

  /* Tunnels — inclusive runs of Spaces (from > to means the run wraps past space 0).
     Rule: while a car is on a tunnel Space its player cannot discard from hand, and
     this beats any Event / Upgrade / Road Condition that would otherwise let them.
     Cooldown (card goes to the Engine) and Scrap (card comes off the top of the
     draw deck) are not discards, so both are still allowed inside a tunnel. */
  tunnels:[  ],

  legendsLine:7,
  spacePts:[[371,127],[419,88],[470,61],[525,52],[570,55],[618,52],[666,52],[718,52],[760,52],[814,52],[850,55],[905,58],[950,55],[1001,55],[1052,64],[1101,97],[1134,145],[1140,199],[1140,251],[1134,299],[1125,350],[1116,398],[1107,444],[1091,486],[1073,534],[1046,579],[1019,618],[989,658],[953,694],[898,724],[844,715],[793,667],[790,612],[802,555],[817,513],[841,456],[856,401],[814,353],[766,344],[696,374],[657,401],[606,398],[537,416],[507,465],[528,528],[585,558],[630,561],[688,591],[718,646],[657,673],[591,652],[558,636],[501,609],[461,585],[413,558],[371,525],[338,480],[317,434],[308,380],[302,332],[311,281],[329,223],[341,187]]
});
