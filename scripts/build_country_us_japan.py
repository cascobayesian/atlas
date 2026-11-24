#!/usr/bin/env python3
"""Japan's census overlay for the country page: assets/countries/japan_us.json, in the design of build_country_us.py's
canada() / germany(). Reads the 2020 census counts per model location written by the Japan project's
model/atlas_export_atlas_panel.R (data/jp_census2020_atlas_topics.csv), in data/japan/data.json order.

    python3 scripts/build_country_us_japan.py          (from the atlas repo)
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_country_us import build, ramp, composition, RB_RAMP, NC_RAMP, read_csv, num, REPO, C


def japan():
    key = "japan"
    D = json.load(open(os.path.join(REPO, "data", key, "data.json"), encoding="utf-8"))
    ids = D["units"]["id"]
    rows = {r["location_id"]: r for r in read_csv(os.path.join(C, "Japan/data/jp_census2020_atlas_topics.csv"))}
    R = [rows.get(i) for i in ids]
    pop = [p or 0 for p in D["units"]["pop"]]
    topics = [
        dict(k="age", t="Age (residents 15 and over)", cats=[["a15_39", "15–39", "#8FB8D6"], ["a40_64", "40–64", "#4A8CC2"], ["a65", "65 and over", "#1D4F91"]]),
        dict(k="educ", t="Last school completed (25 and over)", cats=[["ed_basic", "Elementary or junior high", "#E3ECF5"], ["ed_high", "High school", "#A9BCD6"],
                                                                     ["ed_junior", "Junior college or kōsen", "#5E7FAE"], ["ed_univ", "University or graduate school", "#1D4580"]]),
        dict(k="industry", t="Industry of the employed", cats=[["primary", "Farming, forestry, fishing", "#33A02C"], ["secondary", "Manufacturing, construction, mining", "#E31A1C"],
                                                               ["tertiary", "Services", "#1F78B4"]]),
        dict(k="nation", t="Nationality", cats=[["jp", "Japanese", "#CFCAC0"], ["foreign", "Foreign nationals", "#1D4580"]]),
    ]
    parts = {T["k"]: [(c[0], (lambda k: lambda r: num(r[k]))(c[0])) for c in T["cats"]] for T in topics if T["k"] != "nation"}

    def comp(i):
        r = R[i]
        if r is None: return {}
        o = {k: composition(r, p) for k, p in parts.items()}
        tot, fo = num(r["nat_total"]), num(r["foreign"])
        if tot and fo is not None: o["nation"] = dict(jp=100 * (tot - fo) / tot, foreign=100 * fo / tot)
        return {k: x for k, x in o.items() if x is not None}

    panels = [
        dict(k="dens", t="Population density", kind="dens", stops=NC_RAMP),
        dict(k="industry", t="Industry", kind="mix", topic="industry",
             note="Colours mix in proportion to the employed in farming, forestry and fishing (green), industry (red) and services (blue), 2020 census."),
        dict(k="educ", t="University degree", kind="ramp", topic="educ", cats=["ed_univ"], max=45, stops=RB_RAMP,
             h="Residents 25 and over whose last school was a university or graduate school", tip="of residents 25+ with a university degree"),
        dict(k="age", t="Aged 65 and over", kind="ramp", topic="age", cats=["a65"], max=60, stops=RB_RAMP,
             h="Residents aged 65 and over, as a share of those 15 and over", tip="of residents 15+ aged 65 and over"),
    ]
    note = ("PR votes from the Ministry of Internal Affairs and Communications&rsquo; municipal returns; age, education, industry and nationality "
            "from the 2020 census (e-Stat municipality tables; &ldquo;not stated&rdquo; and unclassifiable left out), summed over")
    build(key, ids, pop, topics, comp, panels, note, "The same points and the same turning view as the PCA above. Hover a bloc in the list to bring it forward here too. "
          "Gray: no data (Futaba, Fukushima, had no residents in 2020).")


if __name__ == "__main__":
    japan()
