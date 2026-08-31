/* ===== TEMP DIAGNOSTIC (remove later): shows any JS error on screen ===== */
(function(){
  let lastTap = "(none yet)";
  const describe = el => {
    if(!el || !el.tagName) return String(el);
    let s = el.tagName.toLowerCase();
    if(el.id) s += "#"+el.id;
    const cls = (el.className && el.className.baseVal!==undefined) ? el.className.baseVal : el.className;
    if(cls) s += "."+String(cls).trim().split(/\s+/).slice(0,2).join(".");
    return s;
  };
  addEventListener("pointerdown", e => { lastTap = describe(e.target); }, true);
  addEventListener("touchstart",  e => { lastTap = describe(e.target); }, true);
  function show(kind, msg, stack){
    let box = document.getElementById("errtrap");
    if(!box){
      box = document.createElement("div");
      box.id = "errtrap";
      box.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;"+
        "background:#7a1010;color:#fff;font:12px/1.45 monospace;padding:10px 12px;"+
        "border-radius:10px;max-height:45vh;overflow:auto;white-space:pre-wrap;"+
        "box-shadow:0 6px 24px rgba(0,0,0,.5)";
      box.addEventListener("click", ev => { ev.stopPropagation(); }, true);
      const x = document.createElement("div");
      x.textContent = "✕ tap here to dismiss";
      x.style.cssText = "text-align:right;opacity:.8;margin-bottom:4px";
      x.onclick = () => box.remove();
      box.appendChild(x);
      (document.body||document.documentElement).appendChild(box);
    }
    const d = document.createElement("div");
    d.style.marginTop = "6px";
    d.textContent = kind+": "+msg+"\nlast tap: "+lastTap+(stack? "\n"+String(stack).split("\n").slice(0,6).join("\n") : "");
    box.appendChild(d);
  }
  addEventListener("error", e => {
    if(!e.message && !e.error) return;             // resource-load noise (missing img/audio)
    show("ERROR", e.message || (e.error && e.error.message) || "(no message)", e.error && e.error.stack);
  }, true);
  addEventListener("unhandledrejection", e => {
    const r = e.reason || {};
    if(String(r.name)==="NotAllowedError" || String(r.name)==="AbortError") return; // autoplay noise
    show("PROMISE", r.message || String(r), r.stack);
  });
})();
