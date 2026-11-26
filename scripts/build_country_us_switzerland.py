#!/usr/bin/env python3
"""Switzerland census overlay for the country page: assets/countries/switzerland_us.json (see build_country_us.py).

Units are the 2,105 communes (2026-01-01 map) of data/switzerland/data.json. Measures from
Switzerland/demog/commune_demog.csv (Switzerland/demog/build_demog_ch.R): main language, religion and highest completed
education from the 2000 federal census (summed into today's communes with the BFS commune correspondence), birthplace
from STATPOP 2025. Six demographic PCAs in two rows: language, religion, no religion; density, education, immigration.

    python3 scripts/build_country_us_switzerland.py
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_country_us import build, ramp, RB_RAMP, NC_RAMP, read_csv, num, REPO, C

LANG = [["german", "German", "#C92A2A"], ["french", "French", "#1971C2"], ["italian", "Italian", "#B08900"],
        ["romansh", "Romansh", "#7A5230"], ["other", "Other language", "#CFCAC0"]]       # bloc families: German red, French blue, Italian dark yellow
REL = [["catholic", "Catholic", "#C2541B"], ["protestant", "Protestant", "#4A3AA7"], ["none", "No religion", "#CFCAC0"],
       ["other", "Other or not stated", "#8C8C8C"]]


def switzerland():
    key = "switzerland"
    D = json.load(open(os.path.join(REPO, "data", key, "data.json"), encoding="utf-8"))
    ids = [str(x) for x in D["units"]["id"]]
    pop = [p or 0 for p in D["units"]["pop"]]
    dm = {r["bfs_nr"]: r for r in read_csv(os.path.join(C, "Switzerland/demog/commune_demog.csv"))}
    topics = [
        dict(k="language", t="Main language, 2000 census", cats=LANG),
        dict(k="religion", t="Religion, 2000 census", cats=REL),
        dict(k="education", t="Highest education, 2000 census", cats=[[c, l, col] for (c, l), col in zip(
            [("compulsory", "Compulsory school or none"), ("secondary", "Upper secondary (apprenticeship, Matura)"), ("tertiary", "Tertiary")], ramp(3))]),
        dict(k="born", t="Birthplace, residents 2025", cats=[["ch", "Born in Switzerland", "#CFCAC0"], ["abroad", "Born abroad", "#1D4F91"]]),
    ]

    def comp(i):
        r = dm.get(ids[i])
        if r is None: return {}
        g = lambda k: num(r[k]) or 0.0
        lang = [g("pct_lang_german"), g("pct_lang_french"), g("pct_lang_italian"), g("pct_lang_romansh")]
        cath, prot, none = g("pct_rel_catholic"), g("pct_rel_protestant"), g("pct_rel_none")
        o = dict(language=dict(zip([c[0] for c in LANG], lang + [max(0.0, 100 - sum(lang))])),
                 religion=dict(catholic=cath, protestant=prot, none=none, other=max(0.0, 100 - cath - prot - none)),
                 education=dict(compulsory=g("pct_compulsory_2000"), secondary=g("pct_secondary_2000"), tertiary=g("pct_tertiary_2000")),
                 born=dict(ch=100 - g("pct_born_abroad_2025"), abroad=g("pct_born_abroad_2025")))
        return o

    panels = [   # two rows of three (country_panel.css): language, religion, no religion; density, education, immigration
        dict(k="language", t="Language", kind="mix", topic="language", colors=[c[2] for c in LANG[:4]] + ["#9A9A9A"],
             h="Main language, 2000 census"),
        dict(k="religion", t="Religion", kind="mix", topic="religion", h="Religion, 2000 census"),
        dict(k="none", t="No religion", kind="ramp", topic="religion", cats=["none"], max=30, stops=RB_RAMP,
             h="No religious affiliation, 2000 census", tip="with no religious affiliation (2000)"),
        dict(k="dens", t="Population density", kind="dens", stops=NC_RAMP),
        dict(k="edu", t="Tertiary education", kind="ramp", topic="education", cats=["tertiary"], max=40, stops=RB_RAMP,
             h="Tertiary education, 2000 census (past school age)", tip="with tertiary education (2000)"),
        dict(k="born", t="Born abroad", kind="ramp", topic="born", cats=["abroad"], max=50, stops=RB_RAMP,
             h="Born abroad, residents 2025", tip="of residents born abroad (2025)"),
    ]
    note = ("Referendum votes from the Federal Statistical Office; language, religion and education from the 2000 federal census, "
            "summed into the 2026 communes; birthplace and residents from STATPOP 2025; summed over")
    build(key, ids, pop, topics, comp, panels, note, "The same points and the same turning view as the PCA above. Hover a bloc in the list to bring it forward here too. "
          "Language, religion and education are from the 2000 census (the last full count); birthplace and density from 2025.")


if __name__ == "__main__":
    switzerland()
