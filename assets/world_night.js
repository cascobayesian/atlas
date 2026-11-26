// The night globe on the front page (index.html): the atlas on a dark orthographic globe, coloured as the editorial flat map
// (drafts/world_presentation_maps.R, map B): each fitted country in its own hue, its blocs (assets/world_k4/<key>.json,
// b = 1 the largest) from deep (smallest) to pale (largest); countries without a fit translucent grey. A toggle colours
// the countries without a fit by the quality of their election records (assets/world_quality.json, grades 1-4); countries
// with work under way (STARTED) light grey; US states with atlas blocs shaded by their blocs, all in the one US hue; the others grey. Only countries whose
// page has the full template are coloured; other fitted countries are one grey.
// The globe turns slowly only in its base view: a drag, a zoom or a click stops it, the reset button restores the base
// view and the turning. Zoom with the on-map buttons, Ctrl/Cmd-wheel, a pinch or a double-click.
// Country lists from assets/world_countries.js (FITTED, PANELS, US_STATES, STARTED, GRADES). Click a fitted country to
// open its page (country.html?c=<key>), the United States to open us.html.
(() => {
  const ALL = FITTED.concat(PANELS).slice().sort((a, b) => a.title.localeCompare(b.title));
  const US_NAME = "United States of America";
  // one hue per fitted country (HCL degrees), chosen by hand so that neighbouring fitted countries contrast; a country
  // added later without an entry gets a golden-angle hue
  const HUE_FIX = { "Austria": 10, "Germany": 255, "Czechia": 135, "Poland": 45, "Slovakia": 315, "Hungary": 95, "Switzerland": 175,
    "Netherlands": 30, "Croatia": 205, "Bosnia and Herz.": 340, "Serbia": 60, "Romania": 280, "Bulgaria": 160, "Israel": 225,
    "India": 120, "Japan": 0, "Colombia": 300, "Canada": 50, [US_NAME]: 330 };
  const HUE = new Map(ALL.map((c, i) => [c.name, HUE_FIX[c.name] ?? (20 + i * 137.508) % 360]));
  HUE.set(US_NAME, HUE_FIX[US_NAME]);
  const US_PINK = "#e58cb5";                             // every US state with atlas blocs
  // countries whose page has the full template (assets/countries/<key>.json with panels: true) are drawn in their hue;
  // fitted countries not yet brought up to it keep their bloc shading in grey. The US counts as full (its states are).
  const FULL = new Set([US_NAME]);
  const FIT_GREY = "#8f979e";
  const blocColour = (name, b, nb) => {                  // b = 1 largest -> palest; nb blocs
    const t = nb > 1 ? (b - 1) / (nb - 1) : 0;           // 0 largest .. 1 smallest
    if (!FULL.has(name)) return FIT_GREY;                 // fitted, full page to come: one grey, no bloc shading
    return d3.hcl(HUE.get(name), 22 + 48 * t, 90 - 48 * t).formatHex();
  };
  const QCOL = { 4: "#1a9850", 3: "#a8d45a", 2: "#f4a340", 1: "#d7301f" };
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const svgEl = document.getElementById("ng-globe"), tip = document.getElementById("ng-tip"), box = svgEl.parentElement;
  const W = 640, R0 = 300, svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${W}`);
  const proj = d3.geoOrthographic().scale(R0).translate([W / 2, W / 2]).rotate([-15, -32]).clipAngle(90).precision(0.4);
  const path = d3.geoPath(proj);
  const defs = svg.append("defs");
  const sea = defs.append("radialGradient").attr("id", "ng-sea").attr("cx", "40%").attr("cy", "35%").attr("r", "70%");
  sea.append("stop").attr("offset", "0%").attr("stop-color", "#16283a"); sea.append("stop").attr("offset", "100%").attr("stop-color", "#070e17");
  const halo = defs.append("radialGradient").attr("id", "ng-halo");
  halo.append("stop").attr("offset", "86%").attr("stop-color", "#3b7fb3").attr("stop-opacity", 0.35);
  halo.append("stop").attr("offset", "100%").attr("stop-color", "#3b7fb3").attr("stop-opacity", 0);
  const haloC = svg.append("circle").attr("cx", W / 2).attr("cy", W / 2).attr("r", R0 * 1.09).attr("fill", "url(#ng-halo)").attr("class", "ng-halo");
  const sphere = svg.append("path").datum({ type: "Sphere" }).attr("fill", "url(#ng-sea)");
  const grat = svg.append("path").datum(d3.geoGraticule().step([15, 15])()).attr("class", "ng-grat");
  const layers = [];
  let showQuality = false, QUALITY = {};
  const fitBy = new Map(ALL.map(c => [c.name, c]));
  const started = new Set(STARTED.map(c => c.name));
  const showTip = (e, t) => { if (svgEl.classList.contains("dragging")) return; const r = box.getBoundingClientRect();
    tip.textContent = t; tip.hidden = false; tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top) + "px"; };
  const hideTip = () => { tip.hidden = true; };
  let stopSpin = () => {};
  const open = c => { stopSpin(); location.href = `country.html?c=${c.key}`; };
  // US states count as countries: a state with atlas blocs opens its own page (country.html?c=<state key>, data/places.json)
  let STATE_KEY = {};
  fetch("data/places.json").then(r => r.ok ? r.json() : []).then(l => { STATE_KEY = Object.fromEntries(l.map(p => [p.title, p.key])); }).catch(() => {});
  const openState = n => { const k = STATE_KEY[n]; if (!k) return; stopSpin(); location.href = `country.html?c=${k}`; };
  const Q = ["", "poor: not usable", "limited", "good", "excellent: ready to go"];

  Promise.all([
    fetch("assets/world-50m.json").then(r => r.json()),
    fetch("https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json").then(r => r.json()).catch(() => null),
    fetch("assets/world_k4/us_states.json?v=4").then(r => r.ok ? r.json() : null).catch(() => null),
    fetch("assets/world_quality.json").then(r => r.json()).catch(() => ({})),
    Promise.all(ALL.map(c => fetch(c.k4).then(r => r.ok ? r.json() : null).catch(() => null))),
    Promise.all(ALL.map(c => fetch(`assets/countries/${c.key}.json`).then(r => r.ok ? r.json() : null).catch(() => null)))
  ]).then(([WORLD, USA, USB, QUAL, K4, PAGES]) => {
    QUALITY = QUAL;
    ALL.forEach((c, i) => { if (PAGES[i] && PAGES[i].panels) FULL.add(c.name); });
    const countries = topojson.feature(WORLD, WORLD.objects.countries).features;
    const land = svg.append("g").selectAll("path").data(countries).join("path").attr("class", "ng-land")
      .classed("ng-fit", d => fitBy.has(d.properties.name) || d.properties.name === US_NAME);
    const paintLand = () => land.attr("fill", d => {
      const n = d.properties.name;
      if (fitBy.has(n)) return blocColour(n, 1, 4);            // under the bloc layer: the palest step
      if (n === US_NAME) return "rgba(196,205,214,.16)";
      if (started.has(n)) return "#c9d0d6";                     // work under way: light grey
      if (showQuality && QUALITY[n]) return QCOL[QUALITY[n]];
      return "rgba(196,205,214,.16)";
    }).attr("fill-opacity", d => { const n = d.properties.name;
      return started.has(n) ? 0.8 : (showQuality && !fitBy.has(n) && n !== US_NAME && QUALITY[n]) ? 0.55 : 1; });
    paintLand();
    // the United States: every state with atlas blocs in the one US hue, shaded by its blocs; the rest grey
    if (USA) {
      const done = new Set(US_STATES);
      const g = svg.append("g").attr("class", "ng-us");
      g.selectAll("path").data(topojson.feature(USA, USA.objects.states).features).join("path")
        .attr("fill", d => done.has(d.properties.name) ? US_PINK : "#c9d0d6")           // the rest: no bloc analysis yet
        .attr("fill-opacity", d => done.has(d.properties.name) ? 1 : 0.8)
        .attr("stroke", "rgba(5,9,15,.55)").attr("stroke-width", 0.35)
        .style("cursor", d => done.has(d.properties.name) ? "pointer" : "default")
        .on("pointermove", (e, d) => showTip(e, `${d.properties.name}: ${done.has(d.properties.name) ? "voting blocs in the atlas" : "no bloc analysis yet"}`))
        .on("pointerleave", hideTip).on("click", (e, d) => { if (done.has(d.properties.name)) openState(d.properties.name); });
      layers.push(g);
      // each fitted state's blocs, shaded as a country's blocs are, every state in the one US hue (assets/world_k4/us_states.json)
      if (USB) {
        const rw = gm => ({ ...gm, coordinates: gm.type === "Polygon" ? gm.coordinates.map(r => r.slice().reverse())
          : gm.coordinates.map(p => p.map(r => r.slice().reverse())) });
        // a collection of polygons (as the dissolve may leave) drawn as one multipolygon
        const flat = gm => { if (!gm) return null; if (/Polygon$/.test(gm.type)) return gm;
          const ps = (gm.geometries || []).flatMap(x => x.type === "Polygon" ? [x.coordinates] : x.type === "MultiPolygon" ? x.coordinates : []);
          return ps.length ? { type: "MultiPolygon", coordinates: ps } : null; };
        const gb = svg.append("g").attr("class", "ng-usb");
        gb.selectAll("path").data(USB.features.map(f => ({ ...f, geometry: flat(f.geometry) })).filter(f => f.geometry).map(f => ({ ...f, geometry: rw(f.geometry) }))).join("path")
          .attr("fill", f => blocColour(US_NAME, f.properties.b, f.properties.nb)).style("cursor", "pointer")
          .on("pointermove", (e, f) => showTip(e, `${f.properties.state}: bloc ${f.properties.b} of ${f.properties.nb}, ${Math.round(100 * f.properties.share)}% of units`))
          .on("pointerleave", hideTip).on("click", (e, f) => openState(f.properties.state));
        layers.push(gb);
        // the state lines again on top, so neighbouring states stay apart
        const gl = svg.append("path").datum(topojson.mesh(USA, USA.objects.states, (a, b) => a !== b)).attr("class", "ng-us-lines")
          .attr("fill", "none").attr("stroke", "rgba(5,9,15,.55)").attr("stroke-width", 0.45);
        layers.push({ selectAll: () => gl });
      }
    }
    // fitted countries: their blocs
    ALL.forEach((c, i) => { const fc = K4[i]; if (!fc) return;
      const rewind = g => ({ ...g, coordinates: g.type === "Polygon" ? g.coordinates.map(r => r.slice().reverse())
        : g.coordinates.map(p => p.map(r => r.slice().reverse())) });
      const nb = c.kShade || 4;
      const g = svg.append("g").attr("class", "ng-k4").attr("tabindex", 0).attr("role", "link").attr("aria-label", `Open ${c.title}`);
      g.selectAll("path").data(fc.features.map(f => ({ ...f, geometry: rewind(f.geometry) }))).join("path")
        .attr("fill", f => blocColour(c.name, f.properties.b, nb));
      g.on("click", () => open(c)).on("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(c); } })
        .on("pointermove", e => { const f = e.target.__data__;
          showTip(e, FULL.has(c.name) ? `${c.title}: K = ${c.k}; bloc ${f.properties.b} of ${nb}, ${Math.round(100 * f.properties.share)}% of units`
            : `${c.title}: K = ${c.k}; full page to come`); })
        .on("pointerleave", hideTip);
      layers.push(g); });
    // borders between countries above everything; coastlines faint
    const borders = svg.append("path").datum(topojson.mesh(WORLD, WORLD.objects.countries, (a, b) => a !== b)).attr("class", "ng-borders");
    const coast = svg.append("path").datum(topojson.mesh(WORLD, WORLD.objects.countries, (a, b) => a === b)).attr("class", "ng-coast");
    const rim = svg.append("path").datum({ type: "Sphere" }).attr("class", "ng-rim");
    land.on("pointermove", (e, d) => { const n = d.properties.name, c = fitBy.get(n);
      showTip(e, c ? `${c.title}: K = ${c.k}` + (FULL.has(n) ? "" : "; full page to come") : n === US_NAME ? "United States" : started.has(n) ? `${n}: work under way` +
        (QUALITY[n] ? `; records ${Q[QUALITY[n]]}` : "") : QUALITY[n] ? `${n}: election records ${Q[QUALITY[n]]}` : n); })
      .on("pointerleave", hideTip)
      .on("click", (e, d) => { const c = fitBy.get(d.properties.name); if (c) open(c);  });
    const redraw = () => { haloC.attr("r", proj.scale() * 1.09); sphere.attr("d", path); grat.attr("d", path); land.attr("d", path); borders.attr("d", path);
      coast.attr("d", path); rim.attr("d", path); layers.forEach(g => g.selectAll("path").attr("d", path)); };
    redraw();

    // turning: a slow spin (about 2.3 degrees a second) only in the base view; a drag, zoom or click stops it for good,
    // until the reset button restores the base view
    const SPEED = 0.0375, KMAX = 8, BASE = [-15, -32]; let spin = null, last = null;
    const startSpin = () => { if (spin) return; last = null;
      spin = d3.timer(t => { const dt = last === null ? 16 : t - last; last = t;
        const r = proj.rotate(); proj.rotate([r[0] + SPEED * dt / 16, r[1]]); redraw(); }); };
    const pause = () => { if (spin) { spin.stop(); spin = null; } };
    stopSpin = pause;
    startSpin();
    const px = () => W / svgEl.getBoundingClientRect().width;
    d3.select(svgEl).call(d3.drag().clickDistance(3).filter(e => !e.button && !(e.touches && e.touches.length > 1))
      .on("start", () => { pause(); svgEl.classList.add("dragging"); hideTip(); })
      .on("drag", e => { pause(); const r = proj.rotate(), k = 180 / Math.PI / proj.scale() * px();
        proj.rotate([r[0] + e.dx * k, Math.max(-90, Math.min(90, r[1] - e.dy * k))]); redraw(); })
      .on("end", () => svgEl.classList.remove("dragging")));
    // zoom: re-scale the projection (lines keep their width), keeping the point under the cursor in place
    const zoomTo = (k1, at) => { pause(); k1 = Math.max(1, Math.min(KMAX, k1));
      const p0 = at && proj.invert(at); proj.scale(R0 * k1);
      if (p0) { const p1 = proj.invert(at); if (p1 && isFinite(p1[0])) { const r = proj.rotate();
        proj.rotate([r[0] + p1[0] - p0[0], Math.max(-90, Math.min(90, r[1] + p1[1] - p0[1]))]); } }
      redraw(); };
    const ptr = e => { const r = svgEl.getBoundingClientRect(); return [(e.clientX - r.left) * px(), (e.clientY - r.top) * px()]; };
    const zk = () => proj.scale() / R0;
    svgEl.addEventListener("wheel", e => { if (!e.ctrlKey && !e.metaKey) return;      // plain wheel scrolls the page
      e.preventDefault(); zoomTo(zk() * Math.pow(2, -e.deltaY * (e.deltaMode ? 0.05 : 0.01)), ptr(e)); }, { passive: false });
    d3.select(svgEl).on("dblclick", e => { e.preventDefault(); zoomTo(zk() * (e.shiftKey ? 0.5 : 2), ptr(e)); });
    let pinch = null;
    svgEl.addEventListener("touchstart", e => { if (e.touches.length === 2) { const [a, b] = e.touches;
      pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), k: zk() }; } }, { passive: true });
    svgEl.addEventListener("touchmove", e => { if (pinch && e.touches.length === 2) { e.preventDefault(); const [a, b] = e.touches;
      zoomTo(pinch.k * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d); } }, { passive: false });
    svgEl.addEventListener("touchend", e => { if (e.touches.length < 2) pinch = null; });
    document.getElementById("ng-zin").addEventListener("click", () => zoomTo(zk() * 1.6));
    document.getElementById("ng-zout").addEventListener("click", () => zoomTo(zk() / 1.6));
    document.getElementById("ng-zreset").addEventListener("click", () => { proj.rotate(BASE); proj.scale(R0); redraw(); startSpin(); });

    // side panel: the record-quality toggle
    const counts = [1, 2, 3, 4].map(g => Object.entries(QUALITY).filter(([n, v]) => v === g && !fitBy.has(n) && n !== US_NAME).length);
    document.getElementById("ng-qkey").innerHTML = GRADES.map(G =>
      `<li><i style="background:${QCOL[G.g]}"></i><span><b>${esc(G.name)}</b> (${counts[G.g - 1]})<small>${esc(G.text)}</small></span></li>`).join("");
    const qbtn = document.getElementById("ng-qbtn"), qkey = document.getElementById("ng-qwrap");
    qbtn.addEventListener("click", () => { showQuality = !showQuality; qbtn.setAttribute("aria-pressed", showQuality);
      qbtn.textContent = showQuality ? "Hide record quality" : "Show record quality"; qkey.hidden = !showQuality; paintLand(); });
  });

  // the three ways to read the atlas (placeholders until those views exist)
  document.querySelectorAll(".ng-view").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll(".ng-view").forEach(o => o.setAttribute("aria-pressed", o === b));
    document.getElementById("ng-view-note").textContent = `${b.querySelector("h3").textContent}: this view is being built.`;
  }));
})();
