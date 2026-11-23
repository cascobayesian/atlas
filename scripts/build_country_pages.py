#!/usr/bin/env python3
"""Build the data behind the country pages (country.html?c=<key>): assets/countries/<key>.json, one per country on the
globe, plus heatmaps copied (downsized) to assets/world/<key>_heatmap.png.

Each JSON: the country's line from assets/world_countries.js (title, K, data, why, figure captions), the figures in
assets/world/ (pca, demog, map, extra maps, heatmap or heat.json), and a bloc list when the country's project has one:
bloc number, size (units), share, name and colour where the project records them, and the top lists of each election
(vote shares of the bloc's mean profile). Sources (Teaching/Country.Politics/Countries/<country>/...) are in CONFIG; the
bloc numbering is the one of each project's bloc tables, which its map scripts also use.

    python3 scripts/build_country_pages.py        (from the atlas repo; reads the Dropbox project folders)
"""
import csv, json, os, re, subprocess, sys
from collections import Counter, OrderedDict

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.expanduser("~/Dropbox/Teaching/Country.Politics/Countries")
OUT = os.path.join(REPO, "assets", "countries")
WORLD = os.path.join(REPO, "assets", "world")

# blocs: per-unit assignments (column "bloc") for sizes; profiles: bloc x election mean shares (wide), or long (Colombia)
CONFIG = {
    "austria":  dict(blocs="Austria/model/fits/blocs_K10.csv", profiles="Austria/model/fits/bloc_profiles_K10.csv", unit="municipalities"),
    "bosnia":   dict(blocs="Bosnia/hor_panel/model/fits_municipal/blocs_K8.csv", profiles="Bosnia/hor_panel/model/fits_municipal/bloc_profiles_K8.csv",
                     unit="municipalities", heat="Bosnia/hor_panel/model/fits_municipal/heatmap_blocs_K8.png"),
    "bulgaria": dict(blocs="Bulgaria/model/vote_fits/blocs_K10.csv", profiles="Bulgaria/model/vote_fits/bloc_profiles_K10.csv",
                     unit="municipalities", heat="Bulgaria/maps/heatmap_parliament_2013-2026.png"),
    "colombia": dict(profiles="Colombia/model/vote_fits/bloc_profiles_K19.csv", long=dict(cat="category", share="mean_share", n="n_municipalities"),
                     unit="municipalities"),
    "croatia":  dict(blocs="Croatia/model/vote_fits_national/blocs_K10.csv", profiles="Croatia/model/vote_fits_national/bloc_profiles_K10.csv",
                     colours="Croatia/model/vote_fits_national/bloc_colours_K10.csv", unit="municipalities",
                     heat="Croatia/maps/heatmap_parliament_2007-2024.png"),
    "czechia":  dict(blocs="Czechia/realign_2025/model/dmm_2017_2025/blocs_K10.csv", profiles="Czechia/realign_2025/model/dmm_2017_2025/bloc_profiles_K10.csv",
                     names="Czechia/realign_2025/model/dmm_2017_2025/bloc_names_K10.csv", unit="polling districts",
                     long=dict(cat="party", share="mean_share"),
                     heat="Czechia/realign_2025/figures/cz_heatmap_party_by_bloc_K10.png"),
    "hungary":  dict(blocs="Hungary/model/fits_2014-2026/blocs_K15.csv", profiles="Hungary/model/fits_2014-2026/bloc_profiles_K15.csv",
                     unit="settlements", heat="Hungary/maps/heatmap_parliament_1990-2026.png"),
    "india":    dict(unit="assembly-constituency segments", heat="India/LSAC/model/maps/heatmap_ls_national_K16_clustered.png"),
    "israel":   dict(blocs="Israel/realign_2011/model/fits_2019_2022/blocs_K12.csv", profiles="Israel/realign_2011/model/fits_2019_2022/bloc_profiles_K12.csv",
                     unit="statistical areas"),
    "japan":    dict(blocs="Japan/model/vote_fits_pr/blocs_K11.csv", profiles="Japan/model/vote_fits_pr/bloc_profiles_K11.csv",
                     unit="municipalities and wards", heat="Japan/figures/japan_pr_2012_2026_heatmap.png"),
    "netherlands": dict(unit="municipalities"),
    "poland":   dict(heatjson=True, unit="polling districts"),
    "romania":  dict(blocs="Romania/model/fits/blocs_K10.csv", profiles="Romania/model/fits/bloc_profiles_K10.csv", unit="communes and towns"),
    "serbia":   dict(json="Serbia/data/atlas_blocs_serbia.json", unit="polling stations", heat="Serbia/maps/parliament_2020_2026_dmm_K10_heatmap.png"),
    "slovakia": dict(blocs="Slovakia/model/fits/nrsr/blocs_K10.csv", profiles="Slovakia/model/fits/nrsr/bloc_profiles_K10.csv", unit="units"),
    "switzerland": dict(unit="communes", heat="Switzerland/bbmm/maps/swiss_referendum_heatmap_K10.png", heat_cap="Referendum yes shares by commune, grouped by the K = 10 blocs."),
    "canada":   dict(panels=True, unit="polling divisions"),
    "germany":  dict(panels=True, unit="municipalities"),
}
PRETTY = {"Other": "Other", "pirati": "Piráti", "kscm": "KSČM", "cssd": "ČSSD", "kdu": "KDU-ČSL", "kducsl": "KDU-ČSL", "top09": "TOP 09",
          "spolu": "Spolu", "stan": "STAN", "prisaha": "Přísaha", "motoriste": "Motoristé", "stacilo": "Stačilo!", "zeleni": "Zelení",
          "other": "Other", "oth": "Other", "trikolora": "Trikolóra", "pirstan": "Piráti+STAN"}
