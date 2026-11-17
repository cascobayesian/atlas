// The world in the Equal Earth projection (Šavrič, Patterson & Jenny, 2018), as first drawn on 6 November:
// light land on blue water, Natural Earth 1:50m country outlines (assets/world-50m.json, via world-atlas), a 15° graticule.
//   drawWorld(svgElement, { hover: true }) -> Promise
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
  svg.append("path").datum({ type: "Sphere" }).attr("class", "wm-edge").attr("d", path);
  if (opts.hover) {
    const tip = opts.tip, box = el.parentElement;
    land.on("pointermove", (e, d) => {
      const r = box.getBoundingClientRect();
      tip.textContent = d.properties.name; tip.hidden = false;
      tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top) + "px";
    }).on("pointerleave", () => { tip.hidden = true; });
  }
});
