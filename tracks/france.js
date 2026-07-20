/* =====================================================================
   TRACK · France   (key: "france")
   Self-registering circuit. Loaded by index.html AFTER js/track-registry.js.
   Edit this file alone to change the board — nothing else needs touching.
   To add a new circuit: drop a new file in tracks/ and add one <script>
   line to index.html in the TRACKS block.
   ===================================================================== */
/* ===== Oui — added with the HEAT track editor ===== */
const TRACK_FRANCE = defineTrack({
  key:"france",
  brief:"A five-corner custom build mixing quick kinks with one genuinely slow turn. The gearbox does most of the work on this one.",
  name:"France", spaces:60, defaultLaps:2, heat:6, stress:3,
  image:"tracks/France.jpg", imgW:1200, imgH:800,
  eyebrow:"French Grand Prix",
  subtitle:"Base Game",
  tagline:"",
  terrain:"vineyard",
  plate:{ x:73, y:7, w:300, h:112, rot:-2, title:"Oui", sub:"Oui Oui!",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:1094,y:158}, podium:{x:99,y:569},
  weatherTok:{x:1056,y:158,r:38},
  corners:[ {at:12, limit:5, bx:50, by:361}, {at:20, limit:2, bx:466, by:68}, {at:27, limit:4, bx:325, by:491}, {at:39, limit:3, bx:729, by:54}, {at:47, limit:4, bx:1143, by:327} ],
  gravel:{ inner:[], outer:[] },
  tunnels:[  ],
  legendsLine:7,
  spacePts:[[567,712],[513,700],[470,690],[419,672],[371,645],[326,615],[289,579],[259,543],[223,507],[196,467],[154,434],[109,392],[109,323],[142,271],[193,253],[250,241],[295,229],[347,208],[395,187],[443,139],[507,136],[516,208],[473,253],[443,292],[404,332],[380,377],[365,446],[395,497],[446,528],[507,519],[555,497],[597,461],[636,425],[663,389],[693,344],[712,295],[736,247],[721,187],[739,121],[790,90],[844,103],[886,157],[892,214],[914,259],[974,302],[1019,314],[1079,332],[1110,392],[1104,440],[1055,497],[1022,525],[980,552],[944,585],[905,618],[865,651],[820,666],[775,687],[721,703],[672,712],[624,712]]
});
