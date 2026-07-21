/* =====================================================================
   TRACK · Nederland   (key: "dutch")
   Self-registering circuit. Loaded by index.html AFTER js/track-registry.js.
   Edit this file alone to change the board — nothing else needs touching.
   To add a new circuit: drop a new file in tracks/ and add one <script>
   line to index.html in the TRACKS block.
   ===================================================================== */
/* ===== Red Light — added with the HEAT track editor ===== */
const TRACK_DUTCH = defineTrack({
  key:"dutch",
  brief:"A short city lap run three times over. Corner after corner, with barely a straight long enough to catch your breath.",
  name:"Nederland", spaces:55, defaultLaps:3, heat:6, stress:3,
  image:"tracks/Dutch.jpg", imgW:1200, imgH:800,
  eyebrow:"Dutch Grand Prix",
  subtitle:"Tunnel Vision Expansion",
  tagline:"",
  terrain:"holland",
  plate:{ x:468, y:16, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"DUTCH",
          titleColor:"#ff6a00", subColor:"#3a87fe" },
  panel:{x:534,y:457}, podium:{x:1089,y:554},
  weatherTok:{x:531,y:457,r:38},
  corners:[ {at:9, limit:5, chicane:1, bx:157, by:470}, {at:13, limit:5, chicane:1, bx:292, by:372}, {at:16, limit:3, bx:209, by:105}, {at:26, limit:8, bx:703, by:340}, {at:34, limit:4, bx:1089, by:55} ],
  gravel:{ inner:[], outer:[] },
  tunnels:[  ],
  legendsLine:7,
  spacePts:[[407,718],[359,709],[317,690],[271,663],[232,633],[196,606],[169,576],[121,549],[87,501],[90,437],[136,395],[181,377],[232,353],[265,298],[253,241],[232,175],[274,130],[329,130],[374,151],[419,172],[458,193],[497,211],[543,229],[579,253],[624,268],[669,283],[724,283],[775,262],[811,235],[847,208],[889,187],[932,154],[968,127],[1022,103],[1088,130],[1113,190],[1104,238],[1079,286],[1058,329],[1034,359],[1010,398],[986,440],[956,479],[932,513],[905,555],[877,591],[835,627],[787,651],[736,672],[687,675],[648,684],[603,690],[558,696],[513,703],[461,712]]
});
