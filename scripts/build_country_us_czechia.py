#!/usr/bin/env python3
"""Czechia census overlay for the country page: assets/countries/czechia_us.json (see build_country_us.py).

Units are the 14,711 polling districts (okrsky) of data/czechia/data.json. The 2021 census (ČSÚ SLDB 2021 open data,
raw/census21/ in the Czechia project) is published only for municipalities (obce) and, in the statutory cities, city
districts (MOMC): each okrsek takes its city district's composition where one is published, otherwise its municipality's
(output/census/cz_census21_okrsky.csv, src / src_code), so okrsky in one municipality share their census values.

    python3 scripts/build_country_us_czechia.py
"""
import csv, json, os, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_country_us import build, ramp, composition, RB_RAMP, NC_RAMP, read_csv, num, REPO, C

P = os.path.join(C, "Czechia/realign_2025")
RAW = os.path.join(P, "raw/census21")


def tally(fname, cat_col, keep=lambda r: True):
    """{(level, code): {category text (or '' for the total row): count}} for obce (43) and city districts (44)"""
    out = defaultdict(lambda: defaultdict(float))
    with open(os.path.join(RAW, fname), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["uzemi_cis"] not in ("43", "44") or not keep(r): continue
            lev = "obec" if r["uzemi_cis"] == "43" else "momc"
            out[(lev, r["uzemi_kod"])][r[cat_col]] += num(r["hodnota"]) or 0
    return out


def czechia():
    key = "czechia"
    D = json.load(open(os.path.join(REPO, "data", key, "data.json"), encoding="utf-8"))
    ids = D["units"]["id"]
    pop = [p or 0 for p in D["units"]["pop"]]
    src = {r["join_id"]: (r["src"], r["src_code"]) for r in read_csv(os.path.join(P, "output/census/cz_census21_okrsky.csv"))}
    obec = {}
    with open(os.path.join(P, "output/final_datasets/cz_ps_2017_2025.csv"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f): obec[r["join_id"]] = r["kod_obec"]

    ed = tally("sldb2021_vzdelani.csv", "vzdelani_txt")
    vi = tally("sldb2021_vira.csv", "vira_txt")
    na = tally("sldb2021_narodnost.csv", "narodnost_txt")
    ak = tally("sldb2021_aktivita_pohlavi.csv", "ekonaktiv_txt", keep=lambda r: not r["pohlavi_kod"])
    size = {c: d[""] for (lev, c), d in vi.items() if lev == "obec"}             # municipality residents (vira total row)

    SIZES = [(1000, "lt1k", "Under 1,000"), (5000, "k1", "1,000&ndash;4,999"), (20000, "k5", "5,000&ndash;19,999"),
             (100000, "k20", "20,000&ndash;99,999"), (float("inf"), "k100", "100,000 and over")]
    topics = [
        dict(k="education", t="Education, residents 15+", cats=[[c, l, col] for (c, l), col in zip(
            [("basic", "Basic or none"), ("voc", "Secondary without maturita (vocational)"),
             ("mat", "Secondary with maturita or higher vocational"), ("univ", "University")], ramp(4))]),
        dict(k="religion", t="Religion (residents who answered)", cats=[
            ["cath", "Roman Catholic", "#F2C200"], ["othf", "Other faith or believer without a church", "#8E6BB8"],
            ["none", "No religious faith", "#CFCAC0"]]),
        dict(k="moravian", t="Moravian or Silesian nationality", cats=[
            ["mor", "Moravian or Silesian", "#C8102E"], ["oth", "Czech, other or not stated", "#CFCAC0"]]),
        dict(k="unemp", t="Labour force", cats=[["emp", "Employed", "#CFCAC0"], ["unemp", "Unemployed", "#B2182B"]]),
        dict(k="size", t="Size of municipality", cats=[[c, l, col] for (_, c, l), col in zip(SIZES, ramp(5))]),
    ]

    def comp_unit(u):
        o = {}
        e = ed.get(u)
        if e:
            o["education"] = composition(e, [("basic", lambda d: d["Bez vzdělání"] + d["Základní vč. neukončeného"]),
                                             ("voc", lambda d: d["Střední vč. vyučení (bez maturity)"]),
                                             ("mat", lambda d: d["Úplné  střední (s maturitou), vč. nástavbového a pomaturitního"] + d["Vyšší odborné, konzervatoř"]),
                                             ("univ", lambda d: d["Vysokoškolské"])])
        v = vi.get(u)
        if v:
            cath = v["Církev římskokatolická"] + v["katolická víra (katolík)"]
            none = v["Bez náboženské víry"]
            othf = v[""] - v["Neuvedeno"] - cath - none
            o["religion"] = composition(v, [("cath", lambda d: cath), ("othf", lambda d: othf), ("none", lambda d: none)])
        n = na.get(u)
        if n and n[""] > 0:
            m = min(n["Moravská celkem"] + n["Slezská celkem"], n[""])
            o["moravian"] = dict(mor=100 * m / n[""], oth=100 - 100 * m / n[""])
        a = ak.get(u)
        if a and a["Pracovní síla"] > 0:
            o["unemp"] = composition(a, [("emp", lambda d: d["Zaměstnaní"]), ("unemp", lambda d: d["Nezaměstnaní"])])
        return {k: x for k, x in o.items() if x is not None}

    cache = {}
    def comp(i):
        u = src.get(ids[i])
        if u is None: return {}
        if u not in cache: cache[u] = comp_unit(u)
        o = dict(cache[u])
        s = size.get(obec.get(ids[i]))
        if s:
            j = next(j for j, (lim, _, _) in enumerate(SIZES) if s < lim)
            o["size"] = {c: (100 if q == j else 0) for q, (_, c, _) in enumerate(SIZES)}
        return o

    panels = [
        dict(k="dens", t="Population density", kind="dens", stops=NC_RAMP),
        dict(k="religion", t="Religion", kind="mix", topic="religion", colors=["#F2C200", "#8E3BB8", "#5E91CC"], relative=1,
             h="Religion, against Czechia as a whole",
             note="Colours mix Roman Catholics, other believers and the non-religious, each weighed against its national share (2021 census, residents who answered)."),
        dict(k="univ", t="University degree", kind="ramp", topic="education", cats=["univ"], max=40, stops=RB_RAMP,
             h="University degree, residents 15+ with known education", tip="of residents 15+ with a university degree"),
        dict(k="unemp", t="Unemployment", kind="ramp", topic="unemp", cats=["unemp"], max=10, stops=RB_RAMP,
             h="Unemployed, % of the labour force", tip="of the labour force unemployed"),
    ]
    note = ("Chamber of Deputies votes from ČSÚ&rsquo;s polling-district open data, moved onto the 2025 okrsky; education, religion, nationality and "
            "economic activity from the 2021 census (ČSÚ SLDB 2021), published for municipalities and city districts and given to each of their "
            "polling districts, summed over")
    build(key, ids, pop, topics, comp, panels, note, "The same points and the same turning view as the PCA above. Hover a bloc in the list to bring it forward here too. "
          "The census is published for municipalities and city districts, so polling districts in one municipality share a value. Gray: no data.")


if __name__ == "__main__":
    czechia()
