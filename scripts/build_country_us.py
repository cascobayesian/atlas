#!/usr/bin/env python3
"""Country pages in the design of the US state panels (us.html?place=nc): assets/countries/<key>_us.json, read by
assets/atlas.js when country.html sets data-over on the panel.

The US panels show four demographic PCAs (density, a composition colour mix, bachelor's degree, partisanship) and bloc /
precinct profiles of six stacked-bar topics, each against the place as a whole. This builds the same for a country from
its census measures, per unit in the atlas's order (data/<key>/data.json):

  topics   [{k, t, cats: [[key, label, colour], ...]}]   census topics, then the last election's vote (kept from profile.json)
  shares   {topic: {cat: [percent per unit | null]}}       the unit's composition
  place    {topic: {cat: share}}, blocs {b: {topic: {cat: share}}}   population-weighted
  panels   the four demographic PCAs: dens (rank ramp), mix (a topic's colours mixed), ramp (a topic share), keep (as built)

    python3 scripts/build_country_us.py            (from the atlas repo; reads the Dropbox project folders)
"""
import csv, json, os, sys
from collections import defaultdict

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.expanduser("~/Dropbox/Teaching/Country.Politics/Countries")
OUT = os.path.join(REPO, "assets", "countries")
NC_RAMP = ["#B2182B", "#E2694F", "#A784B8", "#5E91CC", "#1F4E9C"]                 # us.html density ramp
RB_RAMP = ["#B2182B", "#D6604D", "#E4A07F", "#8FB8D6", "#4A8CC2", "#1D4F91"]   # red (low) to blue (high), no white middle on the light page
BA_RAMP = ["#FDE333", "#96D84B", "#00BE7D", "#009B95", "#007094", "#353E7C", "#4B0055"]   # us.html bachelor's ramp


def ramp(m, lo=(227, 236, 245), hi=(29, 69, 128)):          # atlas.js RAMP: light to dark blue
    return ["#" + "".join(f"{round(a + (b - a) * (i / (m - 1) if m > 1 else 1)):02x}" for a, b in zip(lo, hi)) for i in range(m)]


def num(x):
    try: return float(x)
    except (TypeError, ValueError): return None


def read_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def composition(rows, parts):
    """parts: [(cat, fn(row) -> raw value)]; returns {cat: percent} normalised to 100, or None"""
    if rows is None: return None
    v = [(c, f(rows)) for c, f in parts]
    if any(x is None for _, x in v): return None
    v = [(c, max(0.0, x)) for c, x in v]
    s = sum(x for _, x in v)
    return None if s <= 0 else {c: 100 * x / s for c, x in v}


