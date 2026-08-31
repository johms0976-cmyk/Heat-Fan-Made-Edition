/* =====================================================================
   TRACK REGISTRY — must load BEFORE any file in tracks/
   ===================================================================== */
"use strict";
/* ---- Track registry --------------------------------------------------
   defineTrack() is the ONE place a circuit plugs into the game. Give it a
   track object (with a unique `key` and a `brief` for the picker modal) and
   it is registered in TRACKS and appears as a card on the track-select
   screen automatically. Picker order = the order defineTrack() is called,
   i.e. the order the blocks appear in this file.

   To add a new board: paste a single `const TRACK_X = defineTrack({...});`
   block anywhere after this point. Nothing else to update. */
const TRACKS = {};
function defineTrack(t){
  if(TRACKS[t.key]) console.warn("defineTrack: duplicate key '"+t.key+"' — overwriting");
  TRACKS[t.key] = t;
  return t;
}
