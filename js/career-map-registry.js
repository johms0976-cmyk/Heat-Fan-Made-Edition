/* =====================================================================
   CAREER MAP REGISTRY — must load BEFORE any file in data/career-maps/
   Each map file calls defineCareerMap({...}) and appends itself here,
   in load order, which is the order they appear on the Career screen.
   ===================================================================== */
"use strict";
const CAREER_PRESETS = [];
function defineCareerMap(m){
  if(!m || !m.key){ console.warn("defineCareerMap: map has no key", m); return m; }
  if(CAREER_PRESETS.some(p=>p.key===m.key)) console.warn("defineCareerMap: duplicate key '"+m.key+"'");
  CAREER_PRESETS.push(m);
  return m;
}
