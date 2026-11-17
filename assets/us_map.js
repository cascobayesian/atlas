// The US map at the top of the atlas: click (or Enter/Space on) a state or point to open that place's panels below.
// Opening a place reloads the page with ?place=<key>. To make that feel like one motion rather than a jump, the click
// saves the scroll position; the new page comes back at that position (kept hidden until then, so the browser goes on
// showing the old one), and once the place has drawn, atlas.js calls glide() to ease down to its panels.
(() => {
  const KEY = "atlas-scroll";
  const store = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) {} };
  const read = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const params = new URLSearchParams(location.search), cur = params.get("place");

  // open a place, remembering where we are
  const open = key => {
    store(KEY, String(Math.round(scrollY)));
    const u = new URL(location.href); u.searchParams.set("place", key); u.hash = ""; location.href = u.href;
  };
  window.atlasOpen = open;                       // the place picker in atlas.js uses it too

  // come back where we were (the head script hid the page while this was pending)
  const saved = read(KEY); store(KEY, null);
  if (cur) {                                     // unhide the (still empty) panel first, so the page is tall enough
    const ap = document.getElementById("ap"), nm = document.getElementById("ap-name");
    if (ap) ap.hidden = false; if (nm) nm.hidden = false;
    const t = document.querySelector(`.us-hot [data-state="${cur}"] title`);     // the name now; atlas.js confirms it
    if (nm && t && !nm.textContent) nm.textContent = t.textContent;
  }
  if (saved != null && cur) { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; scrollTo(0, +saved); }
  document.documentElement.classList.remove("restoring");

  // ease the page down to an element: easeInOutCubic, about 0.5-1 s by distance; the target is re-measured every
  // frame (the panels are still growing below), and the user's own scrolling cancels it
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.atlasGlide = el => {
    if (!el) return;
    const targetY = () => Math.min(el.getBoundingClientRect().top + scrollY - 8, document.documentElement.scrollHeight - innerHeight);
    if (reduce) { scrollTo(0, targetY()); return; }
    const y0 = scrollY, dist = Math.abs(targetY() - y0); if (dist < 4) return;
    const dur = Math.min(1100, Math.max(700, dist * 0.9));
    let t0 = performance.now(), last = t0;
    let stop = false; const cancel = () => { stop = true; };
    ["wheel", "touchstart", "keydown", "mousedown"].forEach(ev => addEventListener(ev, cancel, { once: true, passive: true }));
    const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    const step = now => {
      if (stop) return;
      if (now - last > 100) t0 += now - last - 16;   // a stalled frame (the panels still drawing) pauses the glide, never jumps it
      last = now;
      const t = Math.min(1, (now - t0) / dur);
      scrollTo(0, y0 + (targetY() - y0) * ease(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // on arrival at a place, start down to it at once: the panels load, draw and fade in during and after the glide
  if (cur && document.getElementById("ap-name")) requestAnimationFrame(() => window.atlasGlide(document.getElementById("ap-name")));

  document.querySelectorAll(".us-hot [data-state]").forEach(el => {
    const key = el.dataset.state;
    el.classList.toggle("active", key === cur);
    const go = () => {
      document.querySelectorAll(".us-hot .active").forEach(a => a.classList.remove("active"));
      document.querySelectorAll(`.us-hot [data-state="${key}"]`).forEach(a => a.classList.add("active"));
      open(key);
    };
    el.addEventListener("click", go);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });
})();