def pretty(l):
    if l in PRETTY: return PRETTY[l]
    if l.islower() and len(l) <= 6: return l.upper()            # Czech party codes: ano -> ANO, ods -> ODS
    return l.replace("_", " ")


def read_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def countries_js():
    """FITTED and PANELS entries from assets/world_countries.js (keys, titles, K, data, why, figure captions)."""
    js = open(os.path.join(REPO, "assets", "world_countries.js"), encoding="utf-8").read()
    jsc = "/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc"
    prog = js + "\nprint(JSON.stringify(FITTED.concat(PANELS).map(c => ({ key: c.key, name: c.name, title: c.title, k: c.k, kShade: c.kShade || 4, model: c.model || '', data: c.data || '', why: c.why || '', figs: c.figs || null }))));"
    tmp = os.path.join(OUT, ".countries.js")
    open(tmp, "w", encoding="utf-8").write(prog.replace("window.atlasOpen", "undefined"))
    out = subprocess.run([jsc, tmp], capture_output=True, text=True, check=True).stdout
    os.remove(tmp)
    return json.loads(out)


def bloc_list(key, cfg):
    if "json" in cfg:
        d = json.load(open(os.path.join(C, cfg["json"]), encoding="utf-8"))
        return dict(elections=d["elections"], blocs=d["blocs"], source="project export")
    if cfg.get("heatjson"):
        h = json.load(open(os.path.join(WORLD, f"{key}_heat.json"), encoding="utf-8"))
        tot = sum(b["n"] for b in h["blocs"]); els = list(OrderedDict.fromkeys(q["e"] for q in h["q"]))
        blocs = []
        for b in h["blocs"]:
            top = {}
            for e in els:
                v = [(q["h"], b["a"][j] / 100) for j, q in enumerate(h["q"]) if q["e"] == e]
                top[e] = [[l, round(s, 4)] for l, s in sorted(v, key=lambda t: -t[1])[:4]]
            blocs.append(dict(b=b["b"], colour=b["c"], name=b["nm"], n=b["n"], share=round(b["n"] / tot, 4), top=top))
        return dict(elections=els, blocs=blocs, source="heat.json")
    if "profiles" not in cfg:
        return None
    P = read_csv(os.path.join(C, cfg["profiles"]))
    prof = OrderedDict()                        # bloc -> election -> {list: share}
    n_from_prof = {}
    if cfg.get("long"):
        L = cfg["long"]
        for r in P:
            b = int(r["bloc"]); prof.setdefault(b, OrderedDict()).setdefault(r["election"], {})[r[L["cat"]]] = num(r[L["share"]]) or 0
            if L.get("n"): n_from_prof[b] = int(float(r[L["n"]]))
    else:
        ecol = "election" if "election" in P[0] else "vector"
        lists = [c for c in P[0] if c not in ("bloc", ecol)]
        vals = [num(r[c]) for r in P for c in lists if num(r[c]) is not None]
        scale = 100.0 if vals and max(vals) > 1.5 else 1.0          # percent tables (Slovakia)
        for r in P:
            b = int(float(r["bloc"]))
            prof.setdefault(b, OrderedDict())[r[ecol]] = {c: num(r[c]) / scale for c in lists if num(r[c])}
    if cfg.get("blocs"):
        B = read_csv(os.path.join(C, cfg["blocs"]))
        cnt = Counter(int(float(r["bloc"])) for r in B if r.get("bloc") not in (None, "", "NA"))
    else:
        cnt = Counter(n_from_prof)
    tot = sum(cnt.values()) or 1
    names, colours = {}, {}
    if cfg.get("names"):
        for r in read_csv(os.path.join(C, cfg["names"])):
            names[int(r["bloc"])] = r["name"]
    if cfg.get("colours"):
        for r in read_csv(os.path.join(C, cfg["colours"])):
            colours[int(r["bloc"])] = r["colour"]
            names.setdefault(int(r["bloc"]), f"{r['largest']} ({r['region']})")
    els = list(OrderedDict.fromkeys(e for b in prof.values() for e in b))
    blocs = []
    for b, by_e in sorted(prof.items()):
        top = {e: [[pretty(l), round(s, 4)] for l, s in sorted(by_e[e].items(), key=lambda t: -t[1])[:4]] for e in els if e in by_e}
        blocs.append(dict(b=b, colour=colours.get(b), name=names.get(b), n=cnt.get(b), share=round(cnt.get(b, 0) / tot, 4) if cnt else None, top=top))
    return dict(elections=els, blocs=blocs, source=cfg["profiles"])


