#!/usr/bin/env python3
"""Netherlands census overlay for the country page: assets/countries/netherlands_us.json (see build_country_us.py).

Per municipality (CBS 2025 map, data/netherlands/data.json order), from the project's CBS extract
Netherlands/municipal_demographics_2025.csv: origin (CBS 2022 classification, 1 Jan 2025), education of residents 15-75
(2024), age bands (1 Jan 2025), housing tenure (1 Jan 2025) and the CBS degree of urbanisation (2025).

    python3 scripts/build_country_us_netherlands.py
"""
import json, os
from build_country_us import build, ramp, composition, RB_RAMP, NC_RAMP, read_csv, num, REPO, C


def netherlands():
    key = "netherlands"
    D = json.load(open(os.path.join(REPO, "data", key, "data.json"), encoding="utf-8"))
    ids = D["units"]["id"]
    rows = {r["gm_code"]: r for r in read_csv(os.path.join(C, "Netherlands/municipal_demographics_2025.csv"))}
    R = [rows.get(i) for i in ids]
    pop = [p or 0 for p in D["units"]["pop"]]
    I = lambda *cols: (lambda r: None if any(num(r.get(c)) is None for c in cols) else sum(num(r[c]) for c in cols))
    topics = [
        dict(k="origin", t="Origin (own or parents&rsquo; country of birth)", cats=[
            ["nl", "Dutch", "#CFCAC0"], ["eur", "Elsewhere in Europe", "#6FA0CC"], ["tm", "Turkey &amp; Morocco", "#E31A1C"],
            ["col", "Suriname, Dutch Caribbean &amp; Indonesia", "#F2C200"], ["oth", "Elsewhere outside Europe", "#7B3294"]]),
        dict(k="education", t="Education, residents 15&ndash;75 (2024)", cats=[[c, l, col] for (c, l), col in zip(
            [("low", "Primary, vmbo or mbo-1"), ("mid", "Havo, vwo or mbo 2&ndash;4"), ("high", "Hbo or university")], ramp(3))]),
        dict(k="age", t="Age", cats=[[c, l, col] for (c, l), col in zip(
            [("a0", "Under 15"), ("a15", "15&ndash;24"), ("a25", "25&ndash;44"), ("a45", "45&ndash;64"), ("a65", "65 and over")], ramp(5))]),
        dict(k="tenure", t="Housing", cats=[["own", "Owner-occupied", "#1D4580"], ["social", "Social rent (housing associations)", "#E31A1C"],
                                           ["private", "Private rent", "#F2C200"]]),
        dict(k="urban", t="Degree of urbanisation (CBS)", cats=[[f"u{j}", l, c] for j, (l, c) in enumerate(zip(
            ["Not urban", "Hardly urban", "Moderately urban", "Strongly urban", "Very strongly urban"], ramp(5)))]),
    ]
    parts = {
        "origin": [("nl", I("origin_dutch_pct")), ("eur", I("origin_europe_pct")),
                   ("tm", I("origin_turkije_pct", "origin_marokko_pct")),
                   ("col", I("origin_suriname_pct", "origin_nederlandse_cariben_pct", "origin_indonesie_pct")),
                   ("oth", I("origin_afrika_exclusief_marokko_pct", "origin_amerika_en_oceanie_ex_suriname_en_n_pct",
                             "origin_azie_exclusief_indonesie_en_turkije_pct"))],
        "education": [("low", I("edu_low_pct_2024")), ("mid", I("edu_mid_pct_2024")), ("high", I("edu_high_pct_2024"))],
        "age": [("a0", I("age_0_15_pct")), ("a15", I("age_15_25_pct")), ("a25", I("age_25_45_pct")), ("a45", I("age_45_65_pct")),
                ("a65", I("age_65_plus_pct"))],
        "tenure": [("own", I("own_pct_2025")), ("social", I("rent_social_pct_2025")), ("private", I("rent_private_pct_2025"))],
    }

    def comp(i):
        r = R[i]
        if r is None: return {}
        o = {k: x for k, p in parts.items() if (x := composition(r, p)) is not None}
        u = num(r.get("urbanity_class_2025"))                 # CBS class 1 (very strongly urban) .. 5 (not urban)
        if u is not None: o["urban"] = {f"u{j}": (100 if int(u) == 5 - j else 0) for j in range(5)}
        return o

    panels = [
        dict(k="dens", t="Population density", kind="dens", stops=NC_RAMP),
        dict(k="origin", t="Origin", kind="mix", topic="origin", colors=["#CFCAC0", "#1F78B4", "#E31A1C", "#FFB000", "#9B59B6"],
             h="Origin of residents", note="Colours mix in proportion to each origin group&rsquo;s share of residents (CBS, 1 January 2025)."),
        dict(k="higher", t="Higher education", kind="ramp", topic="education", cats=["high"], max=60, stops=RB_RAMP,
             h="Hbo or university degree, residents 15&ndash;75 (2024)", tip="with an hbo or university degree"),
        dict(k="social", t="Social housing", kind="ramp", topic="tenure", cats=["social"], max=40, stops=RB_RAMP,
             h="Dwellings rented from housing associations", tip="of dwellings in social rent"),
    ]
    note = ("Votes from the Kiesraad&rsquo;s municipal results on the 2025 municipalities; origin, age, housing and urbanisation from CBS "
            "(1 January 2025), education from CBS (2024, residents 15&ndash;75), summed over")
    build(key, ids, pop, topics, comp, panels, note, "The same points and the same turning view as the PCA above. Hover a bloc in the list to bring it forward here too. "
          "Gray: no data (Schiermonnikoog has no published education figures).")


if __name__ == "__main__":
    netherlands()
