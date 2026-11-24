// A country's page (country.html?c=<key>), in the night style of the front page, laid out as Canada's panel: a row of
// four tiles (rotating PCA, the blocs, the bloc map, the heatmap); a click on a tile opens it below the row with more:
// the demographic PCA, the full bloc table (top lists of each election), further maps, the full-size heatmap.
// Data: assets/countries/<key>.json (scripts/build_country_pages.py); figures in assets/world/.
(() => {
  const key = new URLSearchParams(location.search).get("c");
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const pct = x => x == null ? "" : (100 * x < 1 ? (100 * x).toFixed(1) : Math.round(100 * x)) + "%";
  const lum = c => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255].map(v => (v / 255) ** 2.2).reduce((s, x, i) => s + [0.2126, 0.7152, 0.0722][i] * x, 0); };
  const badge = b => b.colour ? `<span class="badge" style="background:${b.colour};color:${lum(b.colour) > 0.3 ? "#111" : "#fff"}">${b.b}</span>`
    : `<span class="badge" style="background:#1d2b39;color:#eef1f4">${b.b}</span>`;
  const cap = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  const elLabel = e => String(e).replace(/^[A-Z]+(?=\d{4}$)/, "");          // "S2024" -> "2024", "PR2026" -> "2026"
  if (!key || !/^[a-z_]+$/.test(key)) { $("c-title").textContent = "No country chosen"; $("c-sub").innerHTML = `Pick one on the <a href="./">globe</a>.`; return; }

  // a country with the full interactive panels and census measures: the panel of world.html?place=<key>, on a light
  // page, run by assets/atlas.js in country mode (data/<key>/ and assets/countries/<key>_census.json)
  const loadCSS = href => new Promise(ok => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; l.onload = ok; l.onerror = ok; document.head.appendChild(l); });
  const loadJS = src => new Promise((ok, no) => { const t = document.createElement("script"); t.src = src; t.onload = ok; t.onerror = () => no(new Error(src)); document.body.appendChild(t); });
  function panelPage(C) {
    document.title = `${C.title} · Atlas of Voting Blocs`;
    document.body.classList.add("light");
    document.querySelector(".ng-head").outerHTML = `<header class="site-head"><div class="wrap"><a class="site-name" href="./">Atlas of Voting Blocs</a>` +
      `<nav class="site-nav" aria-label="Sections"><a href="us.html">United States</a><a href="cities.html">Cities</a><a href="world.html">World</a></nav>` +
      `<a class="site-home" href="https://cascobayesian.github.io/">Jack O&rsquo;Brien &middot; Bowdoin College</a></div></header>`;
    const main = document.querySelector("main"); main.className = "wrap";
    ["c-title", "c-sub", "c-why", "c-panels", "c-row", "c-detail"].forEach(id => $(id).hidden = true);
    main.insertAdjacentHTML("beforeend", `<div id="ap-mount"></div>`);
    const V = "?v=6";
    return Promise.all(["https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.css", "assets/bloc_profiles.css" + V, "assets/atlas.css" + V,
      "assets/site.css" + V, "assets/country_panel.css" + V].map(loadCSS))
      .then(() => loadJS("https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js"))
      .then(() => loadJS("https://unpkg.com/pmtiles@3.2.1/dist/pmtiles.js"))
      .then(() => loadJS("assets/panel.js" + V)).then(() => loadJS("assets/high_contrast.js" + V))
      .then(() => { const ap = $("ap"); ap.dataset.mode = "country"; ap.dataset.place = C.key; ap.dataset.census = C.census; return loadJS("assets/atlas.js" + V); });
  }

  fetch(`assets/countries/${key}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(C => {
    if (C.panels && C.census) return panelPage(C);
    document.title = `${C.title} · Atlas of Voting Blocs`;
    $("c-title").textContent = C.title;
    $("c-sub").textContent = `${C.k} voting blocs from a ${C.model || "mixture model"} of ${C.data}.`;
    $("c-why").textContent = C.why ? C.why.charAt(0).toUpperCase() + C.why.slice(1) + "." : "";
    if (C.panels) $("c-panels").innerHTML = `<a class="panels-btn" href="world.html?place=${C.key}">Open the full interactive panels &rarr;</a>`;
    const B = C.blocs, last = B ? B.elections[B.elections.length - 1] : null;

    // ---- the four tiles
    const tiles = [
      { id: "pca", title: "Rotating PCA", sub: C.demog_list ? `+ ${C.demog_list.length} demographic views` : C.demog ? "+ demographics" : "", ok: !!C.pca,
        body: () => `<div class="pic dark"><img src="${C.pca.src}" alt="${esc(C.title)}: rotating principal components coloured by bloc" loading="lazy"></div>` },
      { id: "blocs", title: "Blocs", sub: B ? `${B.blocs.length} blocs` : "", ok: !!B,
        body: () => `<ul class="blist">${B.blocs.map(b => `<li>${badge(b)}<span><span class="nm">${esc(cap(b.name) || "Bloc " + b.b)}</span>` +
          `${b.share != null ? ` <span class="tp" style="display:inline">· ${pct(b.share)} of ${esc(C.unit)}</span>` : ""}` +
          `<span class="tp">${esc(elLabel(last))}: ${(b.top[last] || []).slice(0, 2).map(([l, s]) => `${esc(l)} ${pct(s)}`).join(", ")}</span></span></li>`).join("")}</ul>` },
      { id: "map", title: "Map", sub: C.more_maps.length ? `+ ${C.more_maps.length} more` : "", ok: !!C.map,
        body: () => `<div class="pic"><img src="${C.map.src}" alt="${esc(C.title)}: bloc map" loading="lazy"></div>` },
      { id: "heat", title: "Heatmap", sub: "", ok: !!C.heat,
        body: () => C.heat.src ? `<div class="pic"><img src="${C.heat.src}" alt="${esc(C.title)}: heatmap of vote shares by unit" loading="lazy"></div>`
          : `<div class="pic"><span style="color:#333;font-size:.9rem;padding:1rem;text-align:center">Interactive heatmap: one row per ${esc(C.unit.replace(/s$/, ""))}, grouped by bloc.</span></div>` }
    ];
    $("c-row").innerHTML = tiles.map(t => `<button type="button" class="tile" data-id="${t.id}" aria-expanded="false" aria-controls="c-detail"${t.ok ? "" : " disabled"}>` +
      `<h2>${t.title}<small>${esc(t.sub)}</small></h2>` +
      (t.ok ? t.body() + `<span class="open-tag">Click to open &darr;</span>` : `<div class="none">Not yet in the atlas for ${esc(C.title)}.</div>`) + `</button>`).join("");

    // ---- the expanded view below the row: one at a time
    const fig = (f, dark) => `<figure><div class="frame"${dark ? ' style="background:#0a1018"' : ""}><img src="${f.src}" alt="${esc(f.cap)}" loading="lazy"></div><figcaption>${esc(f.cap)}</figcaption></figure>`;
    const detail = {
      pca: () => fig(C.pca, true) + (C.demog ? `<h3 style="margin-top:.4rem">Demographics</h3>` + fig(C.demog) : "") +
        (C.demog_list ? `<h3 style="margin-top:.4rem">Demographics</h3><p class="note" style="margin:-.3rem 0 .8rem">${esc(C.demog_note)}</p>` +
          `<div class="gal">${C.demog_list.map(f => `<figure><div class="frame" style="background:#0a1018"><img src="${f.src}" alt="${esc(f.title)}" loading="lazy"></div>` +
            `<figcaption><b style="color:#eef1f4">${esc(f.title)}.</b> ${esc(f.cap)}</figcaption></figure>`).join("")}</div>` : ""),
      blocs: () => `<div class="btable-wrap"><table class="btable"><thead><tr><th>Bloc</th><th>Name</th><th class="num">${esc(C.unit)}</th><th class="num">Share</th>` +
        B.elections.map(e => `<th>${esc(elLabel(e))}: top lists</th>`).join("") + `</tr></thead><tbody>` +
        B.blocs.map(b => `<tr><td>${badge(b)}</td><td>${esc(cap(b.name) || "—")}</td><td class="num">${b.n != null ? Number(b.n).toLocaleString() : ""}</td><td class="num">${pct(b.share)}</td>` +
          B.elections.map(e => `<td class="top">${(b.top[e] || []).slice(0, 3).map(([l, s], i) => i ? `${esc(l)} ${pct(s)}` : `<b>${esc(l)} ${pct(s)}</b>`).join("<br>")}</td>`).join("") + `</tr>`).join("") +
        `</tbody></table></div><p class="note">Each bloc's mean vote shares (its fitted profile) in each election, top three lists. Blocs numbered as on the map` +
        `${B.blocs.some(b => b.colour) ? ", in the map's colours" : ""}; ${B.blocs.some(b => b.name) ? "names are interpretations." : "unnamed blocs are numbered."}</p>`,
      map: () => fig(C.map) + C.more_maps.map(f => fig(f)).join(""),
      heat: () => C.heat.src ? fig(C.heat) + `<p class="note"><a href="${C.heat.src}" target="_blank" rel="noopener">Open the heatmap full size</a></p>`
        : `<div class="heatbox"><div class="wm-heat" id="c-heat"></div></div><p class="note">${esc(C.heat.cap)}</p>`
    };
    const title = { pca: "Rotating PCA", blocs: "The blocs", map: "Bloc map", heat: "Heatmap" };
    const box = $("c-detail"); let open = null;
    const show = id => {
      document.querySelectorAll(".tile").forEach(t => t.setAttribute("aria-expanded", t.dataset.id === id));
      if (!id) { box.hidden = true; open = null; return; }
      box.innerHTML = `<h3>${title[id]}<button type="button" aria-label="Close">Close &times;</button></h3>` + detail[id]();
      box.querySelector("h3 button").addEventListener("click", () => show(null));
      if (id === "heat" && C.heat.json && window.worldHeat) window.worldHeat($("c-heat"), C.heat.json);
      box.hidden = false; open = id; box.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    $("c-row").addEventListener("click", e => { const t = e.target.closest(".tile"); if (!t || t.disabled) return; show(open === t.dataset.id ? null : t.dataset.id); });
  }).catch(err => { $("c-title").textContent = "Country not found"; $("c-sub").innerHTML = `<span class="err">No atlas page for “${esc(key)}”.</span> Back to the <a href="./">globe</a>.`; });
})();
