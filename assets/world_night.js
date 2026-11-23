// The night globe on the front page (index.html): the atlas on a dark orthographic globe, coloured as the editorial flat map
// (drafts/world_presentation_maps.R, map B): each fitted country in its own hue, its blocs (assets/world_k4/<key>.json,
// b = 1 the largest) from deep (smallest) to pale (largest); countries without a fit translucent grey. A toggle colours
// the countries without a fit by the quality of their election records (assets/world_quality.json, grades 1-4).
// Country lists from assets/world_countries.js (FITTED, PANELS, US_STATES, STARTED, GRADES). Click a fitted country to
// open its panel on world.html (?country=<key>; Canada and Germany ?place=<key>), the United States to open us.html.
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
  const blocColour = (name, b, nb) => {                  // b = 1 largest -> palest; nb blocs
    const t = nb > 1 ? (b - 1) / (nb - 1) : 0;           // 0 largest .. 1 smallest
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
  svg.append("circle").attr("cx", W / 2).attr("cy", W / 2).attr("r", R0 * 1.09).attr("fill", "url(#ng-halo)").attr("class", "ng-halo");
  const sphere = svg.append("path").datum({ type: "Sphere" }).attr("fill", "url(#ng-sea)");
  const grat = svg.append("path").datum(d3.geoGraticule().step([15, 15])()).attr("class", "ng-grat");
  const layers = [];
  let showQuality = false, QUALITY = {};
  const fitBy = new Map(ALL.map(c => [c.name, c]));
  const started = new Set(STARTED.map(c => c.name));
  const showTip = (e, t) => { if (svgEl.classList.contains("dragging")) return; const r = box.getBoundingClientRect();
    tip.textContent = t; tip.hidden = false; tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top) + "px"; };
  const hideTip = () => { tip.hidden = true; };
  const open = c => { if (c.open) { location.href = `world.html?place=${c.key}`; return; } location.href = `world.html?country=${c.key}`; };
  const Q = ["", "poor: not usable", "limited", "good", "excellent: ready to go"];

  Promise.all([
    fetch("assets/world-50m.json").then(r => r.json()),
    fetch("https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json").then(r => r.json()).catch(() => null),
    fetch("assets/world_quality.json").then(r => r.json()).catch(() => ({})),
    Promise.all(ALL.map(c => fetch(c.k4).then(r => r.ok ? r.json() : null).catch(() => null)))
  ]).then(([WORLD, USA, QUAL, K4]) => {
    QUALITY = QUAL;
    const countries = topojson.feature(WORLD, WORLD.objects.countries).features;
    const land = svg.append("g").selectAll("path").data(countries).join("path").attr("class", "ng-land")
      .classed("ng-fit", d => fitBy.has(d.properties.name) || d.properties.name === US_NAME);
    const paintLand = () => land.attr("fill", d => {
      const n = d.properties.name;
      if (fitBy.has(n)) return blocColour(n, 1, 4);            // under the bloc layer: the palest step
      if (n === US_NAME) return "rgba(196,205,214,.16)";
      if (showQuality && QUALITY[n]) return QCOL[QUALITY[n]];
      return "rgba(196,205,214,.16)";
    }).attr("fill-opacity", d => (showQuality && !fitBy.has(d.properties.name) && d.properties.name !== US_NAME && QUALITY[d.properties.name]) ? 0.55 : 1);
    paintLand();
    // the United States: states with atlas blocs in the US hue
    if (USA) {
      const done = new Set(US_STATES);
      const g = svg.append("g").attr("class", "ng-us");
      g.selectAll("path").data(topojson.feature(USA, USA.objects.states).features).join("path")
        .attr("fill", d => done.has(d.properties.name) ? blocColour(US_NAME, 2, 4) : "rgba(196,205,214,.10)")
        .on("pointermove", (e, d) => showTip(e, `${d.properties.name}: ${done.has(d.properties.name) ? "voting blocs in the atlas" : "not yet"}`))
        .on("pointerleave", hideTip).on("click", () => { location.href = "us.html"; });
      layers.push(g);
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
          showTip(e, `${c.title}: K = ${c.k}; bloc ${f.properties.b} of ${nb}, ${Math.round(100 * f.properties.share)}% of units`); })
        .on("pointerleave", hideTip);
      layers.push(g); });
    // borders between countries above everything; coastlines faint
    const borders = svg.append("path").datum(topojson.mesh(WORLD, WORLD.objects.countries, (a, b) => a !== b)).attr("class", "ng-borders");
    const coast = svg.append("path").datum(topojson.mesh(WORLD, WORLD.objects.countries, (a, b) => a === b)).attr("class", "ng-coast");
    const rim = svg.append("path").datum({ type: "Sphere" }).attr("class", "ng-rim");
    land.on("pointermove", (e, d) => { const n = d.properties.name, c = fitBy.get(n);
      showTip(e, c ? `${c.title}: K = ${c.k}` : n === US_NAME ? "United States" : started.has(n) ? `${n}: work under way` +
        (QUALITY[n] ? `; records ${Q[QUALITY[n]]}` : "") : QUALITY[n] ? `${n}: election records ${Q[QUALITY[n]]}` : n); })
      .on("pointerleave", hideTip)
      .on("click", (e, d) => { const c = fitBy.get(d.properties.name); if (c) open(c); else if (d.properties.name === US_NAME) location.href = "us.html"; });
    const redraw = () => { sphere.attr("d", path); grat.attr("d", path); land.attr("d", path); borders.attr("d", path);
      coast.attr("d", path); rim.attr("d", path); layers.forEach(g => g.selectAll("path").attr("d", path)); };
    redraw();

    // turning: slow spin until touched; drag to turn
    let spin = d3.timer(el => { const r = proj.rotate(); proj.rotate([r[0] + 0.06, r[1]]); redraw(); });
    const stop = () => { if (spin) { spin.stop(); spin = null; } };
    const px = () => W / svgEl.getBoundingClientRect().width;
    d3.select(svgEl).call(d3.drag().clickDistance(3)
      .on("start", () => { stop(); svgEl.classList.add("dragging"); hideTip(); })
      .on("drag", e => { const r = proj.rotate(), k = 180 / Math.PI / proj.scale() * px();
        proj.rotate([r[0] + e.dx * k, Math.max(-90, Math.min(90, r[1] - e.dy * k))]); redraw(); })
      .on("end", () => svgEl.classList.remove("dragging")));

    // side panel: fitted-country key and the record-quality toggle
    document.getElementById("ng-key").innerHTML = ALL.map(c => { const nb = c.kShade || 4;
      return `<li><button type="button" data-key="${c.key}"><span class="ng-ramp">${d3.range(nb, 0, -1).map(b =>
        `<i style="background:${blocColour(c.name, b, nb)}"></i>`).join("")}</span><span>${esc(c.title)}</span><small>K = ${c.k}</small></button></li>`; }).join("") +
      `<li><button type="button" data-us="1"><span class="ng-ramp"><i style="background:${blocColour(US_NAME, 2, 4)}"></i></span><span>United States</span><small>${US_STATES.length} states</small></button></li>`;
    document.getElementById("ng-key").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.us) location.href = "us.html"; else open(ALL.find(c => c.key === b.dataset.key)); });
    const counts = [1, 2, 3, 4].map(g => Object.entries(QUALITY).filter(([n, v]) => v === g && !fitBy.has(n) && n !== US_NAME).length);
    document.getElementById("ng-qkey").innerHTML = GRADES.map(G =>
      `<li><i style="background:${QCOL[G.g]}"></i><span><b>${esc(G.name)}</b> (${counts[G.g - 1]})<small>${esc(G.text)}</small></span></li>`).join("");
    const qbtn = document.getElementById("ng-qbtn"), qkey = document.getElementById("ng-qwrap");
    qbtn.addEventListener("click", () => { showQuality = !showQuality; qbtn.setAttribute("aria-pressed", showQuality);
      qbtn.textContent = showQuality ? "Hide record quality" : "Show record quality"; qkey.hidden = !showQuality; paintLand(); });
    document.getElementById("ng-n").textContent = `${ALL.length} countries and ${US_STATES.length} US states`;
  });

  // the three ways to read the atlas (placeholders until those views exist)
  document.querySelectorAll(".ng-view").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll(".ng-view").forEach(o => o.setAttribute("aria-pressed", o === b));
    document.getElementById("ng-view-note").textContent = `${b.querySelector("h3").textContent}: this view is being built.`;
  }));
})();
