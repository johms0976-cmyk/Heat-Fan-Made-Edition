/* =====================================================================
   CHAMPIONSHIP CUPS — edit this file to change/add seasons.
   A cup is an ordered list of four track keys (see tracks/*.js).
   Loads BEFORE js/game.js.
   ===================================================================== */
"use strict";
/* ---------------- championship cups
   A cup is just an ordered list of four track keys. Base Game, Expansions and
   Fan Made are the fixed cups; Custom lets the player pick any four circuits themselves.
   If a cup names a circuit that isn't built yet (Kidney), the cup opens in the
   builder with the tracks that DO exist locked in, so a stand-in can be chosen. */
const CUP_RACES = 4;
const CUPS = [
  { key:"og", name:"Base Game", icon:"🏆",
    blurb:"The original mother of all cups.",
    tracks:["usa","italy","britain","france"] },
  { key:"expansion", name:"First two Expansions", icon:"🛞",
    blurb:"Circuits from the Heavy Rain and Tunnel Vision expansions.",
    tracks:["mexico","japan","spain","dutch"] },
  { key:"pissed", name:"Fan Made", icon:"🍺",
    blurb:"Street circuits, stone walls and no room for error.",
    tracks:["silverrock","pukekohe","montjuic","monaco"] },
  { key:"custom", name:"Custom Cup",    icon:"🔧",
    blurb:"Build your own season — pick any four circuits, in any order.",
    tracks:null }
];
