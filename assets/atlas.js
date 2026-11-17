// Atlas of US Voting Blocs: one place's panel drawn in the browser from data (code/atlas/proto/01_export.R writes
// data/<key>/: data.json, demog.json, profile.json, heat.json, units.pmtiles).
//   PCA       rotating 3D scatter on a canvas (the atlas gif's camera path); drag to turn, hover to name, click to pick
//   Blocs     hover to bring a bloc forward everywhere; click to open its profile
//   Map       MapLibre + PMTiles over an OpenFreeMap basemap; hover to name, click to open the division's profile
//   Data      the referendum heatmap, grouped by bloc; click to open it full size
// One subpanel under the row at a time: Demographics (the PCA coloured by density, race, education, turning with
// the main PCA), Bloc profile, Division profile, Heatmap (rows linked to the map and PCA).
(() => {
  const root = document.getElementById("ap"), qp = new URLSearchParams(location.search).get("place");
  // where the data lives: data/ next to the page, or another host (e.g. a Cloudflare R2 bucket) set on #ap's data-data
  const DATA = root.dataset.data || "data/";
  // no place chosen: the page is just the US map (assets/us_map.js); clicking a place reloads with ?place=<key>
  if (!(qp && /^[a-z_]+$/.test(qp))) return;
  const base = `${DATA}${qp}/`;
  root.hidden = false; document.getElementById("ap-head").hidden = false;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const lum = c => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255].map(v => (v / 255) ** 2.2).reduce((s, x, i) => s + [0.2126, 0.7152, 0.0722][i] * x, 0); };
  const ink = c => lum(c) > 0.32 ? "#111" : "#fff";
  const pct = x => Math.round(100 * x) + "%";
  const money = x => "$" + (Math.round(x / 100) * 100).toLocaleString("en-US");
  const tip = document.getElementById("ap-tip");
  const showTip = (html, x, y) => {
    if (html == null) { tip.hidden = true; return; }
    tip.innerHTML = html; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = (x + 14 + r.width > innerWidth - 8 ? x - r.width - 14 : x + 14) + "px";
    tip.style.top = (y + 14 + r.height > innerHeight - 8 ? y - r.height - 10 : y + 14) + "px";
  };

  // ---- shared state ----
  const S = { hoverBloc: null, selBloc: null, hover: null, sel: null, tab: null, dlgSel: null, dlgBloc: null, heatSel: null, heatBloc: null };
  const focusBloc = () => S.hoverBloc != null ? S.hoverBloc : S.selBloc;
  // three scopes, each with its own selection: the main row; the subpanels (hover only); the enlarged view, which
  // starts empty each time it opens and takes its own clicks
  // the heatmap subpanel keeps its own pick too: the ward clicked in it, and that ward's bloc
  const focusOf = sc => sc === "sub" ? S.hoverBloc : sc === "dlg" ? (S.hoverBloc != null ? S.hoverBloc : S.dlgBloc) :
    sc === "heat" ? (S.hoverBloc != null ? S.hoverBloc : S.heatBloc) : focusBloc();
  const hotOf = sc => sc === "sub" ? [S.hover] : sc === "dlg" ? [S.dlgSel, S.hover] : sc === "heat" ? [S.heatSel, S.hover] : [S.sel, S.hover];
  const subs = [], on = f => subs.push(f), update = () => subs.forEach(f => f());

  // the place picker: every exported place (data/places.json)
  fetch(DATA + "places.json").then(r => r.ok ? r.json() : []).then(list => {
    const sel = document.getElementById("ap-place"); if (!sel || !list.length) return;
    const cur = base.match(/([a-z_]+)\/$/)[1];
    sel.innerHTML = list.map(p => `<option value="${p.key}"${p.key === cur ? " selected" : ""}>${esc(p.title)}</option>`).join("");
    sel.addEventListener("change", () => window.atlasOpen(sel.value));
  }).catch(() => {});
  const J = f => fetch(base + f).then(r => { if (!r.ok) throw new Error(f + " " + r.status); return r.json(); });
  Promise.all([J("data.json"), J("demog.json"), J("profile.json"), J("heat.json")]).then(([D, G, PF, HJ]) => {
    const U = D.units, N = U.id.length, B = Object.fromEntries(D.blocs.map(b => [b.b, b]));
    const unitWord = D.unit.replace(/s$/, ""), UnitWord = unitWord[0].toUpperCase() + unitWord.slice(1);
    document.getElementById("ap-sub").textContent = `${N.toLocaleString()} ${D.unit}, ${D.what || D.n_q + " ballot questions and races"}, ${D.blocs.length} voting blocs.`;
    document.querySelector('[data-tab="unit"]').textContent = UnitWord + " profile";
    document.title = D.title + (D.what ? " · Atlas of Voting Blocs" : " · Atlas of US Voting Blocs");
    document.getElementById("ap-name").textContent = D.title;
    requestAnimationFrame(() => root.classList.add("ap-enter"));   // the panels are built: fade them in (assets/site.css)
    root.querySelectorAll("[data-words]").forEach(el => { el.innerHTML = el.innerHTML.replace(/\bdivisions\b/g, D.unit).replace(/\bdivision\b/g, unitWord)
      .replace(/the city&rsquo;s|the city’s/g, esc(D.title) + "&rsquo;s"); });
    // places outside the US (e.g. Canada) rewrite the captions that speak of ballot questions: CSS selector -> html
    if (D.text) Object.entries(D.text).forEach(([sel, html]) => document.querySelectorAll(sel).forEach(el => { el.innerHTML = html; }));
    const swatch = (b, cls = "") => `<span class="ap-swatch ${cls}" data-sb="${b.b}" style="background:${b.color};color:${ink(b.color)}">${b.b}</span>`;
    // two colour schemes: national (data.json, the default) and high contrast (assets/high_contrast.js, made on first use)
    D.blocs.forEach(b => { b.national = b.color; });
    const recolorFns = [], unitMaps = new Set();

    // ---- tooltips ----
    const unitTip = (u, extra) => {
      const b = B[U.b[u]];
      return `<b>${esc(U.name[u])}</b><div class="ap-trow">${swatch(b, "sm")}${esc(b.name)}</div>` +
        (G.pop[u] != null ? `<div class="ap-tnum">${G.pop[u].toLocaleString()} residents</div>` : "") +
        (U.p[u] != null && U.measure !== "none" ? `<div class="ap-tnum">${U.measure === "stability" ? "In this bloc in" : "Bloc probability"} <b>${pct(U.p[u])}</b>${U.measure === "stability" ? " of samples" : ""}</div>` : "") + (extra || "");
    };
    // partisanship: the presidential race the bloc list reports (G.pres_label, e.g. "Biden 2020"), per unit, 0-100
    const biden = G.pres || new Array(N).fill(null), PRES = G.pres_label || D.blocs[0].vote;
    const [PRES_WHO, PRES_YR] = [PRES.replace(/\s*\d{4}$/, ""), (PRES.match(/\d{4}/) || [""])[0]];
    const PRES_PLACE = G.pres_place != null ? G.pres_place : (() => { let a = 0, w = 0;
      biden.forEach((v, i) => { if (v != null && G.pop[i] > 0) { a += v * G.pop[i]; w += G.pop[i]; } }); return w ? a / w : null; })();
    const DEM_STOPS = ["#B2182B", "#E58267", "#F7F7F7", "#7FB3D5", "#2166AC", "#08306B"];   // red (Trump) .. blue (Biden), 50% white
    const demColor = v => { if (v == null) return "#bdbdbd"; const t = Math.max(0, Math.min(1, v / 100)) * (DEM_STOPS.length - 1),
      i = Math.min(DEM_STOPS.length - 2, Math.floor(t)); return d3i(DEM_STOPS[i], DEM_STOPS[i + 1], t - i); };
    function d3i(a, b, t) { const A = [1, 3, 5].map(j => parseInt(a.slice(j, j + 2), 16)), Bv = [1, 3, 5].map(j => parseInt(b.slice(j, j + 2), 16));
      return "#" + A.map((x, j) => Math.round(x + (Bv[j] - x) * t).toString(16).padStart(2, "0")).join(""); }
    G.col.dem = biden.map(demColor);
    const demogTip = { dem: u => biden[u] != null ? `<div class="ap-tnum">${esc(PRES)} <b>${Math.round(biden[u])}%</b></div>` : "", dens: u => G.dens[u] != null ? `<div class="ap-tnum"><b>${G.dens[u].toLocaleString()}</b> residents per km&sup2;</div>` : "",
      ba: u => G.ba[u] != null ? `<div class="ap-tnum"><b>${pct(G.ba[u])}</b> of adults 25+ with a bachelor&rsquo;s</div>` : "",
      race: u => { const r = G.shares.race, k = [["white", "White"], ["black", "Black"], ["hispanic", "Hispanic"], ["asian", "Asian"]];
        return `<div class="ap-tnum">${k.filter(([c]) => r[c][u] != null).map(([c, l]) => `${l} ${r[c][u]}%`).join(" &middot; ")}</div>`; } };

    // ---- selection ----
    const selectUnit = u => { S.sel = u === S.sel ? null : u; if (S.sel != null) openTab("unit"); update(); };
    const selectBloc = b => { S.selBloc = b === S.selBloc ? null : b; if (S.selBloc != null) openTab("bloc"); update(); };
    const setHover = u => { if (u !== S.hover) { S.hover = u; update(); } };

    // ---- bloc list ----
    const ol = document.getElementById("ap-blocs");
    ol.innerHTML = D.blocs.map(b => `<li data-b="${b.b}" tabindex="0" role="button" aria-pressed="false">${swatch(b)}
      <span class="ap-name">${esc(b.name)}</span><span class="ap-meta">${b.n.toLocaleString()} ${D.unit} &middot; ${b.vote} ${Math.round(100 * b.dem)}%</span></li>`).join("");
    // hover moves straight from bloc to bloc; only leaving the whole list clears it (no flash back to all blocs)
    ol.querySelectorAll("li").forEach(li => {
      const b = +li.dataset.b;
      li.addEventListener("pointerenter", () => { if (S.hoverBloc !== b) { S.hoverBloc = b; update(); } });
      li.addEventListener("focus", () => { S.hoverBloc = b; update(); });
      li.addEventListener("click", () => selectBloc(b));
      li.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectBloc(b); } });
    });
    ol.addEventListener("pointerleave", () => { S.hoverBloc = null; update(); });
    ol.addEventListener("focusout", e => { if (!ol.contains(e.relatedTarget)) { S.hoverBloc = null; update(); } });
    on(() => ol.querySelectorAll("li").forEach(li => {
      const b = +li.dataset.b, f = focusBloc();
      li.classList.toggle("on", f === b || (f == null && S.hover != null && U.b[S.hover] === b));
      li.classList.toggle("sel", S.selBloc === b); li.setAttribute("aria-pressed", String(S.selBloc === b));
      li.classList.toggle("fade", f != null && f !== b);
    }));

    // ---- PCA views: one camera, many canvases (the main plot and the three demographic ones) ----
    const idx = [...Array(N).keys()].filter(i => U.x[i] != null), n = idx.length;
    const raw = [U.x, U.y, U.z];
    const SC = raw.map(a => { let lo = Infinity, hi = -Infinity; for (const i of idx) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]); } return { c: (lo + hi) / 2, h: (hi - lo) / 2 || 1 }; });
    const P = new Float32Array(3 * N); for (const i of idx) for (let k = 0; k < 3; k++) P[3 * i + k] = (raw[k][i] - SC[k].c) / SC[k].h;
    const R = Math.sqrt(3), DCAM = 6 * R, L = 0.92 * R;
    const pops = idx.map(i => U.pop[i] || 1).sort((a, b) => a - b), med = pops[n >> 1] || 1;
    const size = new Float32Array(N); for (const i of idx) size[i] = Math.min(2.4, Math.max(0.85 * Math.sqrt((U.pop[i] || med) / med) * Math.min(1, Math.sqrt(1500 / n)), 0.15));   // capped: a city among small towns
    const cent = D.blocs.map(b => { const s = [0, 0, 0]; let m = 0;
      for (const i of idx) if (U.b[i] === b.b) { s[0] += P[3 * i]; s[1] += P[3 * i + 1]; s[2] += P[3 * i + 2]; m++; }
      return { b, p: s.map(v => v / Math.max(m, 1)) }; });
    const cam = { theta: 30, phi: 20, auto: true, t: 0 };
    const views = [];
    const setAuto = a => { cam.auto = a; document.querySelectorAll(".ap-play").forEach(p => {
      p.innerHTML = a ? "&#10074;&#10074;" : "&#9654;"; p.setAttribute("aria-label", a ? "Pause rotation" : "Resume rotation"); p.title = p.getAttribute("aria-label"); }); };
    // every PCA gets its own play/pause button; they share the camera, so one press starts or stops them all
    const addPlay = box => { let p = box.querySelector(".ap-play");
      if (!p) { p = document.createElement("button"); p.type = "button"; p.className = "ap-play"; box.appendChild(p); }
      p.addEventListener("click", e => { e.stopPropagation(); setAuto(!cam.auto); }); setAuto(cam.auto); };

    function makePCA(box, colorOf, tipExtra, onClick, sub) {
      const cv = document.createElement("canvas"); box.prepend(cv); addPlay(box);
      const ctx = cv.getContext("2d"), v = { box, dirty: true, sx: new Float32Array(N), sy: new Float32Array(N), sd: new Float32Array(N) };
      let W = 0, H = 0, scale = 1, dpr = 1;
      const tmp = [0, 0, 0], tmp2 = [0, 0, 0];
      const proj = (x, y, z, out) => {
        const th = cam.theta * Math.PI / 180, ph = cam.phi * Math.PI / 180;
        const x1 = Math.cos(th) * x + Math.sin(th) * y, y1 = -Math.sin(th) * x + Math.cos(th) * y;
        const d = Math.cos(ph) * y1 - Math.sin(ph) * z, up = Math.sin(ph) * y1 + Math.cos(ph) * z, f = DCAM / (DCAM + d);
        out[0] = W / 2 + x1 * f * scale; out[1] = H / 2 - up * f * scale; out[2] = d; return out;
      };
      const line = (a, b, style, w, dash) => { proj(...a, tmp); proj(...b, tmp2); ctx.beginPath(); ctx.setLineDash(dash || []);
        ctx.moveTo(tmp[0], tmp[1]); ctx.lineTo(tmp2[0], tmp2[1]); ctx.strokeStyle = style; ctx.lineWidth = w; ctx.stroke(); };
      const resize = () => { dpr = devicePixelRatio || 1; W = box.clientWidth; H = W; cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + "px"; scale = W / 2 / L; v.dirty = true; };
      v.draw = () => {
        if (!W) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
        const k = W / 520;
        for (const g of [-0.5, 0, 0.5]) { line([g, -1, -1], [g, 1, -1], "#e4e4e4", 0.7 * k); line([-1, g, -1], [1, g, -1], "#e4e4e4", 0.7 * k); }
        const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (let j = 0; j < 4; j++) { const a = C[j], b = C[(j + 1) % 4];
          line([...a, -1], [...b, -1], "#cfcfcf", 0.9 * k); line([...a, 1], [...b, 1], "#dddddd", 0.7 * k, [2 * k, 3 * k]);
          line([...a, -1], [...a, 1], "#dddddd", 0.7 * k, [2 * k, 3 * k]); }
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(120,120,120,.13)";
        for (const i of idx) { proj(P[3 * i], P[3 * i + 1], -1, tmp); ctx.fillRect(tmp[0] - 0.5 * k, tmp[1] - 0.5 * k, k, k); }
        ctx.font = `700 ${Math.max(9, Math.round(13 * k))}px system-ui, sans-serif`; ctx.fillStyle = "#222"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const lab = (pts, txt) => { let best = null; for (const [a, o] of pts) { proj(...a, tmp); if (!best || tmp[2] < best[2]) best = [tmp[2], o]; }
          proj(...best[1], tmp2); ctx.fillText(txt, tmp2[0], tmp2[1]); };
        lab([[[0, -1, -1], [0, -1.25, -1.1]], [[0, 1, -1], [0, 1.25, -1.1]]], "PC1");
        lab([[[-1, 0, -1], [-1.25, 0, -1.1]], [[1, 0, -1], [1.25, 0, -1.1]]], "PC2");
        { let best = null; for (const [a, b] of C) { proj(a, b, 0, tmp); if (!best || tmp[0] < best[0]) best = [tmp[0], a, b]; }
          proj(best[1] * 1.18, best[2] * 1.18, 0, tmp); ctx.fillText("PC3", tmp[0], tmp[1]); }
        for (const i of idx) { proj(P[3 * i], P[3 * i + 1], P[3 * i + 2], tmp); v.sx[i] = tmp[0]; v.sy[i] = tmp[1]; v.sd[i] = tmp[2]; }
        const scope = box.closest("dialog") ? "dlg" : sub ? "sub" : "main", order = idx.slice().sort((a, b) => v.sd[b] - v.sd[a]), fb = focusOf(scope);
        const dot = (i, grow, alpha, stroke) => {
          const near = Math.min(Math.max((R - v.sd[i]) / (2 * R), 0), 1), r = 3.3 * k * size[i] * (1 + 0.3 * near) * grow;
          ctx.beginPath(); ctx.arc(v.sx[i], v.sy[i], r, 0, 2 * Math.PI); ctx.globalAlpha = alpha; ctx.fillStyle = colorOf(i); ctx.fill();
          if (stroke) { ctx.globalAlpha = 1; ctx.lineWidth = stroke * k; ctx.strokeStyle = "#fff"; ctx.stroke(); }
        };
        if (fb == null) for (const i of order) dot(i, 1, 0.85, 0.35);
        else {                                       // the bloc in front, larger and full strength; the rest set back
          for (const i of order) if (U.b[i] !== fb) dot(i, 0.9, 0.3, 0);
          for (const i of order) if (U.b[i] === fb) dot(i, 1.45, 1, 0.5);
        }
        ctx.globalAlpha = 1;
        const cs = cent.map(c => { proj(...c.p, tmp2); return { c, x: tmp2[0], y: tmp2[1], d: tmp2[2] }; }).sort((a, b) => b.d - a.d);
        if (fb != null) cs.push(cs.splice(cs.findIndex(q => q.c.b.b === fb), 1)[0]);
        for (const q of cs) {
          const me = fb === q.c.b.b, nc = Math.min(Math.max((R - q.d) / (2 * R), 0), 1), r = (9 + 2 * nc) * k * (me ? 1.3 : 1);
          ctx.globalAlpha = fb == null || me ? 1 : 0.4;
          ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 2 * Math.PI); ctx.fillStyle = q.c.b.color; ctx.fill();
          ctx.lineWidth = (me ? 2 : 1.4) * k; ctx.strokeStyle = "#111"; ctx.stroke();
          ctx.font = `700 ${Math.max(8, Math.round(11 * k * (me ? 1.3 : 1)))}px system-ui, sans-serif`;
          ctx.fillStyle = ink(q.c.b.color); ctx.fillText(q.c.b.b, q.x, q.y + 0.5);
        }
        ctx.globalAlpha = 1;
        for (const u of hotOf(scope)) if (u != null && U.x[u] != null) {
          const big = scope === "dlg" && u === S.dlgSel, x = v.sx[u], y = v.sy[u];
          if (big) {                                 // the selected ward: redrawn on top, a double ring, ticks and its name
            dot(u, 2.2, 1, 0.8);
            const r = 13 * k + 4;
            ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.lineWidth = 6; ctx.strokeStyle = "#fff"; ctx.stroke();
            ctx.lineWidth = 2.6; ctx.strokeStyle = "#111"; ctx.stroke();
            ctx.beginPath(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(x + dx * r, y + dy * r); ctx.lineTo(x + dx * (r + 9), y + dy * (r + 9)); }
            ctx.lineWidth = 2.4; ctx.stroke();
            ctx.font = `700 ${Math.max(11, Math.round(12 * k))}px system-ui, sans-serif`;
            const t = U.name[u], tw = ctx.measureText(t).width + 12, th = 20, lx = Math.min(W - tw - 4, x + r + 12), ly = Math.max(4, y - r - th);
            ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.strokeStyle = "#111"; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.roundRect(lx, ly, tw, th, 4); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#111"; ctx.textAlign = "left"; ctx.fillText(t, lx + 6, ly + th / 2 + 0.5); ctx.textAlign = "center";
            continue;
          }
          ctx.beginPath(); ctx.arc(x, y, 7 * k + 2, 0, 2 * Math.PI); ctx.lineWidth = 3.2; ctx.strokeStyle = "#fff"; ctx.stroke();
          ctx.lineWidth = 1.8; ctx.strokeStyle = "#111"; ctx.stroke(); }
      };
      new ResizeObserver(resize).observe(box); resize();
      let drag = null;
      cv.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, th: cam.theta, ph: cam.phi, moved: false }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener("pointermove", e => {
        if (drag) {
          const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) { drag.moved = true; setAuto(false); }
          if (drag.moved) { cam.theta = drag.th - dx * 0.5; cam.phi = Math.max(-5, Math.min(85, drag.ph + dy * 0.4)); views.forEach(w => w.dirty = true); showTip(null); return; }
        }
        const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
        let best = null, bd = 64;
        for (const i of idx) { const d = (v.sx[i] - mx) ** 2 + (v.sy[i] - my) ** 2; if (d < bd) { bd = d; best = i; } }
        setHover(best); showTip(best == null ? null : unitTip(best, tipExtra && tipExtra(best)), e.clientX, e.clientY);
      });
      cv.addEventListener("pointerup", () => { if (drag && !drag.moved) onClick(S.hover); drag = null; });
      cv.addEventListener("pointerleave", () => { if (!drag) { setHover(null); showTip(null); } });
      views.push(v); return v;
    }
    let last = performance.now();
    const frame = now => {
      const dt = Math.min(now - last, 100); last = now;
      if (cam.auto && !document.hidden) { cam.t += dt / 8640; cam.theta = 30 + 360 * cam.t; cam.phi = 27 - 19 * Math.cos(4 * Math.PI * cam.t); views.forEach(w => w.dirty = true); }
      for (const w of views) if (w.dirty && w.box.offsetParent) { w.draw(); w.dirty = false; }
      requestAnimationFrame(frame);
    };
    on(() => views.forEach(w => w.dirty = true));
    const dlg = document.getElementById("ap-big");
    const pcaClick = toDemog => u => {
      if (dlg.open) { if (u != null) dialogUnit(u); return; }
      if (u != null) S.sel = u;
      if (toDemog) openTab("demog"); else if (u != null) update();
    };
    makePCA(document.getElementById("ap-pca"), i => B[U.b[i]].color, null, pcaClick(true));
    const pcLine = () => D.pct.map((v, j) => `<span><b>PC${j + 1}</b> ${v.toFixed(1)}%</span>`).join("");
    document.getElementById("ap-pca-cap").innerHTML = pcLine();
    requestAnimationFrame(frame);

    // ---- map ----
    let mapApi = { refit: () => {} };
    const protocol = new pmtiles.Protocol(); maplibregl.addProtocol("pmtiles", protocol.tile);
    const url = new URL(base + "units.pmtiles", location.href).href, archive = new pmtiles.PMTiles(url); protocol.add(archive);
    const blocExpr = () => ["match", ["get", "b"], ...D.blocs.flatMap(b => [b.b, b.color]), "#ccc"];
    let color = blocExpr();
    const addUnits = (map, firstLabel, opts = {}) => {
      map.addSource("units", { type: "vector", url: "pmtiles://" + url, promoteId: "u" }); unitMaps.add(map);
      map.addLayer({ id: "units-fill", type: "fill", source: "units", "source-layer": "units", paint: { "fill-color": color, "fill-opacity": 0.82, "fill-opacity-transition": { duration: 150 } } }, firstLabel);
      map.addLayer({ id: "units-line", type: "line", source: "units", "source-layer": "units",
        paint: { "line-color": "#fff", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.1, 14, 1.2], "line-opacity": 0.8 } }, firstLabel);
      const hw = opts.scope === "dlg" ? 3.4 : 2.4;
      map.addLayer({ id: "units-hot-halo", type: "line", source: "units", "source-layer": "units",
        paint: { "line-color": "#fff", "line-width": ["case", ["boolean", ["feature-state", "hot"], false], hw + 3, 0] } });
      map.addLayer({ id: "units-hot", type: "line", source: "units", "source-layer": "units",
        paint: { "line-color": "#111", "line-width": ["case", ["boolean", ["feature-state", "hot"], false], hw, 0] } });
      let lastFocus, hot = new Set();
      const paintFocus = () => { const f = opts.fade === false ? null : focusOf(opts.scope || "main"); if (f === lastFocus) return; lastFocus = f;
        map.setPaintProperty("units-fill", "fill-opacity", f == null ? 0.82 : ["case", ["==", ["get", "b"], f], 0.95, 0.25]); };
      const paintHot = () => {
        const want = new Set(hotOf(opts.scope || "main").filter(u => u != null));
        for (const u of hot) if (!want.has(u)) map.setFeatureState({ source: "units", sourceLayer: "units", id: u }, { hot: false });
        for (const u of want) map.setFeatureState({ source: "units", sourceLayer: "units", id: u }, { hot: true });
        hot = want;
      };
      on(paintFocus); on(paintHot); paintFocus(); paintHot();
    };
    let header = null;
    // a full interactive map of the units: zoom and pan, no further than 20 miles beyond the place's edges
    const liveMap = (container, h, tipOf, onClick, ready, opts = {}) => {
      // the opening view: the tiles' extent, or the place's own (D.view, e.g. southern Canada rather than the Arctic)
      const bounds = D.view || [[h.minLon, h.minLat], [h.maxLon, h.maxLat]];
      // the limit is 20 miles beyond the place, widened first to a square around it, so that a tall or wide place
      // (Maine) still fits whole in a square map when zoomed out
      const cos = Math.cos((h.minLat + h.maxLat) / 2 * Math.PI / 180), dLat = 20 / 69.0, dLon = 20 / (69.17 * cos);
      const cx = (h.minLon + h.maxLon) / 2, cy = (h.minLat + h.maxLat) / 2;
      const half = Math.max((h.maxLon - h.minLon) / 2 * cos, (h.maxLat - h.minLat) / 2) * 1.08;   // in latitude degrees
      const maxBounds = [[Math.min(h.minLon, cx - half / cos) - dLon, Math.min(h.minLat, cy - half) - dLat],
                         [Math.max(h.maxLon, cx + half / cos) + dLon, Math.max(h.maxLat, cy + half) + dLat]];
      const map = new maplibregl.Map({ container, style: "https://tiles.openfreemap.org/styles/positron", bounds, fitBoundsOptions: { padding: 10 }, maxBounds,
        attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, preserveDrawingBuffer: /[?&]test/.test(location.search) });
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.once("load", () => map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));
      map.refit = () => requestAnimationFrame(() => { map.resize(); map.fitBounds(bounds, { padding: 10, duration: 0 }); });
      map.once("style.load", () => {
        addUnits(map, map.getStyle().layers.find(l => l.type === "symbol")?.id, opts);
        if (opts.outlines) {
          const bu = new URL(base + "blocs.pmtiles", location.href).href;
          if (!protocol.get(bu)) protocol.add(new pmtiles.PMTiles(bu));
          map.addSource("blocs", { type: "vector", url: "pmtiles://" + bu });
          map.addLayer({ id: "blocs-light", type: "line", source: "blocs", "source-layer": "blocs", paint: { "line-color": "#222", "line-width": 0.8, "line-opacity": 0.35 } });
          map.addLayer({ id: "blocs-heavy", type: "line", source: "blocs", "source-layer": "blocs", filter: ["==", ["get", "b"], -1],
            paint: { "line-color": "#111", "line-width": 3 } });
          map.addLayer({ id: "blocs-heavy-halo", type: "line", source: "blocs", "source-layer": "blocs", filter: ["==", ["get", "b"], -1],
            paint: { "line-color": "#fff", "line-width": 5.5, "line-opacity": 0.85 } }, "blocs-heavy");
          let lastB;
          const heavy = () => { const sc = opts.scope || "main", f = focusOf(sc), us = sc === "dlg" ? S.dlgSel : S.sel,
            b = f != null ? f : us != null ? U.b[us] : -1; if (b === lastB) return; lastB = b;
            ["blocs-heavy", "blocs-heavy-halo"].forEach(id => map.setFilter(id, ["==", ["get", "b"], b])); };
          on(heavy); heavy();
          // a ring around the enlarged view's selected ward
          map.addSource("ring", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "ring-halo", type: "circle", source: "ring", paint: { "circle-radius": 15, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 2.5, "circle-stroke-color": "#fff" } });
          map.addLayer({ id: "ring", type: "circle", source: "ring", paint: { "circle-radius": 12.5, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 3, "circle-stroke-color": "#111" } });
          let lastR;
          const ring = () => { const u = S.dlgSel; if (u === lastR) return; lastR = u;
            map.getSource("ring").setData({ type: "FeatureCollection", features: u == null || U.lon[u] == null ? [] :
              [{ type: "Feature", geometry: { type: "Point", coordinates: [U.lon[u], U.lat[u]] }, properties: {} }] }); };
          on(ring); ring();
        }
        map.on("mousemove", "units-fill", e => { const u = e.features[0].properties.u; map.getCanvas().style.cursor = "pointer";
          setHover(u); showTip(tipOf(u), e.originalEvent.clientX, e.originalEvent.clientY); });
        map.on("mouseleave", "units-fill", () => { map.getCanvas().style.cursor = ""; setHover(null); showTip(null); });
        map.on("click", "units-fill", e => onClick(e.features[0].properties.u));
        new ResizeObserver(() => map.resize()).observe(map.getContainer());
        map.loadedUnits = true; if (ready) ready(map);
      });
      return map;
    };
    archive.getHeader().then(h => {
      header = h;
      const map = liveMap("ap-map", h, u => unitTip(u), selectUnit);
      window.__apMap = map; mapApi.refit = map.refit;
    });

    // ---- heatmap: thumbnail in the row, full grouped heatmap in a subpanel ----
    const LOW = [178, 24, 43], MID = [247, 247, 247], HIGH = [33, 102, 172], NA = [217, 217, 217];
    // vote shares (HJ.ramp "seq", e.g. Canada's party x election columns): white to dark blue up to HJ.max
    const SEQ = [[247, 251, 255], [198, 219, 239], [107, 174, 214], [33, 113, 181], [8, 48, 107]];
    const sramp = v => { if (v < 0 || v == null) return NA; const t = Math.min(1, v / (HJ.max || 100)) * (SEQ.length - 1), i = Math.min(SEQ.length - 2, Math.floor(t));
      return SEQ[i].map((x, j) => Math.round(x + (SEQ[i + 1][j] - x) * (t - i))); };
    const hramp = HJ.ramp === "seq" ? sramp : v => { if (v < 0 || v == null) return NA; const t = v / 100, [a, b, w] = t < 0.5 ? [LOW, MID, t / 0.5] : [MID, HIGH, (t - 0.5) / 0.5];
      return a.map((x, i) => Math.round(x + (b[i] - x) * w)); };
    const nr = HJ.rn.length, nc = HJ.nc, rowOf = new Map(HJ.u.map((u, r) => [u, r]));
    const cells = document.createElement("canvas"); cells.width = nc; cells.height = nr;
    { const cx = cells.getContext("2d"), im = cx.createImageData(nc, nr);
      for (let i = 0; i < nr * nc; i++) { const c = hramp(HJ.v[i]); im.data.set([c[0], c[1], c[2], 255], 4 * i); } cx.putImageData(im, 0, 0); }
    const groups = []; for (let r = 0; r < nr; r++) { const g = groups[groups.length - 1]; if (g && g.b === HJ.rb[r]) g.n++; else groups.push({ b: HJ.rb[r], r0: r, n: 1 }); }
    const wsum = groups.reduce((s, g) => s + Math.max(g.n, HJ.min * nr), 0);
    const layoutGroups = (H, gap) => { let y = 0; const avail = H - gap * (groups.length - 1);
      return groups.map(g => { const h = avail * Math.max(g.n, HJ.min * nr) / wsum, o = { ...g, y, h }; y += h + gap; return o; }); };
    const BLOC_C = Object.fromEntries(HJ.blocs.map(b => [b.b, b]));
    // thumbnail
    { const box = document.getElementById("ap-heat-thumb"), cv = document.createElement("canvas"); box.appendChild(cv);
      const draw = () => { const W = box.clientWidth, H = W, dpr = devicePixelRatio || 1; cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + "px";
        const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
        const bar = 6, gs = layoutGroups(H, 1.5);
        for (const g of gs) { ctx.drawImage(cells, 0, g.r0, nc, g.n, 0, g.y, W - bar - 2, g.h); ctx.fillStyle = BLOC_C[g.b].c; ctx.fillRect(W - bar, g.y, bar, g.h); } };
      new ResizeObserver(draw).observe(box); recolorFns.push(draw);
      const open = () => openTab("heat");
      box.addEventListener("click", open); box.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }); }
    // full heatmap
    let heat = null;
    const buildHeat = host => {
      const GAP = 3, BAR = 30, BAR_GAP = 6;
      const wrap = document.createElement("div"); wrap.className = "atlas-heat-stage";
      const baseC = document.createElement("canvas"), over = document.createElement("canvas"); over.className = "atlas-heat-over";
      const htip = document.createElement("div"); htip.className = "atlas-heat-tip"; htip.hidden = true;
      wrap.append(baseC, over, htip); host.append(wrap);
      let Lh = null, gs = null, pinned = null, inside = null;
      const layout = () => {
        const W = host.clientWidth, H = Math.round(Math.max(340, Math.min(700, W * 0.5))), dpr = devicePixelRatio || 1;
        for (const c of [baseC, over]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.width = W + "px"; c.style.height = H + "px"; }
        gs = layoutGroups(H, GAP); Lh = { W, H, hw: W - BAR - BAR_GAP, dpr };
        const ctx = baseC.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = false;
        ctx.font = "600 12px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (const g of gs) { ctx.drawImage(cells, 0, g.r0, nc, g.n, 0, g.y, Lh.hw, g.h); const b = BLOC_C[g.b];
          ctx.fillStyle = b.c; ctx.fillRect(Lh.hw + BAR_GAP, g.y, BAR, g.h);
          if (g.h >= 13) { ctx.fillStyle = ink(b.c); ctx.fillText(String(b.b), Lh.hw + BAR_GAP + BAR / 2, g.y + g.h / 2 + 0.5); } }
        draw();
      };
      recolorFns.push(() => layout());
      const hit = (x, y) => { if (!Lh || x < 0 || x >= Lh.hw || y < 0 || y >= Lh.H) return null;
        const g = gs.find(g => y >= g.y && y < g.y + g.h); if (!g) return null;
        return { g, r: g.r0 + Math.min(g.n - 1, Math.floor((y - g.y) / g.h * g.n)), c: Math.min(nc - 1, Math.floor(x / Lh.hw * nc)) }; };
      const rowY = r => { const g = gs.find(g => r >= g.r0 && r < g.r0 + g.n); const rh = g.h / g.n; return [g.y + (r - g.r0) * rh, rh]; };
      function draw() {
        if (!Lh) return;
        const ctx = over.getContext("2d"); ctx.setTransform(Lh.dpr, 0, 0, Lh.dpr, 0, 0); ctx.clearRect(0, 0, Lh.W, Lh.H);
        const fb = focusOf("heat");
        if (fb != null) { ctx.fillStyle = "rgba(255,255,255,.6)"; for (const g of gs) if (g.b !== fb) ctx.fillRect(0, g.y, Lh.W, g.h); }
        const h = pinned || inside;
        if (h) {
          const cw = Lh.hw / nc, x0 = h.c * cw, [y0, rh] = rowY(h.r);
          ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.fillRect(0, 0, x0, Lh.H); ctx.fillRect(x0 + cw, 0, Lh.hw - x0 - cw, Lh.H);
          ctx.strokeStyle = "#111"; ctx.lineWidth = 1; ctx.strokeRect(Math.round(x0) - 0.5, 0.5, Math.max(2, Math.round(cw)) + 1, Lh.H - 1);
          ctx.lineWidth = 1.5; ctx.strokeRect(Math.round(x0) - 1.5, y0 - 1.5, Math.max(2, Math.round(cw)) + 3, Math.max(2, rh) + 3);
        }
        // the hovered / selected unit's row, wherever it was picked (map, PCA or here)
        for (const u of hotOf("heat")) { const r = rowOf.get(u); if (r == null) continue;
          const [y0, rh] = rowY(r), yc = y0 + rh / 2;
          ctx.strokeStyle = "#111"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, yc); ctx.lineTo(Lh.hw, yc); ctx.stroke();
          ctx.fillStyle = "#111"; ctx.beginPath(); ctx.moveTo(Lh.W, yc); ctx.lineTo(Lh.W - 8, yc - 5); ctx.lineTo(Lh.W - 8, yc + 5); ctx.fill(); }
      }
      const show = (h, x, y) => {
        if (!h) { htip.hidden = true; return; }
        const q = HJ.q[h.c], b = BLOC_C[h.g.b], word = q.w || (q.k === "dem" ? "Democratic" : "yes"), v = HJ.v[h.r * nc + h.c];
        const p = x => x == null || x < 0 ? "no vote" : `${Math.round(x)}%`;
        htip.innerHTML = `<p class="q">${esc(q.l)}</p>` + (q.d ? `<p class="qd">${esc(q.d)}</p>` : "") +
          `<table><tr><th>${esc(HJ.rn[h.r])}</th><td>${p(v)}${v >= 0 ? " " + word : ""}</td></tr>` +
          `<tr><th><span class="sw" style="background:${b.c};color:${ink(b.c)}">${b.b}</span>${esc(b.nm)} average</th><td>${p(b.a[h.c])}</td></tr>` +
          `<tr><th>${esc(HJ.place)} average</th><td>${p(HJ.all[h.c])}</td></tr></table>` + (pinned ? `<p class="pin">Pinned. Click anywhere on the heatmap to free it.</p>` : "");
        htip.hidden = false;
        const tw = htip.offsetWidth, th = htip.offsetHeight; let tx = x + 14, ty = y + 14;
        if (tx + tw > Lh.W) tx = Math.max(0, x - tw - 14); if (ty + th > Lh.H) ty = Math.max(0, Lh.H - th);
        htip.style.left = tx + "px"; htip.style.top = ty + "px";
      };
      const pos = e => { const r = over.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      // hover always follows the cursor (row marked here, ward lit on the maps); a click pins the readout and picks
      // the ward and its bloc; the next click anywhere on the heatmap frees it, and hovering carries on from there
      over.addEventListener("pointermove", e => { const [x, y] = pos(e), h = hit(x, y);
        setHover(h ? HJ.u[h.r] : null);
        if (pinned) { draw(); return; }
        inside = h; draw(); show(inside, x, y); });
      over.addEventListener("pointerleave", () => { setHover(null); if (!pinned) { inside = null; show(null); } draw(); });
      let lastC = Math.floor(nc / 2);
      over.addEventListener("pointermove", e => { const h = hit(...pos(e)); if (h) lastC = h.c; });
      // a town picked on the map beside the heatmap: pin its row (at the question last looked at); the same town again frees it
      const pinUnit = u => {
        const r = rowOf.get(u);
        if (u == null || (pinned && HJ.u[pinned.r] === u)) { pinned = null; inside = null; show(null); S.heatSel = null; S.heatBloc = null; update(); return; }
        S.heatSel = u; S.heatBloc = U.b[u]; S.sel = u; S.selBloc = U.b[u];
        if (r == null) { pinned = null; show(null); update(); return; }   // not among the heatmap's sampled rows
        const g = gs.find(g => r >= g.r0 && r < g.r0 + g.n), [y0, rh] = rowY(r), cw = Lh.hw / nc;
        const x = (lastC + 0.5) * cw, y = y0 + rh / 2;
        pinned = { g, r, c: lastC, x, y }; inside = pinned; update(); show(pinned, x, y);
      };
      over.addEventListener("click", e => { const [x, y] = pos(e), h = hit(x, y);
        pinned = pinned ? null : h ? Object.assign(h, { x, y }) : null;
        inside = h; draw(); show(h, x, y);
        if (pinned && HJ.u[h.r] != null) { const u = HJ.u[h.r]; S.heatSel = u; S.heatBloc = U.b[u]; S.sel = u; S.selBloc = U.b[u]; }
        else { S.heatSel = null; S.heatBloc = null; }
        update(); });
      let t; new ResizeObserver(() => { clearTimeout(t); t = setTimeout(layout, 60); }).observe(host);
      layout(); on(draw);
      return { draw, pinUnit };
    };

    // ---- subpanels: one at a time, chosen by tab or by what was clicked ----
    const subp = document.getElementById("ap-subpanel"), tabs = [...subp.querySelectorAll("[data-tab]")];
    const pane = t => subp.querySelector(`[data-pane="${t}"]`);
    let demogBuilt = false;
    const BIG = {};
    const ENLARGE = (k, t) => `<button type="button" class="ap-enlarge" data-target="${k}" aria-label="Enlarge the ${esc(t)} plot" title="Enlarge">` +
      `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5l-5 5M6.5 13.5h-4v-4M2.5 13.5l5-5"/></svg></button>`;
    function openTab(t) {
      S.tab = t; subp.classList.toggle("open", !!t); subp.querySelector(".ap-sub-close").hidden = !t;   // the tab bar always shows
      tabs.forEach(b => { b.setAttribute("aria-selected", String(b.dataset.tab === t)); b.tabIndex = b.dataset.tab === t ? 0 : -1; });
      subp.querySelectorAll("[data-pane]").forEach(p => p.hidden = p.dataset.pane !== t);
      if (t === "demog" && !demogBuilt) { demogBuilt = true; buildDemog(); }
      if (t === "heat" && !heat) { heat = buildHeat(pane("heat").querySelector(".ap-heat-plot")); buildMiniMap(); }
      if (t === "bloc") renderBloc(); if (t === "unit") renderUnit();
      if (t) { const r = subp.getBoundingClientRect(); if (r.top > innerHeight - 120) subp.scrollIntoView({ behavior: "smooth", block: "start" }); }
      views.forEach(w => w.dirty = true);
    }
    tabs.forEach(b => b.addEventListener("click", () => openTab(S.tab === b.dataset.tab ? null : b.dataset.tab)));
    openTab(null);
    subp.querySelector(".ap-sub-close").addEventListener("click", () => openTab(null));
    document.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => openTab(b.dataset.open)));
    on(() => { if (S.tab === "bloc") renderBloc(); if (S.tab === "unit") renderUnit(); });

    // the heatmap's companion: the map at a fixed scale (no zoom or pan), marking the ward under the cursor
    function buildMiniMap() {
      const box = pane("heat").querySelector(".ap-mini-map"), lab = pane("heat").querySelector(".ap-mini-name");
      const go = h => {
        const mm = new maplibregl.Map({ container: box, style: "https://tiles.openfreemap.org/styles/positron", interactive: true,
          dragPan: false, scrollZoom: false, boxZoom: false, dragRotate: false, doubleClickZoom: false, keyboard: false, touchZoomRotate: false, touchPitch: false,
          bounds: D.view || [[h.minLon, h.minLat], [h.maxLon, h.maxLat]], fitBoundsOptions: { padding: 6 }, attributionControl: { compact: true },
          preserveDrawingBuffer: /[?&]test/.test(location.search) });
        mm.once("load", () => mm.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));
        mm.once("style.load", () => {
          const style = mm.getStyle();                // a quieter basemap: no place labels at this scale
          style.layers.filter(l => l.type === "symbol").forEach(l => mm.setLayoutProperty(l.id, "visibility", "none"));
          addUnits(mm, undefined, { scope: "heat" });
          mm.on("mousemove", "units-fill", e => { const u = e.features[0].properties.u; mm.getCanvas().style.cursor = "pointer"; setHover(u); });
          mm.on("mouseleave", "units-fill", () => { mm.getCanvas().style.cursor = ""; setHover(null); });
          mm.on("click", "units-fill", e => heat && heat.pinUnit(e.features[0].properties.u));
          // a ring around the ward, which at this scale may be only a few pixels across
          mm.addSource("ring", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          mm.addLayer({ id: "ring", type: "circle", source: "ring", paint: { "circle-radius": 11, "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-width": 2.5, "circle-stroke-color": "#111" } });
          mm.addLayer({ id: "ring-halo", type: "circle", source: "ring", paint: { "circle-radius": 13.5, "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-width": 2, "circle-stroke-color": "#fff" } }, "ring");
          let last;
          const ring = () => { const u = S.hover != null ? S.hover : S.heatSel; if (u === last) return; last = u;
            mm.getSource("ring").setData({ type: "FeatureCollection", features: u == null || U.lon[u] == null ? [] :
              [{ type: "Feature", geometry: { type: "Point", coordinates: [U.lon[u], U.lat[u]] }, properties: {} }] }); };
          on(ring); ring();
        });
        window.__apMini = mm;
      };
      if (header) go(header); else archive.getHeader().then(go);
      on(() => { const u = S.hover != null ? S.hover : S.heatSel;
        lab.innerHTML = u == null ? "&nbsp;" : `${swatch(B[U.b[u]], "sm")}${esc(U.name[u])}`; });
    }
    function buildDemog() {
      const lg = G.legend, host = pane("demog");
      const fmt = x => Math.round(x).toLocaleString("en-US"), fmtD = d => d >= 1000 ? fmt(d / 1000) + "k" : fmt(d);
      const grad = stops => `linear-gradient(90deg, ${stops.map((c, i) => `${c} ${Math.round(100 * i / (stops.length - 1))}%`).join(", ")})`;
      const K = G.panels ? G.panels.map(x => ({ ...x })) : [
        { k: "dens", t: "Population density", key: `<h4>Residents per km&sup2;</h4><div class="ap-ramp" style="background:${grad(lg.dens_stops)}"></div>` +
            `<div class="ap-ticks">${lg.ticks.map((x, i) => `<span style="left:${(100 * lg.ticks_s[i]).toFixed(1)}%">${fmtD(x)}</span>`).join("")}</div>` +
            `<p>Ranked within ${esc(D.title)}, so ticks sit at shares of ${D.unit}; the median has ${fmt(lg.dens_median)} per km&sup2;.</p>` },
        { k: "race", t: "Racial composition", key: `<h4>Racial composition</h4><ul class="ap-race">${lg.chips.map(c => `<li><span style="background:${c.col}"></span>${c.name}</li>`).join("")}</ul>` +
            `<p>Colors mix in proportion to each group&rsquo;s share (2020 Census).</p>` },
        { k: "ba", t: "Bachelor’s degree", key: `<h4>Bachelor&rsquo;s degree or higher, adults 25+</h4><div class="ap-ramp" style="background:${grad(lg.ba_stops)}"></div>` +
            `<div class="ap-ticks">${[0, 20, 40, 60, 75].map(x => `<span style="left:${(100 * x / 75).toFixed(1)}%">${x}%${x === 75 ? "+" : ""}</span>`).join("")}</div>` +
            `<p>One scale for every place (ACS 2020&ndash;24). ${esc(D.title)} overall: ${Math.round(100 * lg.ba_place)}%.</p>` },
        { k: "dem", t: "Partisanship", key: `<h4>${esc(PRES_WHO)} share of the ${PRES_YR} presidential vote</h4><div class="ap-ramp" style="background:${grad(DEM_STOPS)}"></div>` +
            `<div class="ap-ticks">${[0, 25, 50, 75, 100].map(x => `<span style="left:${x}%">${x}%</span>`).join("")}</div>` +
            `<p>Two-candidate share (Democrat against Republican). ${esc(D.title)} overall: ${PRES_PLACE == null ? "&ndash;" : Math.round(PRES_PLACE) + "%"}. Gray: no returns.</p>` } ];
      if (!G.panels && !biden.some(v => v != null)) K.splice(K.findIndex(x => x.k === "dem"), 1);   // no presidential returns for this place
      host.innerHTML = `<div class="ap-demog-grid">${K.map(x => `<figure><div class="ap-title">${x.t}${ENLARGE(x.k, x.t)}</div>` +
          `<div data-slot="${x.k}"><div class="ap-pca ap-pca-sm" id="ap-pca-${x.k}"></div></div><figcaption>${x.key}</figcaption></figure>`).join("")}</div>` +
        (G.note ? `<p class="ap-note">${G.note}</p>` : `<p class="ap-note">The same points and the same turning view as the PCA above. Hover a bloc in the list to bring it forward here too. ` +
        `PC1 accounts for ${Math.round(100 * lg.r2_pc1_logdens)}% of the variation in log density, ${Math.round(100 * lg.r2_pc1_white)}% in white share and ` +
        `${Math.round(100 * lg.r2_pc1_ba)}% in bachelor&rsquo;s share across these ${D.unit}. Gray: no residents (no returns for partisanship).</p>`);
      host.querySelector(".ap-demog-grid").style.setProperty("--n", K.length);
      // readouts for data-defined panels: G.tipfmt[k] with {v} for the unit's value G.val[k]
      const tipOf = k => demogTip[k] || (G.tipfmt && G.tipfmt[k] ? u => G.val[k][u] != null ? `<div class="ap-tnum">${G.tipfmt[k].replace("{v}", G.val[k][u].toLocaleString("en-US"))}</div>` : "" : null);
      K.forEach(x => { makePCA(document.getElementById("ap-pca-" + x.k), i => G.col[x.k][i], tipOf(x.k), pcaClick(false), true); BIG[x.k] = { title: x.t, key: x.key }; });
      host.querySelectorAll(".ap-enlarge").forEach(wireEnlarge);
    }

    // bloc and unit profiles: the atlas's bloc_profiles.js layout
    const RAMP = (m, lo = [227, 236, 245], hi = [29, 69, 128]) => Array.from({ length: m }, (_, i) => { const t = m === 1 ? 1 : i / (m - 1);
      return "#" + lo.map((a, j) => Math.round(a + (hi[j] - a) * t).toString(16).padStart(2, "0")).join(""); });
    const withCols = (cats, cols) => cats.map((c, i) => [c[0], c[1], cols[i]]);
    // a place can bring its own topics (PF.topics, e.g. Canada's party shares by election) instead of the ACS ones
    const TOPICS = PF.topics || [
      { k: "race", t: "Race and ethnicity", cats: [["white", "White", "#E31A1C"], ["hispanic", "Hispanic", "#F2C200"], ["aian", "American Indian", "#00A9A5"],
        ["black", "Black", "#1F78B4"], ["asian", "Asian", "#33A02C"], ["other", "Other or multiracial", "#B5B1A7"]] },
      { k: "language", t: "Language spoken at home", cats: [["english", "English only", "#CFCAC0"], ["spanish", "Spanish", "#F2C200"],
        ["indo_euro", "Other European", "#C86B98"], ["asian", "Asian &amp; Pacific Island", "#33A02C"],
        PF.native_share >= 0.5 ? ["other", "Native American &amp; other", "#00A9A5"] : ["other", "Arabic &amp; other", "#8E6BB8"]] },
      { k: "nativity", t: "Nativity and citizenship", cats: [["native", "Native-born", "#CFCAC0"], ["naturalized", "Naturalized citizen", "#6FA0CC"], ["noncitizen", "Not a citizen", "#1D4580"]] },
      { k: "education", t: "Education, adults 25+", cats: withCols([["lt_hs", "No diploma"], ["hs", "High school"], ["some_college", "Some college"], ["ba", "Bachelor&rsquo;s"], ["grad", "Graduate"]], RAMP(5)) },
      { k: "income", t: "Household income", cats: withCols([["lt25", "Under $25k"], ["i25_50", "$25&ndash;50k"], ["i50_75", "$50&ndash;75k"], ["i75_100", "$75&ndash;100k"],
        ["i100_150", "$100&ndash;150k"], ["i150", "$150k+"]], RAMP(6)) },
      { k: "poverty", t: "Income against the poverty line", cats: withCols([["below", "Below poverty"], ["near", "1&ndash;2&times; poverty"], ["above", "2&times; or more"]], RAMP(3).reverse()) } ];
    const bar = (vals, cats, label, who) => `<div class="bp-row"><span class="bp-who">${who}</span><div class="bp-bar">` +
      cats.filter(c => vals[c[0]] > 0.0005).map(c => { const v = vals[c[0]];
        return `<span class="bp-seg" style="flex:${v} 1 0;background:${c[2]};color:${ink(c[2])}" data-tip="${c[1]}: <b>${pct(v)}</b> ${label}">${v >= 0.09 ? pct(v) : ""}</span>`; }).join("") + "</div></div>";
    const placeLab = PF.title, note = who => PF.note || `Race from 2020 Census blocks; everything else from the ACS 2020&ndash;24 (block groups; language and nativity by tract), shared out to blocks by population and summed over ${who}.`;
    function renderBloc() {
      const host = pane("bloc"), b = S.selBloc;
      if (b == null) { delete host.dataset.b; host.innerHTML = ""; return; }
      if (host.dataset.b === String(b)) return; host.dataset.b = b;
      const p = PF.blocs[b], all = PF.place, bl = B[b];
      host.innerHTML = `<header class="bp-head">${swatch(bl, "lg")}<div><h3>${esc(bl.name)}</h3><p>${bl.n.toLocaleString()} ${D.unit} &middot; ${bl.vote} ${Math.round(100 * bl.dem)}% &middot; ` +
        `${p.pop.toLocaleString("en-US")} residents (${pct(p.pop / all.pop)} of ${placeLab})</p></div></header>` +
        `<div class="bp-grid">${TOPICS.map(T => `<section><h4>${T.t}</h4>` +
          (T.k === "income" ? `<p class="bp-stat">Median <b>${money(p.median_income)}</b> <span>(${placeLab} ${money(all.median_income)})</span></p>` : "") +
          bar(p[T.k], T.cats, "in bloc " + b, "Bloc " + b) + bar(all[T.k], T.cats, "in " + placeLab, placeLab) +
          `<ul class="bp-key">${T.cats.map(c => `<li><span style="background:${c[2]}"></span>${c[1]} <b>${pct(p[T.k][c[0]])}</b> <i>${pct(all[T.k][c[0]])}</i></li>`).join("")}</ul></section>`).join("")}</div>` +
        `<p class="bp-note">Bold: the bloc; gray: ${placeLab} overall. ${note("the bloc&rsquo;s " + D.unit)}</p>`;
    }
    function renderUnit() {
      const host = pane("unit"), i = S.sel;
      if (i == null) { delete host.dataset.u; host.innerHTML = `<p class="ap-hint">Click a ${unitWord} on the map or a row of the heatmap for its profile.</p>`; return; }
      if (host.dataset.u === String(i)) return; host.dataset.u = i;
      host.innerHTML = unitHTML(i);
    }
    function unitHTML(i) {
      const b = U.b[i], p = PF.blocs[b], all = PF.place, bl = B[b], who = esc(U.name[i]), pop = G.pop[i];
      const val = (T, c) => { const v = G.shares[T.k][c[0]][i]; return v == null ? null : v / 100; };
      const p1 = x => x == null ? "&ndash;" : pct(x);
      const hasPop = PF.topics ? TOPICS.some(T => G.shares[T.k][T.cats[0][0]][i] != null) : pop > 0 && G.shares.race.white[i] != null;
      const cert = U.p[i] == null || U.measure === "none" ? "Assignment certainty not recorded for this fit" :
        (U.measure === "stability" ? `In this bloc in <b>${pct(U.p[i])}</b> of the model&rsquo;s posterior samples` : `<b>${pct(U.p[i])}</b> probability of belonging to this bloc` +
          (G.alt[i] != null && G.alt_p[i] >= 0.01 ? `; next most likely bloc ${G.alt[i]} (${pct(G.alt_p[i])})` : ""));
      const meter = U.p[i] == null ? "" : `<span class="uc-meter" title="Assignment certainty"><span data-sbg="${bl.b}" style="width:${Math.round(100 * U.p[i])}%;background:${bl.color}"></span></span>`;
      return `<header class="bp-head">${swatch(bl, "lg")}<div><h3>${who}</h3><p>${esc(bl.name)} (bloc ${b}) &middot; ${(pop || 0).toLocaleString("en-US")} residents</p>` +
        `<p class="uc-cert">${meter}${cert}</p></div></header>` +
        (!hasPop ? `<p class="bp-note">${PF.topics ? `No votes are recorded in this ${unitWord}.` : `No residents are recorded in this ${unitWord} (2020 Census), so it has no demographic summary.`}</p>` :
        `<div class="bp-grid uc">${TOPICS.map(T => { const uv = Object.fromEntries(T.cats.map(c => [c[0], val(T, c) || 0])), mi = G.median_income[i];
          return `<section><h4>${T.t}</h4>` + (T.k === "income" ? `<p class="bp-stat">Median <b>${mi == null ? "&ndash;" : money(mi)}</b> <span>(bloc ${money(p.median_income)}, ${placeLab} ${money(all.median_income)})</span></p>` : "") +
            bar(uv, T.cats, "in " + who, who) + bar(p[T.k], T.cats, "in bloc " + b, "Bloc " + b) + bar(all[T.k], T.cats, "in " + placeLab, placeLab) +
            `<ul class="bp-key">${T.cats.map(c => `<li><span style="background:${c[2]}"></span>${c[1]} <b>${p1(val(T, c))}</b> <i>${pct(p[T.k][c[0]])} &middot; ${pct(all[T.k][c[0]])}</i></li>`).join("")}</ul></section>`; }).join("")}</div>` +
        `<p class="bp-note">Bold: this ${unitWord}; gray: bloc ${b} &middot; ${placeLab} overall. ${note("the " + unitWord)}${PF.topics ? "" : ` For a single ${unitWord} these survey estimates carry wide margins of error.`}</p>`);
    }
    subp.addEventListener("pointermove", e => { const s = e.target.closest(".bp-seg"); if (s) showTip(s.dataset.tip, e.clientX, e.clientY); else if (!e.target.closest("canvas")) showTip(null); });
    subp.addEventListener("pointerleave", () => showTip(null));

    // ---- enlarge: move the live PCA / map into a dialog and back ----
    const bigSlot = dlg.querySelector(".ap-big-slot"), bigKey = dlg.querySelector(".ap-big-key"), bigProf = dlg.querySelector(".ap-big-profile");
    const bigBlocs = dlg.querySelector(".ap-big-blocs");
    dlg.querySelector(".ap-big-blocs").innerHTML = ol.innerHTML;
    dlg.querySelectorAll(".ap-big-blocs li").forEach(li => { const b = +li.dataset.b;
      li.addEventListener("pointerenter", () => { if (S.hoverBloc !== b) { S.hoverBloc = b; update(); } });
      li.addEventListener("click", () => { S.dlgBloc = S.dlgBloc === b ? null : b; update(); }); });
    dlg.querySelector(".ap-big-blocs").addEventListener("pointerleave", () => { S.hoverBloc = null; update(); });
    on(() => dlg.querySelectorAll(".ap-big-blocs li").forEach(li => { const b = +li.dataset.b, f = focusOf("dlg");
      li.classList.toggle("on", f === b); li.classList.toggle("sel", S.dlgBloc === b); li.classList.toggle("fade", f != null && f !== b); }));
    const bigMapBox = dlg.querySelector(".ap-big-mapbox");
    let bigMap = null, bigWhich = null;
    const demogExpr = {};
    const bigColor = which => which === "pca" ? color : (demogExpr[which] = demogExpr[which] ||
      ["match", ["get", "u"], ...U.id.flatMap((_, i) => [i, G.col[which][i]]), "#bdbdbd"]);
    const paintBig = () => { if (bigMap && bigMap.loadedUnits && bigWhich) bigMap.setPaintProperty("units-fill", "fill-color", bigColor(bigWhich)); };
    const showBigMap = which => {
      bigWhich = which; bigMapBox.hidden = false;
      if (!bigMap) {
        const go = h => { bigMap = liveMap(bigMapBox.querySelector(".ap-big-map"), h,
          u => unitTip(u, bigWhich !== "pca" && demogTip[bigWhich] ? demogTip[bigWhich](u) : ""), u => dialogUnit(u), () => { paintBig(); bigMap.refit(); }, { fade: false, outlines: true, scope: "dlg" });
          window.__apBigMap = bigMap; };
        if (header) go(header); else archive.getHeader().then(go);
      } else { paintBig(); bigMap.refit(); }
    };
    let moved = null;
    const restore = () => { if (moved) { moved.home.appendChild(moved.el); if (moved.which === "map") mapApi.refit(); moved = null; } };
    const bigStat = dlg.querySelector(".ap-big-stat");
    const median = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
    const statRow = (who, val, max, col, txt) => `<div class="ap-srow"><span class="ap-swho">${who}</span><span class="ap-sbar"><span style="width:${Math.max(0, Math.min(100, 100 * val / max))}%;background:${col}"></span></span><span class="ap-sval">${txt}</span></div>`;
    function demogStat(which, u) {
      const b = U.b[u], bl = B[b], ids = [...Array(N).keys()].filter(i => U.b[i] === b), who = esc(U.name[u]);
      const head = `<div class="ap-stat-head">${swatch(bl, "sm")}<b>${who}</b><span>${esc(bl.name)}</span></div>`;
      if (which === "race") {
        const cats = TOPICS[0].cats, uv = Object.fromEntries(cats.map(c => [c[0], (G.shares.race[c[0]][u] || 0) / 100]));
        return head + (G.pop[u] > 0 ? bar(uv, cats, "in " + who, who) : `<p class="ap-hint">No residents recorded.</p>`) +
          bar(PF.blocs[b].race, cats, "in bloc " + b, "Bloc " + b) + bar(PF.place.race, cats, "in " + placeLab, placeLab) +
          `<ul class="bp-key">${cats.map(c => `<li><span style="background:${c[2]}"></span>${c[1]} <b>${G.shares.race[c[0]][u] == null ? "&ndash;" : G.shares.race[c[0]][u] + "%"}</b></li>`).join("")}</ul>`;
      }
      if (which === "dens") {
        const lg = G.legend, bm = median(ids.map(i => G.dens[i])), mx = Math.max(G.dens[u] || 0, bm || 0, lg.dens_median) * 1.1, f = x => x == null ? "&ndash;" : Math.round(x).toLocaleString();
        const c = G.col.dens[u];
        return head + statRow(who, G.dens[u] || 0, mx, c, f(G.dens[u])) + statRow(`Bloc ${b} median`, bm || 0, mx, "#9aa3ad", f(bm)) +
          statRow(`${placeLab} median`, lg.dens_median, mx, "#c9ced3", f(lg.dens_median)) + `<p class="ap-note">Residents per km&sup2;.</p>`;
      }
      if (which === "ba") {
        const sh = i => { const e = G.shares.education; return e.ba[i] == null ? null : (e.ba[i] + e.grad[i]) / 100; };
        const pe = e => e.ba + e.grad, v = sh(u), f = x => x == null ? "&ndash;" : pct(x);
        return head + statRow(who, v || 0, 1, G.col.ba[u], f(v)) + statRow(`Bloc ${b}`, pe(PF.blocs[b].education), 1, "#9aa3ad", f(pe(PF.blocs[b].education))) +
          statRow(placeLab, pe(PF.place.education), 1, "#c9ced3", f(pe(PF.place.education))) + `<p class="ap-note">Adults 25+ with a bachelor&rsquo;s degree or higher (ACS 2020&ndash;24).</p>`;
      }
      const v = biden[u], f = x => x == null ? "&ndash;" : Math.round(x) + "%";
      return head + statRow(who, v || 0, 100, demColor(v), f(v)) + statRow(`Bloc ${b}`, 100 * bl.dem, 100, demColor(100 * bl.dem), f(100 * bl.dem)) +
        statRow(placeLab, PRES_PLACE || 0, 100, demColor(PRES_PLACE), f(PRES_PLACE)) + `<p class="ap-note">${esc(PRES_WHO)}&rsquo;s two-candidate share, ${PRES_YR} presidential election.</p>`;
    }
    function dialogUnit(u) {                      // a ward clicked in the enlarged view
      S.dlgSel = u; update();
      if (bigWhich && bigWhich !== "pca") {        // demographic views: mark it on the map, summarise the variable below
        bigStat.innerHTML = demogStat(bigWhich, u); bigStat.hidden = false; return;
      }
      bigProf.innerHTML = `<button type="button" class="ap-back">&larr; All blocs</button>` + unitHTML(u);
      bigProf.hidden = false; bigBlocs.hidden = true; bigKey.hidden = true; dlg.classList.add("prof");
      if (bigMap && !bigMapBox.hidden) bigMap.refit();
      bigProf.querySelector(".ap-back").addEventListener("click", dialogBack);
    }
    function dialogBack() { bigStat.hidden = true; bigStat.innerHTML = ""; bigProf.hidden = true; bigProf.innerHTML = ""; bigBlocs.hidden = false; bigKey.hidden = !bigKey.innerHTML; dlg.classList.remove("prof");
      if (bigMap && !bigMapBox.hidden) bigMap.refit(); }
    function wireEnlarge(btn) { btn.addEventListener("click", () => {
      restore(); dialogBack(); S.dlgSel = null; S.dlgBloc = null; update();
      const which = btn.dataset.target, el = document.getElementById(which === "map" ? "ap-map" : which === "pca" ? "ap-pca" : "ap-pca-" + which);
      moved = { el, home: document.querySelector(`[data-slot="${which}"]`), btn, which };
      bigSlot.className = "ap-big-slot " + (which === "map" ? "map" : "pca"); bigSlot.appendChild(el);
      const t = which === "map" ? "Map" : which === "pca" ? "PCA" : BIG[which].title;
      document.getElementById("ap-big-title").textContent = `${D.title} · ${t}`;
      bigKey.innerHTML = BIG[which] ? BIG[which].key : ""; bigKey.hidden = !bigKey.innerHTML;
      dlg.showModal(); if (which === "map") mapApi.refit();
      if (which === "map") bigMapBox.hidden = true; else showBigMap(which);
      views.forEach(w => w.dirty = true);
    }); }
    document.querySelectorAll(".ap-grid .ap-enlarge").forEach(wireEnlarge);
    dlg.querySelector(".ap-big-close").addEventListener("click", () => dlg.close());
    const ACTIVE = "canvas, button, li, a, input, .ap-big-profile, .ap-big-stat, .ap-big-key, .atlas-heat-tip, .maplibregl-ctrl";
    document.addEventListener("click", e => {
      if (dlg.open) {                               // inside the enlarged view: a click on empty space clears its selection
        if (e.target === dlg || e.target.closest(ACTIVE)) return;
        if (S.dlgSel != null || S.dlgBloc != null) { S.dlgSel = null; S.dlgBloc = null; dialogBack(); update(); }
        return;
      }
      if (e.target.closest(".ap-col, .ap-subpanel, dialog, .ap-tip")) return;
      if (S.sel != null || S.selBloc != null || S.heatSel != null) { S.sel = null; S.selBloc = null; S.heatSel = null; S.heatBloc = null; update(); }
    });
    dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });

    // ---- colour scheme: the button beside the place's name switches every bloc colour on the page ----
    const hcBtn = document.getElementById("ap-hc");
    let hcCols = null;
    const setScheme = hc => {
      if (hc && !hcCols) hcCols = window.atlasHighContrast(D);
      D.blocs.forEach(b => { b.color = hc ? hcCols[b.b] : b.national; });
      HJ.blocs.forEach(b => { if (B[b.b]) b.c = B[b.b].color; });
      color = blocExpr();
      unitMaps.forEach(m => { try { if (m === bigMap) paintBig(); else if (m.getLayer("units-fill")) m.setPaintProperty("units-fill", "fill-color", color); } catch (e) {} });
      document.querySelectorAll("[data-sb]").forEach(el => { const c = B[+el.dataset.sb].color; el.style.background = c; el.style.color = ink(c); });
      document.querySelectorAll("[data-sbg]").forEach(el => { el.style.background = B[+el.dataset.sbg].color; });
      recolorFns.forEach(f => f());
      views.forEach(w => w.dirty = true);
      if (heat && heat.draw) heat.draw();
      hcBtn.setAttribute("aria-pressed", String(hc));
      try { hc ? sessionStorage.setItem("atlas-hc", "1") : sessionStorage.removeItem("atlas-hc"); } catch (e) {}
    };
    hcBtn.addEventListener("click", () => setScheme(hcBtn.getAttribute("aria-pressed") !== "true"));
    hcBtn.hidden = false;
    let hcSaved = false; try { hcSaved = sessionStorage.getItem("atlas-hc") === "1"; } catch (e) {}
    if (hcSaved) setScheme(true);         // kept while moving between places in this visit; a new visit starts national
    dlg.addEventListener("close", () => { if (dlg.open) return; const b = moved && moved.btn; restore(); dialogBack(); if (b) b.focus(); showTip(null); });
    update();
  }).catch(e => { root.insertAdjacentHTML("beforeend", `<p class="ap-hint">Could not load the data (${esc(e.message)}).</p>`); });
})();
