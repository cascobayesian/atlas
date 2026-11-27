#!/usr/bin/env python3
"""Brazil census overlay for the country page: assets/countries/brazil_us.json (see build_country_us.py).

Units are the 93,725 polling places of 2026 in data/brazil/data.json (Brazil/model/atlas_export_atlas_panel.R). Census
2022 measures per polling place from Brazil/data/br_demographics_2022_places2026.csv.gz (Brazil/code/12a-c: census
tracts shared out to the places' Voronoi catchments by area, within the tract's municipality): colour or race, Indigenous
persons, literacy (15+) from the tract tables; education (25+) and religion (10+) from the weighting-area tables; mean
monthly income of household heads from the tract income table. Nine demographic PCAs in three rows of three.

    python3 scripts/build_country_us_brazil.py
"""
import csv, gzip, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_country_us import build, ramp, RB_RAMP, num, REPO, C

RACE = [["white", "White (branca)", "#E31A1C"], ["brown", "Brown (parda)", "#F2A900"], ["black", "Black (preta)", "#1F78B4"],
        ["yellow", "Asian (amarela)", "#33A02C"], ["indigenous", "Indigenous (indígena)", "#00A9A5"]]
REL = [["catholic", "Catholic", "#D7301F"], ["evangelical", "Evangelical", "#1F5FB4"], ["other", "Other religions", "#8E6BB8"],
       ["none", "No religion", "#BDBDBD"]]


def brazil():
    key = "brazil"
    D = json.load(open(os.path.join(REPO, "data", key, "data.json"), encoding="utf-8"))
    ids = D["units"]["id"]
    pop = [p or 0 for p in D["units"]["pop"]]
    with gzip.open(os.path.join(C, "Brazil/data/br_demographics_2022_places2026.csv.gz"), "rt", encoding="utf-8") as f:
        rows = {r["target_id"]: r for r in csv.DictReader(f)}
    R = [rows.get(i) for i in ids]
    topics = [
        dict(k="race", t="Colour or race, 2022 census", cats=RACE),
        dict(k="indig", t="Indigenous persons, 2022 census", cats=[["no", "Not Indigenous", "#CFCAC0"], ["yes", "Indigenous persons", "#00A9A5"]]),
        dict(k="lit", t="Literacy, residents 15+", cats=[["yes", "Can read and write", "#CFCAC0"], ["no", "Illiterate", "#1D4580"]]),
        dict(k="edu", t="Education, residents 25+", cats=[[c, l, col] for (c, l), col in zip(
            [("none", "No schooling or primary incomplete"), ("prim", "Primary complete"), ("sec", "Secondary complete"), ("univ", "University degree")], ramp(4))]),
        dict(k="rel", t="Religion, residents 10+", cats=REL),
    ]

    def comp(i):
        r = R[i]
        if r is None or r["has_demog"] != "TRUE": return {}
        g = lambda k: num(r.get(k)) or 0.0
        o = {}
        race = {c: g("race_" + c) for c in ("white", "brown", "black", "yellow", "indigenous")}
        if sum(race.values()) > 0: o["race"] = {c: 100 * v / sum(race.values()) for c, v in race.items()}
        if g("pop") > 0:
            ip = min(g("indigenous_persons"), g("pop"))
            o["indig"] = dict(yes=100 * ip / g("pop"), no=100 * (1 - ip / g("pop")))
        lit = g("lit15_yes") + g("lit15_no")
        if lit > 0: o["lit"] = dict(yes=100 * g("lit15_yes") / lit, no=100 * g("lit15_no") / lit)
        ed = dict(none=g("edu_none_fundinc"), prim=g("edu_fund_medinc"), sec=g("edu_med_supinc"), univ=g("edu_superior"))
        if sum(ed.values()) > 0: o["edu"] = {c: 100 * v / sum(ed.values()) for c, v in ed.items()}
        rel = dict(catholic=g("rel_catholic"), evangelical=g("rel_evangelical"), none=g("rel_none"),
                   other=g("rel_spiritist") + g("rel_umbanda_candomble") + g("rel_indigenous_trad") + g("rel_other") + g("rel_dontknow") + g("rel_undeclared"))
        if sum(rel.values()) > 0: o["rel"] = {c: 100 * v / sum(rel.values()) for c, v in rel.items()}
        return o

    inc = []
    for r in R:
        x = num(r["inc_mean_head"]) if r is not None and r["has_demog"] == "TRUE" else None
        inc.append(None if x is None or x <= 0 else int(round(x, -1)))

    rp = lambda k, t, topic, cats, mx, h, tip: dict(k=k, t=t, kind="ramp", topic=topic, cats=cats, max=mx, stops=RB_RAMP, h=h, tip=tip)
    panels = [   # three rows of three
        rp("white", "White", "race", ["white"], 80, "White (branca), share of residents", "of residents white (branca)"),
        rp("black", "Black", "race", ["black"], 40, "Black (preta), share of residents", "of residents black (preta)"),
        rp("brown", "Brown", "race", ["brown"], 80, "Brown (parda), share of residents", "of residents brown (parda)"),
        rp("indig", "Indigenous", "indig", ["yes"], 20, "Indigenous persons, share of residents", "of residents Indigenous persons"),
        rp("illit", "Illiterate", "lit", ["no"], 40, "Cannot read and write, residents 15+", "of residents 15+ illiterate"),
        rp("univ", "University degree", "edu", ["univ"], 40, "University degree, residents 25+", "of residents 25+ with a university degree"),
        dict(k="income", t="Income", kind="val", lo=800, hi=10000, log=True, stops=RB_RAMP, prefix="R$",
             ticks=[1000, 2000, 5000, 10000], h="Mean monthly income of household heads (R$, log scale)",
             tip="<b>R${v}</b> mean monthly income of household heads"),
        rp("evang", "Evangelical", "rel", ["evangelical"], 60, "Evangelical, residents 10+", "of residents 10+ Evangelical"),
        rp("cath", "Catholic", "rel", ["catholic"], 80, "Catholic, residents 10+", "of residents 10+ Catholic"),
    ]
    note = ("Presidential first-round votes from the TSE open data, by 2026 polling place; colour or race, Indigenous persons, literacy and "
            "household heads&rsquo; income from the 2022 census tract tables (IBGE), education and religion from its weighting-area tables, "
            "shared out to the polling places&rsquo; catchments (Voronoi cells) by area within each municipality and summed over")
    build(key, ids, pop, topics, comp, panels, note, "The same points and the same turning view as the PCA above. Hover a bloc in the list to bring it forward here too. "
          "Education and religion come from IBGE weighting areas (a few tracts to a whole small municipality), so they vary less finely than the rest. "
          "Gray: no residents allocated.", vals=dict(income=inc))


if __name__ == "__main__":
    brazil()
