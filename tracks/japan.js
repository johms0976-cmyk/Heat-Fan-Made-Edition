/* =====================================================================
   TRACK · Japan   (key: "japan")
   Self-registering circuit. Loaded by index.html AFTER js/track-registry.js.
   Edit this file alone to change the board — nothing else needs touching.
   To add a new circuit: drop a new file in tracks/ and add one <script>
   line to index.html in the TRACKS block.
   ===================================================================== */
/* ===== Nippon — added with the HEAT track editor ===== */
const TRACK_JAPAN = defineTrack({
  key:"japan",
  brief:"A mountain lap that flows from one sweeper straight into the next. Commit early: the corner lines come up in quick succession.",
  name:"Japan", spaces:60, defaultLaps:2, heat:6, stress:3,
  image:"tracks/Japan.jpg", imgW:1200, imgH:800,
  eyebrow:"Japan Grand Prix",
  subtitle:"Heavy Rain Expansion",
  tagline:"",
  terrain:"japan",
  plate:{ x:-7, y:7, w:300, h:112, rot:-2, title:"Japanese Grand Prix", sub:"Japanese",
          titleColor:"#64c466", subColor:"#eb4d3d" },
  panel:{x:106,y:179}, podium:{x:552,y:68},
  weatherTok:{x:106,y:176,r:38},
  corners:[ {at:10, limit:4, chicane:1, bx:1173, by:512}, {at:12, limit:4, chicane:1, bx:967, by:450}, {at:18, limit:2, bx:1092, by:100}, {at:45, limit:5, bx:24, by:573}, {at:53, limit:3, bx:305, by:147} ],
  gravel:{ inner:[], outer:[] },
  tunnels:[  ],
  legendsLine:7,
  spacePts:[[636,422],[693,434],[742,449],[790,467],[838,491],[886,522],[941,549],[989,567],[1049,567],[1101,537],[1113,467],[1043,431],[998,383],[989,320],[998,256],[1031,211],[1076,172],[1128,136],[1137,72],[1073,51],[1016,75],[965,93],[920,106],[865,118],[820,133],[766,160],[730,202],[718,265],[709,311],[706,365],[678,504],[660,552],[645,600],[618,648],[570,684],[525,703],[464,727],[425,733],[353,736],[305,736],[253,727],[199,721],[142,703],[96,663],[81,600],[87,549],[118,504],[157,458],[193,413],[208,359],[223,308],[232,253],[277,211],[338,211],[377,259],[401,311],[431,365],[482,395],[537,404],[582,413]]
});
