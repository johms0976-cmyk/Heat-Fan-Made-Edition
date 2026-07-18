/* =====================================================================
   TRACK · South Africa   (key: "southafrica")
   Self-registering circuit. Loaded by index.html AFTER js/track-registry.js.
   Edit this file alone to change the board — nothing else needs touching.
   To add a new circuit: drop a new file in tracks/ and add one <script>
   line to index.html in the TRACKS block.
   ===================================================================== */
/* ===== South Africa — built with the HEAT track builder =====
   Paste this whole block into index_20.html at the very END of the file,
   on the line just above the last closing script tag. Nothing else to change:
   it registers itself in TRACKS and adds its own card to the track picker. */
const TRACK_SOUTHAFRICA = defineTrack({
  key:"southafrica",
  brief:"test.",
  name:"South Africa", spaces:71, defaultLaps:2, heat:6, stress:3,
  image:"tracks/RSA.JPG", imgW:1200, imgH:800,
  eyebrow:"South Africa Grand Prix",
  subtitle:"Rocky Road Expansion",
  tagline:"",
  terrain:"urban",
  plate:{ x:748, y:4, w:300, h:112, rot:-2, title:"GRAND PRIX", sub:"MY CIRCUIT",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:522,y:276}, podium:{x:88,y:89},
  weatherTok:{x:543,y:267,r:38},

  /* Corners — `at` is the space the corner line sits BEFORE, `limit` the speed you
     must be at or under crossing it. `chicane:n` groups consecutive corner lines
     into a chicane: same speed limit, blue kerbs, and ONE Road Condition token for
     the whole thing — a corner token modifies every line in it, a sector token
     modifies the sector AFTER it. Each line is still checked separately. */
   corners:[ {at:11, limit:4, bx:124, by:658}, {at:18, limit:3, bx:259, by:311}, {at:24, limit:2, bx:554, by:598}, {at:34, limit:6, mdx:27, mdy:106}, {at:45, limit:5, bx:731, by:551}, {at:55, limit:2, bx:1082, by:178}, {at:62, limit:4, bx:1079, by:641} ],


  /* Gravel — space indices whose inner (Race Line) Spot and/or outer Spot is gravel.
     A space in both lists has gravel right across it. Rule: at the end of your turn
     (step 9), if your car is on a gravel Spot you must pay 1 Heat if you have any in
     the Engine; if the Engine is empty, ignore it. */
  gravel:{ inner:[13,14,15,18,19,20,24,25,26,27,47,48,49,50,51,52,53,54,55,56], outer:[7,8,9,10,11,12,13,14,15,16,17,24,52,53,54,55,56,57,58] },

  /* Tunnels — inclusive runs of Spaces (from > to means the run wraps past space 0).
     Rule: while a car is on a tunnel Space its player cannot discard from hand, and
     this beats any Event / Upgrade / Road Condition that would otherwise let them.
     Cooldown (card goes to the Engine) and Scrap (card comes off the top of the
     draw deck) are not discards, so both are still allowed inside a tunnel. */
  tunnels:[  ],

  legendsLine:7,
  spacePts:[[639,715],[579,718],[525,715],[470,721],[422,730],[368,736],[314,739],[256,751],[202,754],[139,745],[84,709],[66,648],[63,594],[63,537],[72,476],[93,416],[145,368],[205,350],[259,380],[302,422],[335,470],[368,510],[404,564],[479,588],[531,522],[494,473],[431,434],[392,395],[353,353],[329,289],[317,235],[326,166],[350,118],[413,90],[479,69],[540,81],[588,121],[652,160],[672,208],[681,262],[678,320],[663,380],[642,434],[639,491],[651,555],[690,600],[763,618],[817,573],[844,510],[844,452],[847,386],[856,335],[892,280],[938,238],[998,223],[1061,256],[1070,317],[1055,395],[1052,449],[1085,507],[1113,555],[1134,621],[1125,681],[1076,727],[1013,745],[956,742],[905,736],[853,730],[790,721],[745,718],[693,718]]
});
