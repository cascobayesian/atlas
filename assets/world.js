// The world in the Equal Earth projection (Šavrič, Patterson & Jenny, 2018), as first drawn on 6 November:
// light land on blue water, Natural Earth 1:50m country outlines (assets/world-50m.json, via world-atlas), a 15° graticule.
//   drawWorld(svgElement, { hover: true, tip, places: [{ key, title, url }], fitted: [{ name, key, title, k }], onFit }) -> Promise
// places: countries with a fit, drawn over the land in their blocs' colours (a GeoJSON of dissolved blocs with
// properties b, name, color, as realign_2025/model/atlas_export_ca.R writes for Canada); click or Enter opens the
// country's panels (window.atlasOpen, assets/us_map.js).
window.drawWorld = (el, opts = {}) => fetch("assets/world-50m.json").then(r => r.json()).then(WORLD => {
  const W = 1000, svg = d3.select(el);
  const proj = d3.geoEqualEarth().fitWidth(W - 12, { type: "Sphere" }), t = proj.translate();   // the map's full width, 6 px margins
  proj.translate([t[0] + 6, t[1] + 6]); const path = d3.geoPath(proj);
  const H = Math.ceil(path.bounds({ type: "Sphere" })[1][1] + 6);
  svg.attr("viewBox", `0 0 ${W} ${H}`);
  svg.append("path").datum({ type: "Sphere" }).attr("class", "wm-sphere").attr("d", path);
  svg.append("path").datum(d3.geoGraticule().step([15, 15])()).attr("class", "wm-grat").attr("d", path);
  const land = svg.append("g").selectAll("path").data(topojson.feature(WORLD, WORLD.objects.countries).features).join("path")
    .attr("class", "wm-land").attr("d", path);
  // fitted: countries with a finished BBMM or DMM fit but no interactive panels yet, shaded slate gold; click or Enter
  // calls opts.onFit(country) to show its bloc map and PCA figure. Matched on the Natural Earth name.
  const fitBy = new Map((opts.fitted || []).map(c => [c.name, c]));
  land.filter(d => fitBy.has(d.properties.name)).classed("wm-fit", true).attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", d => "Show " + fitBy.get(d.properties.name).title)
    .on("click", (e, d) => opts.onFit && opts.onFit(fitBy.get(d.properties.name)))
    .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opts.onFit && opts.onFit(fitBy.get(d.properties.name)); } });
  // GeoJSON (RFC 7946) winds outer rings anticlockwise; d3's spherical paths want them clockwise
  const rewind = g => ({ ...g, coordinates: g.type === "Polygon" ? g.coordinates.map(r => r.slice().reverse())
    : g.coordinates.map(p => p.map(r => r.slice().reverse())) });
  const cur = new URLSearchParams(location.search).get("place");
  const placed = Promise.all((opts.places || []).map(pl => fetch(pl.url).then(r => r.json()).then(fc => {
    const g = svg.append("g").attr("class", "wm-place").attr("data-state", pl.key).attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", "Show " + pl.title).classed("active", cur === pl.key);
    g.append("title").text(pl.title);
    g.selectAll("path").data(fc.features).join("path").attr("d", f => path({ ...f, geometry: rewind(f.geometry) }))
      .attr("fill", f => f.properties.color);
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
  svg.append("path").datum({ type: "Sphere" }).attr("class", "wm-edge").attr("d", path);
  placed.then(() => svg.select(".wm-edge").raise());
  if (opts.hover) {
    const tip = opts.tip, box = el.parentElement;
    land.on("pointermove", (e, d) => {
      const r = box.getBoundingClientRect();
      const fc = fitBy.get(d.properties.name);
      tip.textContent = fc ? `${fc.title}: ${fc.k} blocs` : d.properties.name; tip.hidden = false;
      tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top) + "px";
    }).on("pointerleave", () => { tip.hidden = true; });
  }
});
