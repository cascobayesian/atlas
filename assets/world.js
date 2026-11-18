// The world on an orthographic globe: Natural Earth 1:50m country outlines (assets/world-50m.json, via world-atlas),
// a 15° graticule. The globe turns slowly until it is touched; drag to turn it (longitude and latitude); Ctrl/Cmd-wheel,
// pinch, double-click or the on-map buttons to zoom, arrow keys and +/-/0 on the focused map.
//   drawWorld(svgElement, { hover: true, tip, fitted: [{ name, key, title, k4, open }], onFit, started: [name],
//                           quality: { name: grade }, us: { states: [name], open } }) -> Promise
// Colouring, matched on the Natural Earth name:
//   fitted: a finished BBMM or DMM fit, drawn as its K = 4 blocs in translucent slate pink (k4: a GeoJSON of dissolved
//     blocs with properties b = 1-4, largest first, n, share; assets/world_k4/<key>.json); click or Enter calls c.open()
//     if given (Canada opens its interactive panels) or else opts.onFit(c) (the bloc map and PCA figure).
//   us: the United States, its states with atlas blocs (us.states, us-atlas names) in slate pink; click opens us.open().
//   started: work begun (data pulled, maps made) but no fit yet: solid grey.
//   quality: { name: 1-4 } the grade of the available sub-national election records from the regional surveys, from red
//     (poor: not usable) to green (excellent: ready to go); countries in none of these stay plain.
window.drawWorld = (el, opts = {}) => Promise.all([
  fetch("assets/world-50m.json").then(r => r.json()),
  opts.us ? fetch("https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json").then(r => r.json()).catch(() => null) : null
]).then(([WORLD, USA]) => {
  const W = 600, R0 = 288, ROT0 = [20, -28], svg = d3.select(el);
  const proj = d3.geoOrthographic().scale(R0).translate([W / 2, W / 2]).rotate(ROT0).clipAngle(90).precision(0.4);
  const path = d3.geoPath(proj);
  svg.attr("viewBox", `0 0 ${W} ${W}`);
  const shade = svg.append("defs").append("radialGradient").attr("id", "wm-shade").attr("cx", "38%").attr("cy", "32%").attr("r", "75%");
  shade.append("stop").attr("offset", "0%").attr("stop-color", "#d3e8f4");
  shade.append("stop").attr("offset", "100%").attr("stop-color", "#8dbcd9");
  const sphere = svg.append("path").datum({ type: "Sphere" }).attr("class", "wm-sphere").attr("fill", "url(#wm-shade)");
  const grat = svg.append("path").datum(d3.geoGraticule().step([15, 15])()).attr("class", "wm-grat");
  const land = svg.append("g").selectAll("path").data(topojson.feature(WORLD, WORLD.objects.countries).features).join("path");
  const fitBy = new Map((opts.fitted || []).map(c => [c.name, c]));
  const started = new Set(opts.started || []), quality = opts.quality || {};
  const US = "United States of America";
  const openFit = c => c.open ? c.open() : opts.onFit && opts.onFit(c);
  land.each(function (d) { const n = d.properties.name;
    this.setAttribute("class", "wm-land" + (fitBy.has(n) || (opts.us && n === US) ? " wm-fit" : started.has(n) ? " wm-some"
      : quality[n] ? " wm-q" + quality[n] : "")); });
  const keyGo = f => e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f(); } };
  land.filter(d => fitBy.has(d.properties.name)).attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", d => "Show " + fitBy.get(d.properties.name).title)
    .on("click", (e, d) => openFit(fitBy.get(d.properties.name)))
    .each(function (d) { d3.select(this).on("keydown", keyGo(() => openFit(fitBy.get(d.properties.name)))); });
  // GeoJSON (RFC 7946) winds outer rings anticlockwise; d3's spherical paths want them clockwise
  const rewind = g => ({ ...g, coordinates: g.type === "Polygon" ? g.coordinates.map(r => r.slice().reverse())
    : g.coordinates.map(p => p.map(r => r.slice().reverse())) });
  const layers = [];   // groups whose paths are re-projected on every turn
  const tip = opts.tip, box = el.parentElement;
  const showTip = (e, text) => { if (!tip || svg.classed("dragging")) return; const r = box.getBoundingClientRect();
    tip.textContent = text; tip.hidden = false; tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top) + "px"; };
  const hideTip = () => { if (tip) tip.hidden = true; };
  const edge = svg.append("path").datum({ type: "Sphere" }).attr("class", "wm-edge");
  // the United States: its states, the ones in the atlas in slate pink
  if (USA && opts.us) {
    const done = new Set(opts.us.states || []);
    const g = svg.insert("g", ".wm-edge").attr("class", "wm-us").attr("tabindex", 0).attr("role", "button").attr("aria-label", "Show the United States");
    g.selectAll("path").data(topojson.feature(USA, USA.objects.states).features).join("path")
      .attr("class", d => done.has(d.properties.name) ? "done" : null);
    g.on("click", () => opts.us.open && opts.us.open()).on("keydown", keyGo(() => opts.us.open && opts.us.open()))
      .on("pointermove", e => { const d = e.target.__data__;
        showTip(e, d && d.properties ? `${d.properties.name}: ${done.has(d.properties.name) ? "voting blocs in the atlas" : "not yet"}` : "United States"); })
      .on("pointerleave", hideTip);
    layers.push(g);
  }
  // K = 4 bloc layers of the fitted countries: slate pink of rising opacity, b = 1 (the largest bloc) palest
  const K4_ALPHA = [0.3, 0.5, 0.7, 0.9];
  const k4done = Promise.all((opts.fitted || []).filter(c => c.k4).map(c => fetch(c.k4).then(r => r.ok ? r.json() : null).then(fc => {
    if (!fc) return;
    const g = svg.insert("g", ".wm-edge").attr("class", "wm-k4").attr("data-country", c.key);
    g.selectAll("path").data(fc.features.map(f => ({ ...f, geometry: rewind(f.geometry) }))).join("path").attr("d", path)
      .attr("fill-opacity", f => K4_ALPHA[(f.properties.b || 1) - 1]);
    land.filter(d => d.properties.name === c.name).classed("wm-has-k4", true);
    layers.push(g);
    g.on("click", () => openFit(c))
      .on("pointermove", e => { const f = e.target.__data__;
        showTip(e, `${c.title}: bloc ${f.properties.b} of 4, ${Math.round(100 * f.properties.share)}% of units`); })
      .on("pointerleave", hideTip);
  }).catch(() => {})));
  const redraw = () => { sphere.attr("d", path); grat.attr("d", path); land.attr("d", path); edge.attr("d", path);
    layers.forEach(g => g.selectAll("path").attr("d", path)); };
  redraw();
  if (opts.hover) {
    const Q = ["", "poor: not usable", "limited", "good", "excellent: ready to go"];
    land.on("pointermove", (e, d) => { const n = d.properties.name, fc = fitBy.get(n);
      showTip(e, fc ? `${fc.title}: blocs fitted` : started.has(n) ? `${n}: work under way` : quality[n] ? `${n}: election records ${Q[quality[n]]}` : n);
    }).on("pointerleave", hideTip);
  }
  // turning and zooming: a drag turns the globe by the angle it covers on the sphere (a drag of more than 3 px is not a
  // click); zoom re-scales the projection, so line widths stay fine at any zoom
  const KMAX = 8; let k = 1, frame = 0, spin = null;
  const draw = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; redraw(); }); };
  const setRot = (lam, phi) => { proj.rotate([((lam + 540) % 360) - 180, Math.max(-90, Math.min(90, phi)), 0]); draw(); };
  const turn = (dl, dp) => { const r = proj.rotate(); setRot(r[0] + dl, r[1] + dp); };
  const px = () => W / el.getBoundingClientRect().width;
  const stopSpin = () => { if (spin) { spin.stop(); spin = null; } };
  const zoomTo = (k1, at) => { stopSpin(); k1 = Math.max(1, Math.min(KMAX, k1)); const p0 = at && proj.invert(at);
    k = k1; proj.scale(R0 * k);
    if (p0) { const p1 = proj.invert(at); if (p1 && isFinite(p1[0])) turn(p1[0] - p0[0], p1[1] - p0[1]); }
    draw(); };
  const ptr = e => { const r = el.getBoundingClientRect(); return [(e.clientX - r.left) * px(), (e.clientY - r.top) * px()]; };
  svg.classed("wm-turn", true).call(d3.drag().clickDistance(3).filter(e => !e.button && !(e.touches && e.touches.length > 1))
    .on("start", () => { stopSpin(); svg.classed("dragging", true); hideTip(); })
    .on("drag", e => { const d = 180 / Math.PI / (R0 * k) * px(); turn(e.dx * d, -e.dy * d); })
    .on("end", () => svg.classed("dragging", false)));
  // the wheel zooms only with Ctrl or Cmd held (a trackpad pinch arrives as a Ctrl-wheel), so the page still scrolls past
  el.addEventListener("wheel", e => { if (!e.ctrlKey && !e.metaKey) { if (opts.onWheelHint) opts.onWheelHint(); return; }
    e.preventDefault(); zoomTo(k * Math.pow(2, -e.deltaY * (e.deltaMode ? 0.05 : 0.01)), ptr(e)); }, { passive: false });
  svg.on("dblclick.zoom", e => { e.preventDefault(); zoomTo(k * (e.shiftKey ? 0.5 : 2), ptr(e)); });
  let pinch = null;
  el.addEventListener("touchstart", e => { if (e.touches.length === 2) { const [a, b] = e.touches;
    pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), k }; } }, { passive: true });
  el.addEventListener("touchmove", e => { if (pinch && e.touches.length === 2) { e.preventDefault(); const [a, b] = e.touches;
    zoomTo(pinch.k * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d,
      ptr({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 })); } }, { passive: false });
  el.addEventListener("touchend", e => { if (e.touches.length < 2) pinch = null; });
  const reset = () => { stopSpin(); k = 1; proj.scale(R0); setRot(...ROT0); };
  svg.attr("tabindex", 0).on("keydown.turn", e => { if (e.target !== el) return; stopSpin();
    const st = 10 / k, keys = { ArrowLeft: [st, 0], ArrowRight: [-st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] };
    if (keys[e.key]) { e.preventDefault(); turn(...keys[e.key]); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomTo(k * 1.5); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomTo(k / 1.5); }
    else if (e.key === "0") { e.preventDefault(); reset(); } });
  const ctl = d3.select(box).append("div").attr("class", "wm-ctl");
  [["+", "Zoom in", () => zoomTo(k * 1.5)], ["−", "Zoom out", () => zoomTo(k / 1.5)], ["↺", "Reset the view", reset]]
    .forEach(([t, l, f]) => ctl.append("button").attr("type", "button").attr("aria-label", l).attr("title", l).text(t).on("click", f));
  // a slow turn (6° a second) until the globe is touched; it waits while the pointer is over the globe, and never runs
  // for readers who ask for reduced motion
  if (!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    let hover = false, last = null;
    el.addEventListener("pointerenter", () => { hover = true; }); el.addEventListener("pointerleave", () => { hover = false; last = null; });
    spin = d3.timer(t => { if (hover || document.hidden) { last = null; return; } if (last != null) turn((t - last) * 0.006, 0); last = t; });
  }
  // turn a country to the front (used when a card below the globe opens a country)
  window.worldFlyTo = name => { const f = land.data().find(d => d.properties.name === name); if (!f) return; stopSpin();
    const c = d3.geoCentroid(f), r0 = proj.rotate(), i = d3.interpolate([r0[0], r0[1]], [-c[0], -c[1]]);
    d3.transition().duration(900).tween("fly", () => t => { const v = i(t); proj.rotate([v[0], v[1], 0]); redraw(); }); };
  return k4done.then(() => edge.raise());
});
