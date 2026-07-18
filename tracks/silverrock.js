/* =====================================================================
   TRACK · Silverstone   (key: "silverrock")
   Self-registering circuit. Loaded by index.html AFTER js/track-registry.js.
   Edit this file alone to change the board — nothing else needs touching.
   To add a new circuit: drop a new file in tracks/ and add one <script>
   line to index.html in the TRACKS block.
   ===================================================================== */
/* ===== Silverrock — added with the HEAT track editor ===== */
const TRACK_SILVERROCK = defineTrack({
  key:"silverrock",
  brief:"The longest board on the roster at 89 spaces. Plenty of straight-line running to build a lead — and just as much room to burn your Heat doing it.",
  name:"Silverstone", spaces:89, defaultLaps:2, heat:6, stress:3,
  image:"tracks/Silverrock.jpeg", imgW:1200, imgH:800,
  eyebrow:"British Grand Prix · Silverstone",
  subtitle:"Custom build",
  tagline:"Racing In-It",
  terrain:"oval",
  plate:{ x:32, y:616, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"MY CIRCUIT",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:801,y:255}, podium:{x:348,y:249},
  weatherTok:{x:811,y:261,r:38},
 corners:[ {at:6, limit:7, bx:1153, by:641}, {at:19, limit:5, bx:577, by:715}, {at:33, limit:6, bx:88, by:390}, {at:44, limit:5, bx:334, by:93}, {at:60, limit:3, bx:671, by:580}, {at:73, limit:4, bx:976, by:245}, {at:78, limit:2, bx:798, by:101} ],
  gravel:{ inner:[], outer:[] },
  tunnels:[  ],
  legendsLine:7,
  spacePts:[[1134,380],[1134,413],[1134,458],[1134,501],[1131,537],[1122,591],[1088,630],[1037,636],[995,645],[956,645],[911,651],[871,654],[826,657],[787,663],[739,672],[696,700],[663,727],[630,754],[582,763],[528,739],[504,696],[488,654],[455,615],[413,597],[377,579],[341,561],[298,546],[262,531],[223,516],[187,501],[151,482],[109,464],[66,443],[33,395],[45,338],[72,295],[99,259],[130,229],[154,196],[181,169],[205,133],[238,109],[268,72],[308,45],[368,57],[413,81],[443,103],[479,127],[513,151],[546,175],[582,211],[600,256],[603,298],[603,341],[603,386],[603,425],[606,470],[606,513],[600,561],[624,603],[678,630],[721,612],[751,573],[778,546],[808,513],[838,485],[868,458],[895,434],[929,395],[956,374],[980,338],[1007,305],[1031,253],[1010,199],[974,166],[944,148],[911,130],[865,109],[844,54],[898,27],[950,57],[986,72],[1025,96],[1046,118],[1085,154],[1119,196],[1134,241],[1131,286],[1131,326]]
});
