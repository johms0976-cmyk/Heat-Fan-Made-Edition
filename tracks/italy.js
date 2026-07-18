/* =====================================================================
   TRACK · Italy   (key: "italy")
   Self-registering circuit. Loaded by index.html AFTER js/track-registry.js.
   Edit this file alone to change the board — nothing else needs touching.
   To add a new circuit: drop a new file in tracks/ and add one <script>
   line to index.html in the TRACKS block.
   ===================================================================== */
/* ===== Italy — added with the HEAT track editor ===== */
const TRACK_ITALY = defineTrack({
  key:"italy",
  brief:"The shortest lap in the garage, run over three laps. The flag comes round fast and you are never far from traffic.",
  name:"Italy", spaces:54, defaultLaps:3, heat:6, stress:3,
  image:"tracks/Italy.jpg", imgW:1200, imgH:800,
  eyebrow:"Italian Grand Prix",
  subtitle:"Base Game",
  tagline:"When in Rome",
  terrain:"oval",
  plate:{ x:-35, y:16, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"When in Roma",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:109,y:261}, podium:{x:1070,y:108},
  weatherTok:{x:133,y:252,r:38},
  corners:[ {at:10, limit:5, bx:702, by:775}, {at:19, limit:2, bx:533, by:270}, {at:26, limit:3, bx:516, by:728} ],
  gravel:{ inner:[], outer:[] },
  tunnels:[  ],
  legendsLine:7,
  spacePts:[[962,350],[965,395],[959,449],[950,501],[908,552],[877,585],[841,615],[805,651],[769,684],[727,709],[663,718],[615,684],[594,633],[579,582],[570,549],[555,491],[546,449],[540,401],[528,350],[464,317],[431,362],[452,428],[464,488],[482,549],[491,597],[491,654],[452,706],[383,696],[347,651],[338,603],[326,552],[317,513],[305,461],[295,413],[283,371],[274,323],[274,265],[286,220],[317,166],[347,130],[395,96],[440,75],[488,60],[543,57],[591,54],[642,54],[699,63],[745,69],[802,90],[847,121],[883,163],[911,199],[932,247],[947,295]]
});
