// The world in the Equal Earth projection (Šavrič, Patterson & Jenny, 2018), as first drawn on 6 November:
// light land on blue water, Natural Earth 1:50m country outlines (assets/world-50m.json, via world-atlas), a 15° graticule.
// Drag sideways (or use the arrow keys on the map) to turn the globe about its axis.
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
  // turning: drag sideways to change the central meridian; a drag of more than 3 px is not a click (d3.drag swallows it)
  let frame = 0;
  const turn = dl => { const r = proj.rotate(); proj.rotate([((r[0] + dl + 540) % 360) - 180, 0]);
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; redraw(); }); };
  svg.classed("wm-turn", true).call(d3.drag().clickDistance(3)
    .on("start", () => { svg.classed("dragging", true); if (opts.tip) opts.tip.hidden = true; })
    .on("drag", e => { const k = W / el.getBoundingClientRect().width; turn(e.dx * k * 0.36); })
    .on("end", () => svg.classed("dragging", false)));
  svg.attr("tabindex", 0).on("keydown.turn", e => { if (e.target !== el) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); turn(e.key === "ArrowLeft" ? 10 : -10); } });
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
