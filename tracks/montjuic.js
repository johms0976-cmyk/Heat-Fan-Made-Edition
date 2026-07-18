/* =====================================================================
   TRACK · Montjuic   (key: "montjuic")
   Self-registering circuit. Loaded by index.html AFTER js/track-registry.js.
   Edit this file alone to change the board — nothing else needs touching.
   To add a new circuit: drop a new file in tracks/ and add one <script>
   line to index.html in the TRACKS block.
   ===================================================================== */
  /* ---------------- Track: Montjuic (fan board: 73 spaces, 4 corners, 2 laps)
   Geometry traced from the printed board art (tracks/Pukekohe.jpeg, 3:2).
   Space 0 = first space past the finish line; travel heads "west" into the
   infield esses, up the outer edge, along the top and around the right
   hairpin back to the flag. Corner indices/limits match the board:
   3 (infield entry), 3 (bottom-left), 7 (top-left), 4 (right hairpin). */
const TRACK_MONTJUIC = defineTrack({
  key:"montjuic",
  brief:"A short parkland blast of only 54 spaces. The corners arrive quickly and there is very little road between them in which to cool the Heat back out.",
  name:"Montjuic", spaces:54, defaultLaps:2, heat:6, stress:3,
  image:"tracks/Montjuic.jpeg", imgW:1200, imgH:800,
  eyebrow:"Spainish International Grand Prix",
  subtitle:"Barcelona",
  tagline:"Spanish International Grand Prix",
  terrain:"oval",
  plate:{ x:875, y:100, w:300, h:115, rot:-2, title:"SPANISH GRAND PRIX", sub:"MONTJUïC",
          titleColor:"#173a2a", subColor:"#0f5132" },
  panel:{x:698,y:82}, podium:{x:105,y:556},
  weatherTok:{x:709,y:89,r:38},

  /* Corners — `at` is the space the corner line sits BEFORE, `limit` the speed you
     must be at or under crossing it. `chicane:n` groups consecutive corner lines
     into a chicane: same speed limit, blue kerbs, and ONE Road Condition token for
     the whole thing — a corner token modifies every line in it, a sector token
     modifies the sector AFTER it. Each line is still checked separately. */
    corners:[ {at:9, limit:2, bx:155, by:51}, {at:14, limit:3, bx:363, by:364}, {at:20, limit:4, bx:50, by:311}, {at:28, limit:3, bx:232, by:729}, {at:36, limit:6, bx:708, by:595} ],
  /* Gravel — space indices whose inner (Race Line) Spot and/or outer Spot is gravel.
     A space in both lists has gravel right across it. Rule: at the end of your turn
     (step 9), if your car is on a gravel Spot you must pay 1 Heat if you have any in
     the Engine; if the Engine is empty, ignore it. */
  gravel:{ inner:[], outer:[] },

  /* Tunnels — inclusive runs of Spaces (from > to means the run wraps past space 0).
     Rule: while a car is on a tunnel Space its player cannot discard from hand, and
     this beats any Event / Upgrade / Road Condition that would otherwise let them.
     Cooldown (card goes to the Engine) and Scrap (card comes off the top of the
     draw deck) are not discards, so both are still allowed inside a tunnel. */
  tunnels:[  ],

  legendsLine:6,
  spacePts:[[660,266],[621,229],[579,181],[528,151],[466,120],[410,100],[351,83],[292,70],[232,78],[157,109],[232,144],[277,214],[298,251],[326,317],[302,368],[238,344],[214,287],[178,245],[133,254],[103,311],[81,362],[96,410],[160,444],[202,474],[264,500],[272,554],[273,614],[274,675],[283,745],[353,742],[416,745],[473,742],[543,742],[600,742],[642,697],[681,644],[739,646],[796,673],[850,703],[905,715],[965,691],[1007,655],[1052,612],[1097,558],[1122,501],[1120,441],[1092,388],[1050,347],[994,329],[935,341],[874,350],[814,356],[748,341],[703,300]]
});
