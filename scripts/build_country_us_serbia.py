#!/usr/bin/env python3
"""Serbia's census overlay for the country page (assets/countries/serbia_us.json), in the design of the US state panels;
see build_country_us.py (canada(), germany()) for the format.  Reads data/serbia/{data,demog,profile}.json (written by
Serbia/model/atlas_export_atlas_panel.R) and Serbia/data/municipal_covariates_2022.csv (2022 census and RZS measures by
municipality).  The units are polling stations; the finest public census level is the municipality, so every station
takes its municipality's values.  Kosovo was not enumerated: its 60 stations have no census data.  Weights are the
stations' 2026 registered voters.

    python3 scripts/build_country_us_serbia.py
"""
import json, os
from build_country_us import build, ramp, composition, RB_RAMP, NC_RAMP, read_csv, num, REPO, C


def serbia():
    key = "serbia"
    D = json.load(open(os.path.join(REPO, "data", key, "data.json"), encoding="utf-8"))
    G = json.load(open(os.path.join(REPO, "data", key, "demog.json"), encoding="utf-8"))
    ids = D["units"]["id"]
    asg = {r["station_uid"]: r["muni_code"] for r in read_csv(os.path.join(C, "Serbia/data/parliament_2020_2026_dmm_K10_blocs.csv"))}
    rows = {r["muni_code"]: r for r in read_csv(os.path.join(C, "Serbia/data/municipal_covariates_2022.csv"))}
    R = [rows.get(asg.get(i)) for i in ids]
    pop = [p or 0 for p in G["pop"]]
    topics = [
        dict(k="ethnicity", t="Ethnicity, municipality (2022 census)", cats=[
            ["serb", "Serb", "#CFCAC0"], ["hu", "Hungarian", "#2E8B3E"], ["bos", "Bosniak", "#1F78B4"], ["alb", "Albanian", "#C0392B"],
            ["roma", "Roma", "#F07D1A"], ["oth", "Other or undeclared", "#7B3294"]]),
        dict(k="religion", t="Religion, municipality (2022 census)", cats=[
            ["orth", "Orthodox", "#CFCAC0"], ["cath", "Catholic", "#F2C200"], ["prot", "Protestant", "#7B3294"], ["islam", "Islam", "#33A02C"],
            ["none", "Atheist or agnostic", "#1F78B4"], ["oth", "Other or undeclared", "#8C8C8C"]]),
        dict(k="education", t="Education, residents 15+, municipality (2022 census)", cats=[[c, l, col] for (c, l), col in zip(
            [("prim", "Primary or less"), ("sec", "Secondary"), ("tert", "University degree")], ramp(3))]),
        dict(k="unemp", t="Labour force, municipality (2022 census)", cats=[["emp", "Employed", "#E3ECF5"], ["unemp", "Unemployed", "#1D4580"]]),
        dict(k="dev", t="Development group of the municipality (2014)", cats=[[f"g{j}", l, c] for j, (l, c) in enumerate(zip(
            ["Above the national average", "80&ndash;100% of the average", "60&ndash;80% of the average", "Below 60%", "Devastated (below 50%)"],
            ramp(5)[::-1]), start=1)]),
    ]
    I = lambda *c: (lambda r: None if any(num(r.get(x)) is None for x in c) else sum(num(r[x]) for x in c))
    rest = lambda *c: (lambda r: None if any(num(r.get(x)) is None for x in c) else max(0.0, 100 - sum(num(r[x]) for x in c)))
    ETH = ("serb_pct", "hungarian_pct", "bosniak_pct", "albanian_pct", "roma_pct")
    REL = ("orthodox_pct", "catholic_pct", "protestant_pct", "islam_pct", "atheist_agnostic_pct")
    parts = {
        "ethnicity": [("serb", I("serb_pct")), ("hu", I("hungarian_pct")), ("bos", I("bosniak_pct")), ("alb", I("albanian_pct")),
                      ("roma", I("roma_pct")), ("oth", rest(*ETH))],
        "religion": [("orth", I("orthodox_pct")), ("cath", I("catholic_pct")), ("prot", I("protestant_pct")), ("islam", I("islam_pct")),
                     ("none", I("atheist_agnostic_pct")), ("oth", rest(*REL))],
        "education": [("prim", I("primary_or_less_pct")), ("sec", rest("primary_or_less_pct", "tertiary_pct")), ("tert", I("tertiary_pct"))],
        "unemp": [("emp", rest("unemployment_rate")), ("unemp", I("unemployment_rate"))],
    }
    def comp(i):
        r = R[i]
        if r is None: return {}
        o = {k: composition(r, p) for k, p in parts.items()}
        g = num(r.get("development_group"))
        if g is not None: o["dev"] = {f"g{j}": (100 if int(g) == j else 0) for j in range(1, 6)}
        return {k: x for k, x in o.items() if x is not None}
    panels = [
        dict(k="dens", t="Population density", kind="dens", stops=NC_RAMP),
        dict(k="ethnicity", t="Ethnicity", kind="mix", topic="ethnicity", colors=["#D9D4CA", "#1B9E3A", "#1F78B4", "#C0392B", "#F07D1A", "#7B3294"],
             h="Ethnicity of the municipality (2022 census)",
             note="Colours mix in proportion to each group&rsquo;s share of the municipality&rsquo;s residents (2022 census)."),
        dict(k="tert", t="University degree", kind="ramp", topic="education", cats=["tert"], max=40, stops=RB_RAMP,
             h="Residents 15+ with a university degree, municipality (2022 census)", tip="with a university degree (municipality)"),
        dict(k="stu", t="Studentska lista, 2026", kind="keep", stops=RB_RAMP, max=80),   # red (low) to blue (high)
    ]
    note = ("National Assembly votes from RIK&rsquo;s polling-station results, moved onto the 2026 polling stations; ethnicity, religion, "
            "education and unemployment from the 2022 census and the 2014 development groups (RZS), by municipality, so every station takes its "
            "municipality&rsquo;s values; weighted by 2026 registered voters, summed over")
    build(key, ids, pop, topics, comp, panels, note, "The same points and the same turning view as the PCA above. Hover a bloc in the list to bring it forward here too. "
          "On the map, municipalities are filled with their main bloc, as on the bloc map above; the dots carry the measure. Census measures are municipal, so all of a municipality&rsquo;s stations share a value; density is the municipality&rsquo;s. "
          "Gray: Kosovo&rsquo;s stations (not enumerated in 2022).")


if __name__ == "__main__":
    serbia()
