// The world in the Equal Earth projection (Šavrič, Patterson & Jenny, 2018), as first drawn on 6 November:
// light land on blue water, Natural Earth 1:50m country outlines (assets/world-50m.json, via world-atlas), a 15° graticule.
// Drag to move the centre point; wheel, pinch, double-click or the on-map buttons to zoom (arrow keys and +/- too).
//   drawWorld(svgElement, { hover: true, tip, fitted: [{ name, key, title, k, k4, open }], onFit, started: [name],
//                           quality: { name: grade }, places: [{ key, title, url }] }) -> Promise
// Colouring, all matched on the Natural Earth name:
//   fitted: a finished BBMM or DMM fit: the country is drawn as its K = 4 blocs in translucent greys (k4: a GeoJSON of
//     dissolved blocs with properties b = 1-4, largest first, n, share; assets/world_k4/<key>.json); click or Enter
//     calls c.open() if given (Canada opens its interactive panels) or else opts.onFit(c) (the bloc map and PCA figure).
//   started: work begun (data pulled, maps made) but no fit yet: solid grey.
//   quality: { name: 1-4 } the grade of the available sub-national election records from the regional surveys, on a
//     four-step sequential scale; countries in none of these stay plain.
// places: the older interactive layer (a GeoJSON of blocs with a color property), still supported.
window.drawWorld = (el, opts = {}) => fetch("assets/world-50m.json").then(r => r.json()).then(WORLD => {
  const W = 1000, svg = d3.select(el);
  const proj = d3.geoEqualEarth().fitWidth(W - 12, { type: "Sphere" }), t = proj.translate();   // the map's full width, 6 px margins
  proj.translate([t[0] + 6, t[1] + 6]); const path = d3.geoPath(proj);
  const H = Math.ceil(path.bounds({ type: "Sphere" })[1][1] + 6);
  svg.attr("viewBox", `0 0 ${W} ${H}`);
  const sphere = svg.append("path").datum({ type: "Sphere" }).attr("class", "wm-sphere");
  const grat = svg.append("path").datum(d3.geoGraticule().step([15, 15])()).attr("class", "wm-grat");
  const land = svg.append("g").selectAll("path").data(topojson.feature(WORLD, WORLD.objects.countries).features).join("path")
    .attr("class", "wm-land");
  const fitBy = new Map((opts.fitted || []).map(c => [c.name, c]));
  const started = new Set(opts.started || []), quality = opts.quality || {};
  const openFit = c => c.open ? c.open() : opts.onFit && opts.onFit(c);
  land.each(function (d) { const n = d.properties.name;
    this.setAttribute("class", "wm-land" + (fitBy.has(n) ? " wm-fit" : started.has(n) ? " wm-some" : quality[n] ? " wm-q" + quality[n] : "")); });
  land.filter(d => fitBy.has(d.properties.name)).attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", d => "Show " + fitBy.get(d.properties.name).title)
    .on("click", (e, d) => openFit(fitBy.get(d.properties.name)))
    .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFit(fitBy.get(d.properties.name)); } });
  // GeoJSON (RFC 7946) winds outer rings anticlockwise; d3's spherical paths want them clockwise
  const rewind = g => ({ ...g, coordinates: g.type === "Polygon" ? g.coordinates.map(r => r.slice().reverse())
    : g.coordinates.map(p => p.map(r => r.slice().reverse())) });
  const edge = svg.append("path").datum({ type: "Sphere" }).attr("class", "wm-edge");
  const placeGroups = [];
  const redraw = () => { sphere.attr("d", path); grat.attr("d", path); land.attr("d", path); edge.attr("d", path);
    placeGroups.forEach(g => g.selectAll("path").attr("d", path)); };
  redraw();
  const cur = new URLSearchParams(location.search).get("place");
  const placed = Promise.all((opts.places || []).map(pl => fetch(pl.url).then(r => r.json()).then(fc => {
    const g = svg.append("g").attr("class", "wm-place").attr("data-state", pl.key).attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", "Show " + pl.title).classed("active", cur === pl.key);
    g.append("title").text(pl.title);
    g.selectAll("path").data(fc.features.map(f => ({ ...f, geometry: rewind(f.geometry) }))).join("path").attr("d", path)
      .attr("fill", f => f.properties.color);
    placeGroups.push(g);
    const go = () => { g.classed("active", true); if (window.atlasOpen) window.atlasOpen(pl.key); else location.search = "?place=" + pl.key; };
    g.on("click", go).on("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    if (opts.tip) {
      const tip = opts.tip, box = el.parentElement;
      g.on("pointermove", (e, d) => { const f = e.target.__data__, r = box.getBoundingClientRect();
        tip.textContent = f && f.properties ? `${pl.title}: ${f.properties.name}` : pl.title; tip.hidden = false;
        tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top) + "px"; })
        .on("pointerleave", () => { tip.hidden = true; });
    }
  })));
  // K = 4 bloc layers of the fitted countries: greys of rising opacity, b = 1 (the largest bloc) lightest
  const K4_ALPHA = [0.2, 0.38, 0.56, 0.74];
  const k4done = Promise.all((opts.fitted || []).filter(c => c.k4).map(c => fetch(c.k4).then(r => r.ok ? r.json() : null).then(fc => {
    if (!fc) return;
    const g = svg.append("g").attr("class", "wm-k4").attr("data-country", c.key);
    g.append("title").text(c.title);
    g.selectAll("path").data(fc.features.map(f => ({ ...f, geometry: rewind(f.geometry) }))).join("path").attr("d", path)
      .attr("fill-opacity", f => K4_ALPHA[(f.properties.b || 1) - 1]);
    land.filter(d => d.properties.name === c.name).classed("wm-has-k4", true);
    placeGroups.push(g);
    g.on("click", () => openFit(c));
    if (opts.tip) {
      const tip = opts.tip, box = el.parentElement;
      g.on("pointermove", e => { if (svg.classed("dragging")) return; const f = e.target.__data__, r = box.getBoundingClientRect();
        tip.textContent = `${c.title}: bloc ${f.properties.b} of 4 (K = 4), ${Math.round(100 * f.properties.share)}% of units`;
        tip.hidden = false; tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top) + "px"; })
        .on("pointerleave", () => { tip.hidden = true; });
    }
  }).catch(() => {})));
  Promise.all([placed, k4done]).then(() => edge.raise());
  // moving the centre: drag to move the map's centre point (longitude and latitude, the projection's rotation); a drag of
  // more than 3 px is not a click (d3.drag swallows it). Zoom: wheel or pinch about the pointer, double-click, the
  // +/- buttons or keys; the projection is re-scaled about the map's centre, so line widths stay fine at any zoom.
  const S0 = proj.scale(), KMAX = 16; let k = 1, frame = 0;
  const draw = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; redraw(); }); };
  const setCentre = (lam, phi) => { proj.rotate([((lam + 540) % 360) - 180, Math.max(-90, Math.min(90, phi))]); draw(); };
  const turn = (dl, dp) => { const r = proj.rotate(); setCentre(r[0] + dl, r[1] + dp); };
  const px = () => W / el.getBoundingClientRect().width;                       // viewBox units per screen pixel
  const zoomTo = (k1, at) => {                                                 // at: viewBox point to hold still, or the centre
    k1 = Math.max(1, Math.min(KMAX, k1)); const p0 = at && proj.invert(at);
    k = k1; proj.scale(S0 * k);
    if (p0) { const p1 = proj.invert(at); if (p1 && isFinite(p1[0])) turn(p1[0] - p0[0], p1[1] - p0[1]); }
    if (k === 1) setCentre(proj.rotate()[0], 0);                               // fully out: back to an upright world
    draw(); };
  const ptr = e => { const r = el.getBoundingClientRect(); return [(e.clientX - r.left) * px(), (e.clientY - r.top) * px()]; };
  svg.classed("wm-turn", true).call(d3.drag().clickDistance(3).filter(e => !e.button && !(e.touches && e.touches.length > 1))
    .on("start", () => { svg.classed("dragging", true); if (opts.tip) opts.tip.hidden = true; })
    .on("drag", e => { const d = 0.36 * px() / k; turn(e.dx * d, -e.dy * d); })
    .on("end", () => svg.classed("dragging", false)));
  el.addEventListener("wheel", e => { e.preventDefault(); zoomTo(k * Math.pow(2, -e.deltaY * (e.deltaMode ? 0.05 : 0.002)), ptr(e)); },
    { passive: false });
  svg.on("dblclick.zoom", e => { e.preventDefault(); zoomTo(k * (e.shiftKey ? 0.5 : 2), ptr(e)); });
  let pinch = null;                                                            // two-finger pinch on touch screens
  el.addEventListener("touchstart", e => { if (e.touches.length === 2) { const [a, b] = e.touches;
    pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), k }; } }, { passive: true });
  el.addEventListener("touchmove", e => { if (pinch && e.touches.length === 2) { e.preventDefault(); const [a, b] = e.touches;
    zoomTo(pinch.k * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d,
      ptr({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 })); } }, { passive: false });
  el.addEventListener("touchend", e => { if (e.touches.length < 2) pinch = null; });
  svg.attr("tabindex", 0).on("keydown.turn", e => { if (e.target !== el) return;
    const st = 10 / k, keys = { ArrowLeft: [st, 0], ArrowRight: [-st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] };
    if (keys[e.key]) { e.preventDefault(); turn(...keys[e.key]); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomTo(k * 1.5); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomTo(k / 1.5); }
    else if (e.key === "0") { e.preventDefault(); reset(); } });
  const reset = () => { k = 1; proj.scale(S0); setCentre(0, 0); };
  // on-map controls: zoom in, zoom out, reset
  const ctl = d3.select(el.parentElement).append("div").attr("class", "wm-ctl");
  [["+", "Zoom in", () => zoomTo(k * 1.5)], ["−", "Zoom out", () => zoomTo(k / 1.5)], ["↺", "Reset the view", reset]]
    .forEach(([t, l, f]) => ctl.append("button").attr("type", "button").attr("aria-label", l).attr("title", l).text(t).on("click", f));
  if (opts.hover) {
    const tip = opts.tip, box = el.parentElement;
    land.on("pointermove", (e, d) => {
      if (svg.classed("dragging")) return;
      const r = box.getBoundingClientRect(), n = d.properties.name, fc = fitBy.get(n);
      const Q = ["", "poor", "limited", "good", "excellent"];
      tip.textContent = fc ? `${fc.title}: blocs fitted` : started.has(n) ? `${n}: work under way, no blocs yet`
        : quality[n] ? `${n}: election records ${Q[quality[n]]}` : n;
      tip.hidden = false; tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top) + "px";
    }).on("pointerleave", () => { tip.hidden = true; });
  }
});
