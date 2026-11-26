#!/usr/bin/env python3
"""Croatia census overlay for the country page: assets/countries/croatia_us.json (see build_country_us.py).

Units are the 556 municipalities (gradovi and općine) of 2024 in data/croatia/data.json. Measures from the 2021 census
(DZS, by town/municipality) in Croatia/data/municipal_covariates_2021.csv (Croatia/code/covariates_build.R): ethnicity,
religion, education (15+), age and birthplace; density from the same file. Six demographic PCAs in two rows:
ethnic minorities, not religious, density; tertiary education, age 65+, born abroad.

    python3 scripts/build_country_us_croatia.py
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_country_us import build, ramp, RB_RAMP, NC_RAMP, read_csv, num, REPO, C

ETH = [["croat", "Croat", "#CFCAC0"], ["serb", "Serb", "#1F5FB4"], ["other", "Other minority", "#2E9E3A"],
       ["nd", "Not declared or unknown", "#8C8C8C"]]
REL = [["catholic", "Catholic", "#CFCAC0"], ["orthodox", "Orthodox", "#8E3BB8"], ["muslim", "Muslim", "#2E9E3A"],
       ["none", "Not religious, agnostic", "#3D7FD0"], ["other", "Other or not declared", "#9A9A9A"]]


def croatia():
    key = "croatia"
    D = json.load(open(os.path.join(REPO, "data", key, "data.json"), encoding="utf-8"))
    ids = D["units"]["id"]
    pop = [p or 0 for p in D["units"]["pop"]]
    cv = {r["municipality_id"]: r for r in read_csv(os.path.join(C, "Croatia/data/municipal_covariates_2021.csv"))}
    topics = [
        dict(k="ethnicity", t="Ethnicity, 2021 census", cats=ETH),
        dict(k="religion", t="Religion, 2021 census", cats=REL),
        dict(k="education", t="Education, residents 15+", cats=[[c, l, col] for (c, l), col in zip(
            [("primary", "Primary or less"), ("secondary", "Secondary"), ("tertiary", "Higher education")], ramp(3))]),
        dict(k="age", t="Age, 2021 census", cats=[["under65", "Under 65", "#CFCAC0"], ["over65", "65 and over", "#1D4F91"]]),
        dict(k="born", t="Birthplace, 2021 census", cats=[["hr", "Born in Croatia", "#CFCAC0"], ["abroad", "Born abroad", "#1D4F91"]]),
    ]

    def comp(i):
        r = cv.get(ids[i])
        if r is None: return {}
        g = lambda k: num(r.get(k)) or 0.0
        croat, serb = g("eth_croats_pct"), g("eth_serbs_pct")
        nd = g("eth_not_declared_pct") + g("eth_unknown_pct") + g("eth_not_classified_pct")
        cath, orth, mus = g("rel_catholics_pct"), g("rel_orthodox_pct"), g("rel_muslims_pct")
        none = g("rel_not_religious_and_atheists_pct") + g("rel_agnostics_and_sceptics_pct")
        sec, ter = g("edu_secondary_pct"), g("edu_tertiary_pct")
        o = dict(ethnicity=dict(croat=croat, serb=serb, nd=nd, other=max(0.0, 100 - croat - serb - nd)),
                 religion=dict(catholic=cath, orthodox=orth, muslim=mus, none=none, other=max(0.0, 100 - cath - orth - mus - none)),
                 education=dict(primary=max(0.0, 100 - sec - ter), secondary=sec, tertiary=ter),
                 age=dict(under65=100 - g("age_65_plus_pct"), over65=g("age_65_plus_pct")),
                 born=dict(hr=100 - g("born_abroad_pct"), abroad=g("born_abroad_pct")))
        return o

    panels = [   # two rows of three: ethnicity, religion, density; tertiary education, age 65+, born abroad
        dict(k="ethnicity", t="Ethnic minorities", kind="ramp", topic="ethnicity", cats=["serb", "other", "nd"], max=30, stops=RB_RAMP,
             h="Not declaring Croat ethnicity, 2021 census", tip="not declaring Croat ethnicity"),
        dict(k="religion", t="Not religious", kind="ramp", topic="religion", cats=["none"], max=20, stops=RB_RAMP,
             h="Not religious or agnostic, 2021 census", tip="not religious or agnostic"),
        dict(k="dens", t="Population density", kind="dens", stops=NC_RAMP),
        dict(k="edu", t="Higher education", kind="ramp", topic="education", cats=["tertiary"], max=40, stops=RB_RAMP,
             h="Higher education, residents 15+", tip="of residents 15+ with higher education"),
        dict(k="age", t="Aged 65 and over", kind="ramp", topic="age", cats=["over65"], max=40, stops=RB_RAMP,
             h="Aged 65 and over, 2021", tip="aged 65 and over"),
        dict(k="born", t="Born abroad", kind="ramp", topic="born", cats=["abroad"], max=30, stops=RB_RAMP,
             h="Born abroad, 2021 census", tip="born abroad (2021)"),
    ]
    note = ("Sabor votes from the State Electoral Commission (DIP) open data, summed to the 2024 municipalities; ethnicity, religion, "
            "education, age and birthplace from the 2021 census (DZS, by town and municipality), summed over")
    build(key, ids, pop, topics, comp, panels, note, "The same points and the same turning view as the PCA above. Hover a bloc in the list to bring it forward here too.")


if __name__ == "__main__":
    croatia()
