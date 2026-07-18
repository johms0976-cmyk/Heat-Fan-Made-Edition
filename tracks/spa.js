/* ===== Spa — built with the REVUP track builder =====
   Paste this whole block into the game file (Heatindex.html) anywhere AFTER
   the defineTrack() helper — the end of the track list is the natural spot.
   Nothing else to change: defineTrack registers it in TRACKS and the picker
   lists every registered circuit automatically. */
const TRACK_SPA = defineTrack({
  key:"spa",
  brief:"Insert track description for track selector screen",
  name:"Spa", spaces:94, defaultLaps:2, heat:6, stress:3,
  image:"tracks/Spa.jpg", imgW:1200, imgH:800,
  eyebrow:"Belgium Grand Prix",
  subtitle:"Custom build",
  tagline:"Hand-built fan board",
  terrain:"oval",
  plate:{ x:-337, y:348, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"MY CIRCUIT",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:1131,y:61}, podium:{x:877,y:400},
  weatherTok:{x:1129,y:50,r:38},

  /* Corners — `at` is the space the corner line sits BEFORE, `limit` the speed you
     must be at or under crossing it. `chicane:n` groups consecutive corner lines
     into a chicane: same speed limit, blue kerbs, and ONE Road Condition token for
     the whole thing — a corner token modifies every line in it, a sector token
     modifies the sector AFTER it. Each line is still checked separately. */
  corners:[ {at:5, limit:2, bx:12, by:32}, {at:42, limit:2, bx:958, by:741}, {at:55, limit:5, bx:849, by:235}, {at:68, limit:4, bx:829, by:725}, {at:77, limit:5, bx:312, by:725} ],

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
  spacePts:[[190,166],[151,160],[109,160],[48,154],[21,97],[66,61],[127,70],[172,64],[214,61],[259,58],[305,61],[350,61],[398,64],[443,61],[488,58],[534,52],[582,52],[627,52],[669,55],[715,55],[757,61],[808,70],[844,79],[895,91],[932,103],[977,118],[1022,139],[1055,163],[1097,196],[1125,229],[1152,275],[1170,314],[1176,365],[1176,407],[1170,465],[1161,498],[1146,549],[1131,585],[1116,630],[1107,667],[1091,715],[1031,745],[1007,682],[1022,643],[1040,594],[1058,552],[1073,513],[1091,462],[1091,419],[1067,359],[1028,320],[995,293],[962,260],[929,232],[895,202],[841,178],[781,199],[745,232],[712,263],[678,305],[666,359],[678,416],[690,447],[715,498],[733,540],[757,573],[781,618],[793,664],[766,733],[703,748],[657,745],[612,742],[567,742],[522,745],[482,748],[425,745],[371,727],[341,670],[365,618],[392,582],[425,552],[455,525],[494,498],[534,462],[558,422],[567,365],[549,311],[501,284],[458,271],[413,251],[371,229],[329,208],[292,190],[247,175]]
});