def build(key, units, pop, topics, comp, panels, note, demog_note, vals=None):
    """comp(i) -> {topic: {cat: percent}} or {} for unit i; vals: {panel key: [value per unit | None]} for kind "val" panels"""
    P = json.load(open(os.path.join(REPO, "data", key, "profile.json"), encoding="utf-8"))
    D = json.load(open(os.path.join(REPO, "data", key, "data.json"), encoding="utf-8"))
    N = len(units)
    shares = {T["k"]: {c[0]: [None] * N for c in T["cats"]} for T in topics}
    acc = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))       # group -> topic -> cat -> weighted sum
    wt = defaultdict(lambda: defaultdict(float))
    for i in range(N):
        c = comp(i)
        w = pop[i] or 0
        for T in topics:
            x = c.get(T["k"])
            if x is None: continue
            for cat, _, _ in T["cats"]:
                shares[T["k"]][cat][i] = round(x[cat])
            if w <= 0: continue
            for g in ("place", str(D["units"]["b"][i])):
                wt[g][T["k"]] += w
                for cat, _, _ in T["cats"]:
                    acc[g][T["k"]][cat] += w * x[cat] / 100
    agg = lambda g: {T["k"]: {cat: round(acc[g][T["k"]][cat] / wt[g][T["k"]], 4) if wt[g][T["k"]] else 0 for cat, _, _ in T["cats"]} for T in topics}
    vote = P["topics"][-1]                                                     # the last election, as profile.json has it
    out = dict(topics=topics, vote=vote["k"], shares=shares, place=agg("place"),
               blocs={b: agg(b) for b in P["blocs"]}, panels=panels, note=note, demog_note=demog_note)
    if vals: out["vals"] = vals
    f = os.path.join(OUT, f"{key}_us.json")
    json.dump(out, open(f, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    cover = sum(any(shares[T["k"]][T["cats"][0][0]][i] is not None for T in topics) for i in range(N))
    print(f"  {key}: {len(topics)} census topics + {vote['k']} for {cover:,} of {N:,} units -> {os.path.relpath(f, REPO)} ({os.path.getsize(f) / 1e6:.1f} MB)")


def canada():
    key = "canada"
    D = json.load(open(os.path.join(REPO, "data", key, "data.json"), encoding="utf-8"))
    ids = D["units"]["id"]
    rows = {r["join_id"]: r for r in read_csv(os.path.join(C, "Canada/realign_2025/model/fits/pd_compare_2021.csv"))}
    R = [rows.get(i) for i in ids]
    pop = [int(num(r["pop2021"]) or 0) if r else 0 for r in R]
    g = lambda *cols: (lambda r: None if any(num(r.get(c)) is None for c in cols) else sum(num(r[c]) for c in cols))
    VM = ["South Asian", "Chinese", "Black", "Filipino", "Arab", "Latin American", "Southeast Asian", "West Asian", "Korean", "Japanese", "Multiple visible minorities"]
    topics = [
        dict(k="vismin", t="Visible minority and Indigenous identity", cats=[
            ["white", "Not a visible minority", "#E31A1C"], ["indig", "Indigenous", "#00A9A5"], ["sasian", "South Asian", "#F2C200"],
            ["chinese", "Chinese", "#33A02C"], ["black", "Black", "#1F78B4"], ["oasian", "East &amp; Southeast Asian", "#8BC34A"],
            ["arab", "Arab &amp; West Asian", "#8E6BB8"], ["other", "Latin American &amp; other", "#B5B1A7"]]),
        dict(k="tongue", t="Mother tongue", cats=[
            ["en", "English", "#CFCAC0"], ["fr", "French", "#1F78B4"], ["indig", "Indigenous language", "#00A9A5"],
            ["xx", "Non-official", "#F2C200"], ["multi", "Multiple", "#C86B98"]]),
        dict(k="generation", t="Generation in Canada", cats=[
            ["third", "Third generation or more", "#CFCAC0"], ["second", "Second generation", "#6FA0CC"], ["first", "First generation (immigrants)", "#1D4580"]]),
        dict(k="education", t="Education, residents 15+", cats=[[c, l, col] for (c, l), col in zip(
            [("none", "No certificate"), ("hs", "High school"), ("trades", "Apprenticeship or trades"), ("college", "College, CEGEP or university below bachelor&rsquo;s"),
             ("ba", "Bachelor&rsquo;s"), ("grad", "Above bachelor&rsquo;s")], ramp(6))]),
        dict(k="industry", t="Industry of the labour force", cats=[
            ["goods", "Farming, resources, construction &amp; manufacturing", "#8C510A"], ["trade", "Trade &amp; transport", "#DFC27D"],
            ["office", "Finance, professional &amp; information", "#5E91CC"], ["public", "Education, health &amp; public administration", "#1F4E9C"],
            ["serv", "Hospitality, arts &amp; other services", "#C7B9D9"]]),
    ]
    I = lambda *c: g(*c)
    parts = {
        "vismin": [("white", lambda r: 100 - num(r["Visible minority (total)"]) - num(r["Indigenous identity"]) if num(r["Visible minority (total)"]) is not None and num(r["Indigenous identity"]) is not None else None),
                   ("indig", I("Indigenous identity")), ("sasian", I("South Asian")), ("chinese", I("Chinese")), ("black", I("Black")),
                   ("oasian", I("Filipino", "Southeast Asian", "Korean", "Japanese")), ("arab", I("Arab", "West Asian")),
                   ("other", I("Latin American", "Multiple visible minorities"))],
        "tongue": [("en", I("Mother tongue: English")), ("fr", I("Mother tongue: French")), ("indig", I("Mother tongue: Indigenous language")),
                   ("xx", I("Mother tongue: non-official")), ("multi", I("Multiple mother tongues"))],
        "generation": [("third", I("Third generation or more")), ("second", I("Second generation")), ("first", I("First generation"))],
        "education": [("none", I("No certificate (15+)")), ("hs", I("High school only")), ("trades", I("Apprenticeship or trades")),
                      ("college", I("College or CEGEP", "University below bachelor")), ("ba", I("Bachelor's degree")), ("grad", I("Above bachelor's (grad/professional)"))],
        "industry": [("goods", I("Agriculture, forestry, fishing", "Mining, oil and gas", "Utilities", "Construction", "Manufacturing")),
                     ("trade", I("Wholesale trade", "Retail trade", "Transportation and warehousing")),
                     ("office", I("Information and culture", "Finance and insurance", "Real estate and rental", "Professional, scientific, technical",
                                  "Management of companies", "Administrative and support")),
                     ("public", I("Educational services", "Health care and social assistance", "Public administration")),
                     ("serv", I("Arts, entertainment, recreation", "Accommodation and food", "Other services"))],
    }
    comp = lambda i: {} if R[i] is None or not pop[i] else {k: composition(R[i], p) for k, p in parts.items()}
    panels = [
        dict(k="tongue", t="Mother tongue", kind="mix", topic="tongue", colors=["#1F78B4", "#E31A1C", "#00A9A5", "#FFB000", "#C86B98"],
             note="Colours mix in proportion to each mother tongue&rsquo;s share (2021 Census)."),
        dict(k="immig", t="Immigrants", kind="ramp", topic="generation", cats=["first"], max=60, stops=RB_RAMP,
             h="Immigrants (first generation), all residents", tip="first-generation immigrants"),
        dict(k="ba", t="Bachelor&rsquo;s degree", kind="ramp", topic="education", cats=["ba", "grad"], max=60, stops=RB_RAMP,
             h="Bachelor&rsquo;s degree or higher, residents 15+", tip="with a bachelor&rsquo;s or higher"),
        dict(k="industry", t="Industry", kind="mix", topic="industry", colors=["#A6611A", "#F2C200", "#1F78B4", "#33A02C", "#C86B98"], largest=True, skip=["public"], h="Largest industry besides education, health &amp; public administration",
             note="Industry of the labour force (2021 Census): each point takes the colour of the industry most over-represented there against Canada, blended where two stand out about equally."),
    ]
    note = ("Votes from Elections Canada&rsquo;s poll-by-poll results, moved onto the 28 April 2025 polling divisions with 2021-census block weights; "
            "everything else from the 2021 Census (dissemination areas shared out to blocks by population and summed over")
    build(key, ids, pop, topics, comp, panels, note, "The same points and the same turning view as the PCA above. Hover a bloc in the list to bring it forward here too. "
          "Gray: no census residents.")


def germany():
    key = "germany"
    D = json.load(open(os.path.join(REPO, "data", key, "data.json"), encoding="utf-8"))
    G = json.load(open(os.path.join(REPO, "data", key, "demog.json"), encoding="utf-8"))
    ids = D["units"]["id"]
    rows = {r["ars"]: r for r in read_csv(os.path.join(C, "Germany/realign_2025/model/fits/demog_muni.csv"))}
    R = [rows.get(i) for i in ids]
    pop = [p or 0 for p in G["pop"]]
    REG = {"01": "north", "02": "north", "03": "north", "04": "north", "05": "west", "06": "west", "07": "west", "10": "west",
           "08": "south", "09": "south", "11": "berlin", "12": "east", "13": "east", "14": "east", "15": "east", "16": "east"}
    # purchasing power: national fifths of residents (population-weighted), so each fifth holds a fifth of Germans
    inc = sorted((num(r["income"]), pop[i]) for i, r in enumerate(R) if r and num(r["income"]) is not None and pop[i])
    tot, cut, run, q = sum(w for _, w in inc), [], 0, 1
    for v, w in inc:
        run += w
        if q < 5 and run >= tot * q / 5: cut.append(v); q += 1
    fifth = lambda v: sum(v > c for c in cut)
    topics = [
        dict(k="region", t="Region", cats=[["north", "North", "#6FA0CC"], ["west", "West", "#1F4E9C"], ["south", "South", "#33A02C"],
                                          ["berlin", "Berlin", "#C86B98"], ["east", "East", "#E31A1C"]]),
        dict(k="religion", t="Religion", cats=[["cath", "Roman Catholic", "#F2C200"], ["prot", "Protestant (EKD)", "#7B3294"], ["none", "Other or none", "#CFCAC0"]]),
        dict(k="birth", t="Country of birth", cats=[["de", "Born in Germany", "#CFCAC0"], ["abroad", "Born abroad", "#1D4580"]]),
        dict(k="academic", t="University degree, employees (county)", cats=[["no", "No university degree", "#E3ECF5"], ["yes", "University degree", "#1D4580"]]),
        dict(k="power", t="Purchasing power per resident", cats=[[f"q{j}", l, c] for j, (l, c) in enumerate(zip(
            ["Poorest fifth", "Second fifth", "Middle fifth", "Fourth fifth", "Richest fifth"], ramp(5)))]),
    ]
    def comp(i):
        r = R[i]
        if r is None: return {}
        f = lambda c: num(r[c])
        o = dict(region={c: (100 if REG.get(ids[i][:2]) == c else 0) for c in ("north", "west", "south", "berlin", "east")})
        if None not in (f("catholic"), f("protestant"), f("no_church")):
            o["religion"] = composition(r, [("cath", lambda r: f("catholic")), ("prot", lambda r: f("protestant")), ("none", lambda r: f("no_church"))])
        if f("born_abroad") is not None: o["birth"] = dict(de=100 - f("born_abroad"), abroad=f("born_abroad"))
        if f("academic") is not None: o["academic"] = dict(no=100 - f("academic"), yes=f("academic"))
        if f("income") is not None: o["power"] = {f"q{j}": (100 if fifth(f("income")) == j else 0) for j in range(5)}
        return o
    panels = [
        dict(k="dens", t="Population density", kind="dens", stops=NC_RAMP),
        dict(k="religion", t="Religion", kind="mix", topic="religion",
             note="Colours mix in proportion to Catholics, Protestants and others or none (Zensus 2022)."),
        dict(k="academic", t="University degree", kind="ramp", topic="academic", cats=["yes"], max=40, stops=RB_RAMP,
             h="Employees with a university degree (county level)", tip="of employees with a university degree (county)"),
        dict(k="afd", t="AfD vote", kind="keep"),
    ]
    note = ("List votes from the Bundeswahlleiterin&rsquo;s polling-district statistics, moved onto the 1 January 2025 municipalities; birthplace and religion "
            "from the Zensus 2022 100 m grid, INKAR (BBSR) measures for purchasing power (2023) and university degrees (county level), "
            "summed over")
    build(key, ids, pop, topics, comp, panels, note, "The same points and the same turning view as the PCA above. Hover a bloc in the list to bring it forward here too. "
          "University degrees are a county measure, so neighbouring municipalities share a value. Gray: no data.")


if __name__ == "__main__":
    which = sys.argv[1:] or ["canada", "germany"]
    for k in which: {"canada": canada, "germany": germany}[k]()
