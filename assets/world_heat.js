// Clickable heatmap for a World-page country (a figure ["heat.json", caption] in its FITTED entry):
// one row per unit, grouped by bloc (bar on the right), one column per list x election. Hover reads out the cell
// (unit, its share, its bloc's and the country's average); a click pins the readout, the next click frees it.
// Data (assets/world/<key>_heat.json): rn row names, rb row blocs, v row-major values (%), nc, q [{l, h, e}] columns,
// blocs [{b, c, nm, n, a}], all (country averages), min (smallest bloc height as a share of rows),
// stops [[value, colour], ...] colour ramp, key (ramp caption).
(function () {
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const ink = c => { const [r, g, b] = hex(c).map(x => (x / 255) ** 2.2); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? "#111" : "#fff"; };
  window.worldHeat = function (host, url) {
    host.innerHTML = `<p class="atlas-heat-hint">Loading heatmap…</p>`;
    fetch(url).then(r => { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); }).then(HJ => {
      const stops = HJ.stops.map(([x, c]) => [x, hex(c)]);
      const ramp = v => { if (v == null || v < 0) return [217, 217, 217];
        if (v <= stops[0][0]) return stops[0][1]; const L = stops[stops.length - 1]; if (v >= L[0]) return L[1];
        let i = 0; while (v > stops[i + 1][0]) i++; const [x0, a] = stops[i], [x1, b] = stops[i + 1], t = (v - x0) / (x1 - x0);
        return a.map((y, j) => Math.round(y + (b[j] - y) * t)); };
      const nr = HJ.rn.length, nc = HJ.nc, B = Object.fromEntries(HJ.blocs.map(b => [b.b, b]));
      const cells = document.createElement("canvas"); cells.width = nc; cells.height = nr;
      { const cx = cells.getContext("2d"), im = cx.createImageData(nc, nr);
        for (let i = 0; i < nr * nc; i++) { const c = ramp(HJ.v[i]); im.data.set([c[0], c[1], c[2], 255], 4 * i); } cx.putImageData(im, 0, 0); }
      const groups = []; for (let r = 0; r < nr; r++) { const g = groups[groups.length - 1]; if (g && g.b === HJ.rb[r]) g.n++; else groups.push({ b: HJ.rb[r], r0: r, n: 1 }); }
      const wsum = groups.reduce((s, g) => s + Math.max(g.n, HJ.min * nr), 0);
      const grad = `linear-gradient(90deg, ${HJ.stops.map(([x, c]) => `${c} ${Math.round(100 * x / HJ.stops[HJ.stops.length - 1][0])}%`).join(", ")})`;
      host.innerHTML = `<p class="atlas-heat-hint">Hover for a district's share; click to pin it. ${nr.toLocaleString()} rows, grouped by bloc (bar on the right).</p>` +
        `<div class="wh-cols"></div><div class="atlas-heat-stage"></div>` +
        `<div class="wh-key"><span class="wh-ramp" style="background:${grad}"></span><span>${esc(HJ.key || "")}</span></div>`;
      const colsBox = host.querySelector(".wh-cols"), wrap = host.querySelector(".atlas-heat-stage");
      const baseC = document.createElement("canvas"), over = document.createElement("canvas"); over.className = "atlas-heat-over";
      const tip = document.createElement("div"); tip.className = "atlas-heat-tip"; tip.hidden = true;
      wrap.append(baseC, over, tip);
      const GAP = 3, BAR = 30, BAR_GAP = 6;
      let Lh = null, gs = null, pinned = null, inside = null;
      const layout = () => {
        const W = host.clientWidth, H = Math.round(Math.max(420, Math.min(820, W * 0.75))), dpr = devicePixelRatio || 1;
        for (const c of [baseC, over]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.width = W + "px"; c.style.height = H + "px"; }
        let y = 0; const avail = H - GAP * (groups.length - 1);
        gs = groups.map(g => { const h = avail * Math.max(g.n, HJ.min * nr) / wsum, o = { ...g, y, h }; y += h + GAP; return o; });
        Lh = { W, H, hw: W - BAR - BAR_GAP, dpr };
        // column headers: election over list, election boundaries marked
        colsBox.style.width = Lh.hw + "px";
        colsBox.innerHTML = HJ.q.map((q, j) => `<span style="left:${(100 * (j + 0.5) / nc).toFixed(2)}%">` +
          `${j === 0 || HJ.q[j - 1].e !== q.e ? `<b>${esc(q.e)}</b>` : "<b>&nbsp;</b>"}${esc(q.h)}</span>`).join("");
        const ctx = baseC.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = false;
        ctx.font = "600 12px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (const g of gs) { ctx.drawImage(cells, 0, g.r0, nc, g.n, 0, g.y, Lh.hw, g.h); const b = B[g.b];
          ctx.fillStyle = b.c; ctx.fillRect(Lh.hw + BAR_GAP, g.y, BAR, g.h);
          if (g.h >= 13) { ctx.fillStyle = ink(b.c); ctx.fillText(String(b.b), Lh.hw + BAR_GAP + BAR / 2, g.y + g.h / 2 + 0.5); } }
        ctx.fillStyle = "#fff";
        for (let j = 1; j < nc; j++) if (HJ.q[j].e !== HJ.q[j - 1].e) ctx.fillRect(Math.round(j * Lh.hw / nc) - 1, 0, 2, H);
        draw();
      };
      const hit = (x, y) => { if (!Lh || x < 0 || y < 0 || y >= Lh.H) return null;
        const g = gs.find(g => y >= g.y && y < g.y + g.h); if (!g) return null;
        if (x >= Lh.hw) return x >= Lh.hw + BAR_GAP && x < Lh.W ? { g, bar: true } : null;
        return { g, r: g.r0 + Math.min(g.n - 1, Math.floor((y - g.y) / g.h * g.n)), c: Math.min(nc - 1, Math.floor(x / Lh.hw * nc)) }; };
      const rowY = r => { const g = gs.find(g => r >= g.r0 && r < g.r0 + g.n); const rh = g.h / g.n; return [g.y + (r - g.r0) * rh, rh]; };
      function draw() {
        if (!Lh) return;
        const ctx = over.getContext("2d"); ctx.setTransform(Lh.dpr, 0, 0, Lh.dpr, 0, 0); ctx.clearRect(0, 0, Lh.W, Lh.H);
        const h = pinned || inside; if (!h) return;
        if (h.bar) { ctx.fillStyle = "rgba(255,255,255,.6)"; for (const g of gs) if (g.b !== h.g.b) ctx.fillRect(0, g.y, Lh.W, g.h); return; }
        const cw = Lh.hw / nc, x0 = h.c * cw, [y0, rh] = rowY(h.r), yc = y0 + rh / 2;
        ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.fillRect(0, 0, x0, Lh.H); ctx.fillRect(x0 + cw, 0, Lh.hw - x0 - cw, Lh.H);
        ctx.strokeStyle = "#111"; ctx.lineWidth = 1; ctx.strokeRect(Math.round(x0) - 0.5, 0.5, Math.round(cw) + 1, Lh.H - 1);
        ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, yc); ctx.lineTo(Lh.hw, yc); ctx.stroke();
        ctx.fillStyle = "#111"; ctx.beginPath(); ctx.moveTo(Lh.W, yc); ctx.lineTo(Lh.W - 8, yc - 5); ctx.lineTo(Lh.W - 8, yc + 5); ctx.fill();
      }
      const p = x => x == null || x < 0 ? "no vote" : `${Math.round(x)}%`;
      const sw = b => `<span class="sw" style="background:${b.c};color:${ink(b.c)}">${b.b}</span>`;
      const show = (h, x, y) => {
        if (!h) { tip.hidden = true; return; }
        const b = B[h.g.b];
        if (h.bar) tip.innerHTML = `<p class="q">${sw(b)}Bloc ${b.b}: ${esc(b.nm)}</p><p class="qd">${b.n.toLocaleString()} districts</p>` +
          `<table>${HJ.q.map((q, j) => `<tr><th>${esc(q.e)} ${esc(q.h)}</th><td>${p(b.a[j])}</td></tr>`).join("")}</table>`;
        else { const q = HJ.q[h.c];
          tip.innerHTML = `<p class="q">${esc(q.l)}</p>` +
            `<table><tr><th>${esc(HJ.rn[h.r])}</th><td>${p(HJ.v[h.r * nc + h.c])}</td></tr>` +
            `<tr><th>${sw(b)}${esc(b.nm)} (bloc average)</th><td>${p(b.a[h.c])}</td></tr>` +
            `<tr><th>${esc(HJ.place)} average</th><td>${p(HJ.all[h.c])}</td></tr></table>`; }
        if (pinned) tip.innerHTML += `<p class="pin">Pinned. Click anywhere on the heatmap to free it.</p>`;
        tip.hidden = false;
        const tw = tip.offsetWidth, th = tip.offsetHeight; let tx = x + 14, ty = y + 14;
        if (tx + tw > Lh.W) tx = Math.max(0, x - tw - 14); if (ty + th > Lh.H) ty = Math.max(0, Lh.H - th);
        tip.style.left = tx + "px"; tip.style.top = ty + "px";
      };
      const pos = e => { const r = over.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      over.addEventListener("pointermove", e => { if (pinned) return; const [x, y] = pos(e); inside = hit(x, y); draw(); show(inside, x, y); });
      over.addEventListener("pointerleave", () => { if (!pinned) { inside = null; show(null); draw(); } });
      over.addEventListener("click", e => { const [x, y] = pos(e), h = hit(x, y);
        pinned = pinned ? null : h; inside = h; draw(); show(h, x, y); });
      let t; new ResizeObserver(() => { clearTimeout(t); t = setTimeout(layout, 60); }).observe(host);
      layout();
    }).catch(err => { host.innerHTML = `<p class="atlas-heat-hint">Heatmap could not be loaded (${esc(err.message)}).</p>`; });
  };
})();
