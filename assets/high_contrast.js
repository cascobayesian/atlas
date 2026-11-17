// High-contrast (categorical) colours for one place's blocs, worked out in the browser from data.json.
// The national scheme colours a bloc by its vote and makeup, so it is comparable across places; but neighbouring
// blocs with similar votes can look nearly alike. Here each bloc instead gets a colour from a palette of distinct
// hues (after Kelly's colours of maximum contrast), assigned so that blocs that touch on the map, or sit close
// together in the PCA, get colours far apart. Up to 20 blocs every bloc has its own colour; beyond that (San Diego,
// California) colours repeat, but not between neighbours. Deterministic: the same place always gets the same colours.
//   window.atlasHighContrast(D) -> { <bloc number>: "#rrggbb", ... }
(() => {
  const PAL = ["#0067A5", "#F38400", "#008856", "#BE0032", "#875692", "#F3C300", "#A1CAF1", "#882D17", "#8DB600", "#E68FAC",
               "#604E97", "#C2B280", "#2B3D26", "#F99379", "#DCD300", "#B3446C", "#654522", "#E25822", "#F6A600", "#1F9E89"];

  // sRGB hex -> CIELAB (D65), for perceptual distances
  const lab = hex => {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const X = (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.95047, Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2],
          Z = (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.08883;
    const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
  };
  const LAB = PAL.map(lab);
  const dE = (a, b) => Math.hypot(LAB[a][0] - LAB[b][0], LAB[a][1] - LAB[b][1], LAB[a][2] - LAB[b][2]);

  window.atlasHighContrast = D => {
    const U = D.units, N = U.b.length, blocs = D.blocs.map(b => b.b), K = blocs.length, ix = new Map(blocs.map((b, i) => [b, i]));
    const W = Array.from({ length: K }, () => new Float64Array(K));

    // 1. map contacts: each unit's six nearest units (by centroid), counted when they lie in another bloc
    const pts = []; let lat0 = 0;
    for (let i = 0; i < N; i++) if (U.lon && U.lon[i] != null && U.lat[i] != null && ix.has(U.b[i])) { pts.push(i); lat0 += U.lat[i]; }
    if (pts.length > 1) {
      lat0 /= pts.length; const kx = Math.cos(lat0 * Math.PI / 180);
      const xs = new Float64Array(N), ys = new Float64Array(N);
      for (const i of pts) { xs[i] = U.lon[i] * kx; ys[i] = U.lat[i]; }
      // a 2-d tree over the unit centroids, for nearest-neighbour queries
      const build = (ids, ax) => {
        if (!ids.length) return null;
        const v = ax ? ys : xs; ids.sort((a, b) => v[a] - v[b]);
        const m = ids.length >> 1;
        return { i: ids[m], ax, l: build(ids.slice(0, m), 1 - ax), r: build(ids.slice(m + 1), 1 - ax) };
      };
      const tree = build(pts.slice(), 0);
      const knn = (node, q, best, k) => {
        if (!node) return;
        if (node.i !== q) {
          const d = (xs[node.i] - xs[q]) ** 2 + (ys[node.i] - ys[q]) ** 2;
          if (best.length < k || d < best[best.length - 1][0]) {
            let j = best.length; best.push([d, node.i]);
            while (j > 0 && best[j - 1][0] > d) { best[j] = best[j - 1]; j--; } best[j] = [d, node.i];
            if (best.length > k) best.pop();
          }
        }
        const diff = node.ax ? ys[q] - ys[node.i] : xs[q] - xs[node.i];
        knn(diff < 0 ? node.l : node.r, q, best, k);
        if (best.length < k || diff * diff < best[best.length - 1][0]) knn(diff < 0 ? node.r : node.l, q, best, k);
      };
      for (const i of pts) {
        const near = [], bi = ix.get(U.b[i]); knn(tree, i, near, 6);
        for (const [, j] of near) { const bj = ix.get(U.b[j]); if (bj !== bi) { W[bi][bj] += 1; W[bj][bi] += 1; } }
      }
      // normalise, so a big bloc's many contacts don't drown a small bloc's few
      const tot = W.map(r => r.reduce((s, v) => s + v, 0) || 1);
      for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) W[a][b] = W[a][b] / Math.sqrt(tot[a] * tot[b]);
    }

    // 2. PCA neighbours: blocs whose centroids sit close together in the first three components
    if (U.x) {
      const c = blocs.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < N; i++) if (U.x[i] != null && ix.has(U.b[i])) { const v = c[ix.get(U.b[i])]; v[0] += U.x[i]; v[1] += U.y[i]; v[2] += U.z ? U.z[i] : 0; v[3]++; }
      const p = c.map(v => v.slice(0, 3).map(x => x / Math.max(v[3], 1))), d = [];
      for (let a = 0; a < K; a++) for (let b = a + 1; b < K; b++) d.push(Math.hypot(p[a][0] - p[b][0], p[a][1] - p[b][1], p[a][2] - p[b][2]));
      const med = d.slice().sort((x, y) => x - y)[d.length >> 1] || 1;
      for (let a = 0; a < K; a++) for (let b = a + 1; b < K; b++) {
        const w = 0.35 * Math.exp(-((Math.hypot(p[a][0] - p[b][0], p[a][1] - p[b][1], p[a][2] - p[b][2]) / (0.5 * med)) ** 2));
        W[a][b] += w; W[b][a] += w;
      }
    }

    // 3. assign: a colour pair's cost falls off with its distance; greedy start, then swaps and moves while they help
    const pool = K <= PAL.length ? [...Array(K).keys()] : [...Array(PAL.length).keys()];
    const pen = (a, b) => a === b ? 3 : Math.exp(-dE(a, b) / 18);
    const order = [...Array(K).keys()].sort((a, b) => W[b].reduce((s, v) => s + v, 0) - W[a].reduce((s, v) => s + v, 0) || a - b);
    const col = new Array(K).fill(-1), used = new Map();
    for (const a of order) {
      let best = null, bs = Infinity;
      for (const c of pool) {
        if (K <= PAL.length && used.get(c)) continue;
        let s = 0.002 * (used.get(c) || 0) + 0.0001 * c;            // spread repeats; prefer the palette's first colours
        for (let b = 0; b < K; b++) if (col[b] >= 0 && W[a][b]) s += W[a][b] * pen(c, col[b]);
        if (s < bs) { bs = s; best = c; }
      }
      col[a] = best; used.set(best, (used.get(best) || 0) + 1);
    }
    // local search on cost changes alone: bloc a's terms with every other bloc (skipping one bloc, for a swap)
    const row = (a, c, skip) => { let t = 0; const w = W[a]; for (let b = 0; b < K; b++) if (b !== a && b !== skip && w[b]) t += w[b] * pen(c, col[b]); return t; };
    for (let pass = 0; pass < 8; pass++) {
      let better = false;
      for (let a = 0; a < K; a++) for (let b = a + 1; b < K; b++) {
        if (col[a] === col[b]) continue;
        const d = row(a, col[b], b) - row(a, col[a], b) + row(b, col[a], a) - row(b, col[b], a);   // the a-b term is unchanged by a swap
        if (d < -1e-9) { [col[a], col[b]] = [col[b], col[a]]; better = true; }
      }
      if (K > PAL.length) for (let a = 0; a < K; a++) {
        const base = row(a, col[a], -1); let bc = col[a], bd = 0;
        for (const c of pool) if (c !== col[a]) { const d = row(a, c, -1) - base; if (d < bd - 1e-9) { bd = d; bc = c; } }
        if (bc !== col[a]) { col[a] = bc; better = true; }
      }
      if (!better) break;
    }
    return Object.fromEntries(blocs.map((b, i) => [b, PAL[col[i]]]));
  };
})();
