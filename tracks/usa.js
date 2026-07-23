/* =====================================================================
   TRACK · USA   (key: "usa")
   Self-registering circuit. Loaded by index.html AFTER js/track-registry.js.
   Edit this file alone to change the board — nothing else needs touching.
   To add a new circuit: drop a new file in tracks/ and add one <script>
   line to index.html in the TRACKS block.
   ===================================================================== */
 /* ===== Route 66 — added with the HEAT track editor ===== */
const TRACK_USA = defineTrack({
  key:"usa",
  brief:"The base-game American board and the best place to start. Long desert straights, a handful of corners, and room to make your mistakes in.",
  name:"USA", spaces:69, defaultLaps:2, heat:6, stress:3,
  image:"tracks/USA.jpg", imgW:1200, imgH:800,
  eyebrow:"USA Grand Prix",
  subtitle:"Base Game",
  tagline:"",
  terrain:"desert",
  plate:{ x:-53, y:7, w:300, h:224, rot:-2, title:"GRAND PRIX", sub:"USA",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:118,y:258}, podium:{x:283,y:87},
  weatherTok:{x:136,y:252,r:38},
  corners:[ {at:12, limit:7, bx:1185, by:699}, {at:33, limit:3, bx:45, by:753}, {at:49, limit:3, bx:572, by:17}, {at:57, limit:2, bx:375, by:478} ],
  gravel:{ inner:[], outer:[] },
  tunnels:[  ],
  legendsLine:7,
  spacePts:[[941,151],[998,166],[1040,199],[1073,241],[1088,292],[1107,344],[1119,386],[1131,437],[1143,485],[1152,534],[1155,579],[1146,642],[1119,690],[1070,730],[1016,745],[965,745],[914,745],[862,745],[811,745],[766,742],[715,742],[663,745],[615,744],[569,748],[518,745],[473,744],[416,741],[374,739],[320,742],[274,739],[223,745],[175,751],[109,745],[75,690],[96,627],[145,603],[202,588],[253,561],[283,516],[311,464],[326,422],[338,374],[353,326],[371,280],[389,232],[416,187],[446,142],[473,99],[531,69],[591,84],[621,142],[597,196],[561,244],[531,295],[501,341],[479,389],[452,431],[455,504],[522,491],[558,443],[579,398],[609,359],[636,317],[669,277],[699,235],[736,199],[775,163],[832,145],[883,142]]
});
