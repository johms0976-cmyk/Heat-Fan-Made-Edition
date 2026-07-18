/* =====================================================================
   TRACK · Monaco   (key: "monaco")
   Self-registering circuit. Loaded by index.html AFTER js/track-registry.js.
   Edit this file alone to change the board — nothing else needs touching.
   To add a new circuit: drop a new file in tracks/ and add one <script>
   line to index.html in the TRACKS block.
   ===================================================================== */
/* ===== Monaco — built with the HEAT track builder =====
   Paste this whole block into index_20.html at the very END of the file,
   on the line just above the last closing script tag. Nothing else to change:
   it registers itself in TRACKS and adds its own card to the track picker. */
const TRACK_MONACO = defineTrack({
  key:"monaco",
  brief:"One hundred spaces between the barriers. A tight, unforgiving street lap where a single overcooked corner is the end of your race.",
  name:"Monaco", spaces:100, defaultLaps:2, heat:6, stress:3,
  image:"tracks/Monaco.jpg", imgW:1200, imgH:800,
  eyebrow:"",
  subtitle:"Fan made Map",
  tagline:"Hand-built fan board",
  terrain:"oval",
  plate:{ x:390, y:19, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"MY CIRCUIT",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:1079,y:728}, podium:{x:405,y:517},
  weatherTok:{x:1115,y:731,r:38},
  corners:[ {at:6, limit:3, bx:234, by:24}, {at:21, limit:7, bx:799, by:518}, {at:29, limit:4, bx:674, by:112}, {at:36, limit:3, bx:1085, by:55}, {at:44, limit:2, bx:868, by:464}, {at:50, limit:3, bx:1087, by:274}, {at:78, limit:5, bx:327, by:219}, {at:89, limit:2, bx:75, by:701} ],
  gravel:{ inner:[], outer:[] },
  tunnels:[  ],
  legendsLine:7,
  spacePts:[[127,274],[142,232],[160,190],[187,157],[211,121],[244,84],[295,57],[344,93],[365,139],[383,181],[404,217],[428,250],[452,286],[479,323],[513,350],[546,383],[576,410],[609,434],[660,455],[709,473],[754,473],[811,452],[835,410],[847,356],[826,311],[796,274],[766,241],[733,199],[727,148],[748,99],[793,63],[844,57],[880,54],[926,51],[974,54],[1016,57],[1049,118],[1034,166],[1001,205],[980,244],[962,280],[938,323],[926,359],[908,413],[935,464],[989,443],[1019,392],[1019,347],[1025,298],[1049,253],[1104,229],[1152,253],[1161,308],[1164,353],[1161,404],[1152,446],[1131,485],[1101,519],[1061,552],[1019,570],[974,585],[929,600],[886,603],[835,603],[790,597],[748,582],[709,561],[675,546],[627,525],[591,497],[561,476],[522,452],[485,425],[452,404],[410,377],[377,347],[350,317],[320,283],[265,262],[217,289],[208,344],[208,398],[214,443],[217,494],[199,537],[169,576],[139,621],[130,666],[118,724],[72,751],[27,709],[39,660],[42,615],[42,573],[51,534],[60,485],[66,443],[81,401],[96,362],[109,320]]
});