def fig(key, f):
    return f"assets/world/{key}_{f}" if os.path.exists(os.path.join(WORLD, f"{key}_{f}")) else None


def main():
    os.makedirs(OUT, exist_ok=True)
    rows = countries_js()
    index = []
    for c in rows:
        key = c["key"]; cfg = CONFIG.get(key, {})
        caps = {f[0]: f[1] for f in (c["figs"] or [])}
        demog = next(((f[2]["open"], f[2]["cap"]) for f in (c["figs"] or []) if len(f) > 2), None)
        page = dict(key=key, title=c["title"], k=c["k"], kShade=c["kShade"], model=c["model"], data=c["data"], why=c["why"],
                    unit=cfg.get("unit", "units"), panels=bool(cfg.get("panels")))
        # figures
        pca = fig(key, "pca.gif") or fig(key, "pca.png")
        page["pca"] = dict(src=pca, cap=caps.get(os.path.basename(pca or "").replace(key + "_", ""),
                           "Rotating principal components of the units' vote shares, coloured by bloc.")) if pca else None
        page["demog"] = dict(src=f"assets/world/{key}_{demog[0]}", cap=demog[1]) if demog else (
            dict(src=fig(key, "demog.gif"), cap="Demographics: the turning PCA coloured by census measures.") if fig(key, "demog.gif") else None)
        page["map"] = dict(src=fig(key, "map.png"), cap=caps.get("map.png", f"Bloc map, K = {c['k']}.")) if fig(key, "map.png") else None
        page["more_maps"] = [dict(src=f"assets/world/{key}_{f}", cap=caps.get(f, f.replace(".png", "").replace("_", " ")))
                             for f in sorted(os.listdir(WORLD)) if f.startswith(key + "_") and f.endswith(".png")
                             and f not in (f"{key}_map.png", f"{key}_pca.png", f"{key}_heatmap.png") and "census" not in f]
        page["more_maps"] += [dict(src=f"assets/world/{f}", cap=caps.get(f.replace(key + "_", ""), "Census profile of the blocs."))
                              for f in sorted(os.listdir(WORLD)) if f.startswith(key + "_census")]
        for g in sorted(os.listdir(WORLD)):          # e.g. austria_vienna_pca.gif
            if g.startswith(key + "_") and g.endswith(".gif") and g not in (f"{key}_pca.gif", f"{key}_demog.gif"):
                page["more_maps"].append(dict(src=f"assets/world/{g}", cap=g.replace(".gif", "").replace("_", " ")))
        # heatmap: an existing atlas figure, heat.json, or one copied from the project
        heat = None
        if fig(key, "heat.json"):
            heat = dict(json=f"assets/world/{key}_heat.json", cap=caps.get("heat.json", "Vote shares, one row per unit, grouped by bloc."))
        elif fig(key, "heatmap.png") and not cfg.get("heat"):
            heat = dict(src=f"assets/world/{key}_heatmap.png", cap=caps.get("heatmap.png", "Vote shares, one row per unit."))
        elif cfg.get("heat"):
            src = os.path.join(C, cfg["heat"]); dst = os.path.join(WORLD, f"{key}_heatmap.png")
            if os.path.exists(src):
                subprocess.run(["sips", "-Z", "2400", src, "--out", dst], capture_output=True, check=True)
                heat = dict(src=f"assets/world/{key}_heatmap.png", cap=cfg.get("heat_cap", "Vote shares, one row per unit (columns: lists by election)."))
            else:
                print(f"  {key}: heatmap source missing: {cfg['heat']}", file=sys.stderr)
        page["heat"] = heat
        try:
            page["blocs"] = bloc_list(key, cfg)
        except Exception as e:                       # a malformed table should not stop the other countries
            print(f"  {key}: bloc list failed: {e}", file=sys.stderr); page["blocs"] = None
        json.dump(page, open(os.path.join(OUT, f"{key}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        nb = len(page["blocs"]["blocs"]) if page["blocs"] else 0
        index.append(key)
        print(f"{key:12s} pca={'y' if page['pca'] else '-'} demog={'y' if page['demog'] else '-'} map={'y' if page['map'] else '-'} "
              f"heat={'y' if heat else '-'} blocs={nb} (K = {c['k']}) more={len(page['more_maps'])}")
    print(f"wrote {len(index)} pages to {OUT}")


if __name__ == "__main__":
    main()
