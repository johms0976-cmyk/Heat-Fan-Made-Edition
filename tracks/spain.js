/* =====================================================================
   TRACK · Spain   (key: "spain")
   Self-registering circuit. Loaded by index.html AFTER js/track-registry.js.
   Edit this file alone to change the board — nothing else needs touching.
   To add a new circuit: drop a new file in tracks/ and add one <script>
   line to index.html in the TRACKS block.
   ===================================================================== */
/* ===== Pamplona — added with the HEAT track editor ===== */
const TRACK_SPAIN = defineTrack({
  key:"spain",
  brief:"109 spaces run as a single lap — the longest one-lap race on the roster, and a proper endurance run through the streets.",
  name:"Spain", spaces:109, defaultLaps:1, heat:6, stress:3,
  image:"tracks/Spain.jpg", imgW:1200, imgH:800,
  eyebrow:"Spanish Grand Prix",
  subtitle:"Tunnel Vision Expansion",
  tagline:"",
  terrain:"spain",
  plate:{ x:-20, y:-35, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"Outrun the Bull!",
          titleColor:"#f7ce46", subColor:"#e22400" },
  panel:{x:58,y:692}, podium:{x:965,y:195},
  weatherTok:{x:100,y:698,r:38},
 corners:[ {at:11, limit:5, bx:239, by:739}, {at:15, limit:4, bx:101, by:441}, {at:29, limit:4, chicane:1, bx:871, by:197}, {at:32, limit:4, chicane:1, bx:686, by:227}, {at:44, limit:2, bx:98, by:173}, {at:65, limit:5, bx:1074, by:153}, {at:85, limit:2, bx:236, by:508}, {at:92, limit:3, bx:626, by:616}, {at:95, limit:4, chicane:2, bx:770, by:580}, {at:98, limit:4, chicane:2, bx:914, by:515}, {at:103, limit:3, bx:1151, by:580} ],

  gravel:{ inner:[], outer:[] },

  tunnels:[ {from:16, to:23}, {from:37, to:41}, {from:45, to:48}, {from:61, to:70}, {from:79, to:87} ],

  legendsLine:7,
  spacePts:[[808,709],[760,712],[712,712],[657,709],[606,709],[558,706],[507,709],[455,706],[407,703],[356,703],[302,700],[238,672],[208,630],[172,585],[148,507],[181,443],[247,416],[292,401],[350,386],[398,377],[446,371],[504,371],[549,368],[597,362],[645,356],[706,353],[766,341],[808,298],[823,241],[805,187],[755,164],[699,151],[633,193],[579,193],[522,202],[470,220],[416,235],[368,241],[317,244],[268,241],[217,238],[157,238],[103,235],[54,205],[57,139],[106,115],[160,106],[208,106],[259,103],[308,103],[359,99],[416,93],[464,93],[516,90],[570,87],[618,84],[663,84],[718,84],[769,81],[823,81],[877,81],[926,81],[974,84],[1025,81],[1085,90],[1128,127],[1149,184],[1152,235],[1143,289],[1113,335],[1058,356],[1010,380],[953,392],[895,392],[844,401],[790,413],[745,428],[693,452],[645,458],[588,464],[543,464],[491,467],[437,473],[374,482],[302,504],[292,558],[338,606],[407,606],[458,588],[513,576],[552,576],[606,558],[660,570],[709,609],[766,642],[838,615],[832,558],[853,501],[898,461],[965,455],[1013,501],[1049,531],[1088,573],[1094,627],[1082,684],[1022,706],[968,709],[923,709],[868,709]]
});
