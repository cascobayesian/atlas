#!/usr/bin/env python3
"""Romania's census overlay for the country page (assets/countries/romania_us.json), in the design of the US state panels;
see build_country_us.py (canada(), germany()) for the format.  Reads data/romania/{data,demog,profile}.json (written by
Romania/model/atlas_export_atlas_panel.R) and Romania/data/census_by_uat.csv (RPL 2021 and RPL 2011 by commune/town).

    python3 scripts/build_country_us_romania.py
"""
import json, os
from build_country_us import build, ramp, composition, RB_RAMP, NC_RAMP, read_csv, num, REPO, C


def romania():
    key = "romania"
    D = json.load(open(os.path.join(REPO, "data", key, "data.json"), encoding="utf-8"))
    G = json.load(open(os.path.join(REPO, "data", key, "demog.json"), encoding="utf-8"))
    ids = D["units"]["id"]
    rows = {r["unit_id"]: r for r in read_csv(os.path.join(C, "Romania/data/census_by_uat.csv"))}
    R = [rows.get(i) for i in ids]
    pop = [p or 0 for p in G["pop"]]       # Bucharest's 2021 total shared out to the sectors by their 2011 residents 10+
    topics = [
        dict(k="ethnicity", t="Ethnicity, of those declaring one (2021)", cats=[
            ["ro", "Romanian", "#CFCAC0"], ["hu", "Hungarian", "#2E8B3E"], ["roma", "Roma", "#F07D1A"], ["de", "German", "#7B3294"],
            ["oth", "Other (Ukrainian, Turkish, Lipovan, Serb&hellip;)", "#1F78B4"]]),
        dict(k="religion", t="Religion, of those declaring one (2021)", cats=[
            ["orth", "Orthodox", "#CFCAC0"], ["rcath", "Roman Catholic", "#F2C200"], ["gcath", "Greek Catholic", "#C0392B"],
            ["ref", "Reformed &amp; Unitarian", "#7B3294"], ["neo", "Neo-Protestant", "#33A02C"], ["oth", "Other or none", "#1F78B4"]]),
        dict(k="age", t="Age (2021)", cats=[[c, l, col] for (c, l), col in zip(
            [("y", "0&ndash;14"), ("m", "15&ndash;64"), ("o", "65 and over")], ramp(3))]),
        dict(k="education", t="Education, residents 10+ (2011 census)", cats=[[c, l, col] for (c, l), col in zip(
            [("prim", "Primary or less"), ("lsec", "Lower secondary"), ("usec", "Upper secondary or post-secondary"), ("tert", "University degree")], ramp(4))]),
        dict(k="abroad", t="Residents away abroad (2011 census)", cats=[["home", "In Romania", "#E3ECF5"], ["abroad", "Abroad, temporarily or long-term", "#1D4580"]]),
    ]
    I = lambda *c: (lambda r: None if any(num(r.get(x)) is None for x in c) else sum(num(r[x]) for x in c))
    rest = lambda *c: (lambda r: None if any(num(r.get(x)) is None for x in c) else max(0.0, 100 - sum(num(r[x]) for x in c)))
    ETH = ("romanian_pct", "hungarian_pct", "roma_pct", "german_pct")
    REL = ("orthodox_pct", "rcatholic_pct", "gcatholic_pct", "reformed_pct", "unitarian_pct", "neoprotestant_pct")
    parts = {
        "ethnicity": [("ro", I("romanian_pct")), ("hu", I("hungarian_pct")), ("roma", I("roma_pct")), ("de", I("german_pct")), ("oth", rest(*ETH))],
        "religion": [("orth", I("orthodox_pct")), ("rcath", I("rcatholic_pct")), ("gcath", I("gcatholic_pct")), ("ref", I("reformed_pct", "unitarian_pct")),
                     ("neo", I("neoprotestant_pct")), ("oth", rest(*REL))],
        "age": [("y", I("age0_14_pct")), ("m", rest("age0_14_pct", "age65plus_pct")), ("o", I("age65plus_pct"))],
        "education": [("prim", I("primary_or_less_2011_pct")), ("lsec", rest("upper_sec_plus_2011_pct", "primary_or_less_2011_pct")),
                      ("usec", lambda r: None if num(r.get("upper_sec_plus_2011_pct")) is None or num(r.get("tertiary_2011_pct")) is None
                       else max(0.0, num(r["upper_sec_plus_2011_pct"]) - num(r["tertiary_2011_pct"]))),
                      ("tert", I("tertiary_2011_pct"))],
        "abroad": [("home", rest("abroad_2011_pct")), ("abroad", I("abroad_2011_pct"))],
    }
    def comp(i):
        r = R[i]
        if r is None or not pop[i]: return {}
        o = {k: composition(r, p) for k, p in parts.items()}
        return {k: x for k, x in o.items() if x is not None}
    panels = [
        dict(k="dens", t="Population density", kind="dens", stops=NC_RAMP),
        dict(k="ethnicity", t="Ethnicity", kind="mix", topic="ethnicity", colors=["#D9D4CA", "#1B9E3A", "#F07D1A", "#7B3294", "#1F78B4"],
             h="Ethnicity (2021 census)", note="Colours mix in proportion to each group&rsquo;s share of those declaring an ethnicity (2021 census)."),
        dict(k="tert", t="University degree (2011)", kind="ramp", topic="education", cats=["tert"], max=40, stops=RB_RAMP,
             h="University degree, residents 10+ (2011 census)", tip="with a university degree (2011)"),
        dict(k="old", t="Aged 65 and over", kind="ramp", topic="age", cats=["o"], max=35, stops=RB_RAMP,
             h="Residents aged 65 and over (2021 census)", tip="aged 65 and over"),
    ]
    note = ("Chamber of Deputies list votes from the Permanent Electoral Authority&rsquo;s polling-station results, summed to the current communes "
            "and towns (Bucharest by sector); ethnicity, religion and age from the 2021 census (Bucharest&rsquo;s six sectors carry the city&rsquo;s "
            "values), education and residents abroad from the 2011 census (by sector), summed over")
    build(key, ids, pop, topics, comp, panels, note, "The same points and the same turning view as the PCA above. Hover a bloc in the list to bring it forward here too. "
          "Ethnicity, religion and age are city-wide for Bucharest&rsquo;s sectors; education is from the 2011 census. Gray: no census data (Petreu, created after the census).")


if __name__ == "__main__":
    romania()
