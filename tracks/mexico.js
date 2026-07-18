/* =====================================================================
   TRACK · Mexico   (key: "mexico")
   Self-registering circuit. Loaded by index.html AFTER js/track-registry.js.
   Edit this file alone to change the board — nothing else needs touching.
   To add a new circuit: drop a new file in tracks/ and add one <script>
   line to index.html in the TRACKS block.
   ===================================================================== */
/* ===== Mai-Ze-Co! — added with the HEAT track editor ===== */
const TRACK_MEXICO = defineTrack({
  key:"mexico",
  brief:"Tenochtitlán speedway — six corners including a chicane, run over three laps, and you start with one less Stress card than usual.",
  name:"Mexico", spaces:60, defaultLaps:3, heat:6, stress:2,
  image:"tracks/Mexico.jpg", imgW:1200, imgH:800,
  eyebrow:"Mexico Grand Prix",
  subtitle:"Heavy Rain Expansion!",
  tagline:"",
  terrain:"desert",
  plate:{ x:444, y:16, w:300, h:112, rot:-2, title:"Mai-Ze-Co", sub:"Tenochtitlán speedway!",
          titleColor:"#eb4d3d", subColor:"#0f5132" },
  panel:{x:510,y:529}, podium:{x:292,y:340},
  weatherTok:{x:516,y:526,r:38},
  corners:[ {at:14, limit:7, bx:188, by:340}, {at:19, limit:7, bx:191, by:130}, {at:38, limit:6, bx:1153, by:77}, {at:44, limit:4, bx:896, by:427}, {at:50, limit:2, chicane:1, bx:1171, by:728}, {at:51, limit:2, chicane:1, bx:1049, by:761} ],
  gravel:{ inner:[], outer:[] },
  tunnels:[  ],
  legendsLine:7,
  spacePts:[[558,730],[507,724],[452,715],[395,706],[353,696],[295,675],[247,657],[199,630],[160,603],[109,561],[78,525],[66,455],[81,413],[118,353],[142,289],[115,241],[84,175],[109,115],[160,78],[235,87],[271,133],[302,184],[347,223],[398,244],[446,262],[504,271],[546,277],[606,283],[648,283],[703,280],[757,268],[802,244],[850,211],[883,172],[917,130],[962,93],[1037,75],[1088,93],[1125,139],[1113,211],[1079,253],[1028,292],[986,323],[953,368],[968,437],[1022,461],[1070,504],[1107,546],[1128,594],[1134,648],[1097,718],[1025,693],[977,706],[923,721],[871,724],[817,730],[763,733],[715,739],[672,739],[612,736]] 
});
