// The world in the Equal Earth projection (Šavrič, Patterson & Jenny, 2018), as first drawn on 6 November:
// light land on blue water, Natural Earth 1:50m country outlines (assets/world-50m.json, via world-atlas), a 15° graticule.
// Drag to move the centre point; wheel, pinch, double-click or the on-map buttons to zoom (arrow keys and +/- too).
//   drawWorld(svgElement, { hover: true, tip, places: [{ key, title, url }], fitted: [{ name, key, title, k }], onFit,
//                           started: [name], planned: [name] }) -> Promise
// places: countries with interactive panels, drawn over the land in their blocs' colours (a GeoJSON of dissolved blocs
// with properties b, name, color, as realign_2025/model/atlas_export_ca.R writes for Canada); click or Enter opens the
// country's panels (window.atlasOpen, assets/us_map.js).
// fitted: a finished BBMM or DMM fit with a bloc map and/or PCA figure, shaded slate gold; click or Enter calls
// opts.onFit(country). started: work begun (data, alignment) but no bloc maps yet, light green. planned: a folder but
// no work yet, dark grey. All matched on the Natural Earth name.
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
  const started = new Set(opts.started || []), planned = new Set(opts.planned || []);
  land.classed("wm-some", d => started.has(d.properties.name)).classed("wm-none", d => planned.has(d.properties.name));
  land.filter(d => fitBy.has(d.properties.name)).classed("wm-fit", true).attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", d => "Show " + fitBy.get(d.properties.name).title)
    .on("click", (e, d) => opts.onFit && opts.onFit(fitBy.get(d.properties.name)))
    .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opts.onFit && opts.onFit(fitBy.get(d.properties.name)); } });
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
  placed.then(() => edge.raise());
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
      tip.textContent = fc ? `${fc.title}: ${fc.k} blocs` : started.has(n) ? `${n}: under way, no bloc maps yet`
        : planned.has(n) ? `${n}: planned` : n;
      tip.hidden = false; tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top) + "px";
    }).on("pointerleave", () => { tip.hidden = true; });
  }
});
