// The countries on the world globe, shared by world.html and the front page (index.html).

// Countries with a finished fit but no interactive panels yet: the bloc map at the chosen K and a PCA figure if one exists.
// name = Natural Earth name; figures in assets/world/, copied from Teaching/Country.Politics/Countries/<country>/.
const FITTED = [
  { name: "Austria", key: "austria", title: "Austria", k: 10, k4: "assets/world_k4/austria.json", kShade: 5, model: "Dirichlet-multinomial mixture",
    data: "2,114 Gemeinden (2026 map; Vienna as its 23 districts), Nationalrat elections 2017, 2019 and 2024, list votes with postal ballots allocated; Vienna separately: 1,504 polling districts (2025 Gemeinderat map), Gemeinderat 2015, 2020, 2025 and Nationalrat 2013, 2017, 2019, 2024 in one joint fit",
    why: "K = 10, from fits at K = 5, 10 and 15 (ten starts each; BIC 351,673, 342,556 and 338,286); the globe shades the national K = 5 blocs",
    figs: [
      ["map.png", "Bloc map, K = 10, Gemeinden. Legend: bloc, Gemeinden, 2024 electorate, largest Gemeinde, and the bloc's mean list shares in each election. Blocs numbered by 2024 FPÖ share."],
      ["pca.gif", "Rotating principal coordinates (Jensen-Shannon distance) of the Gemeinden's 2017, 2019 and 2024 vote shares, coloured by the K = 10 blocs."],
      ["vienna_map.png", "Vienna: joint K = 10 bloc map of the 1,504 polling districts (Gemeinderat and Nationalrat elections fitted together). Legend: bloc, polling districts, and the fitted shares of its top two parties in the 2025 Gemeinderat and 2024 Nationalrat elections."],
      ["vienna_pca.gif", "Vienna: rotating principal coordinates (Jensen-Shannon distance) of the polling districts, Gemeinderat elections on the left and Nationalrat elections on the right, both coloured by the joint K = 10 blocs."]] },
  { name: "Bosnia and Herz.", key: "bosnia", title: "Bosnia and Herzegovina", k: 8, k4: "assets/world_k4/bosnia.json", model: "Dirichlet-multinomial mixture",
    data: "142 municipalities, House of Representatives elections 2010–2026, votes by party family",
    why: "K = 8 has the lowest BIC of K = 5–10", pca: true },
  { name: "Bulgaria", key: "bulgaria", title: "Bulgaria", k: 10, k4: "assets/world_k4/bulgaria.json", model: "Dirichlet-multinomial mixture",
    data: "265 municipalities, 11 parliamentary elections 2013–2026",
    why: "K = 10 has the best BIC of K = 2–10 and passes the 3% rule (BIC still falling)", pca: false },
  { name: "Colombia", key: "colombia", title: "Colombia", k: 19, k4: "assets/world_k4/colombia.json", model: "Dirichlet-multinomial mixture",
    data: "municipalities, Senate national-constituency votes 2018–2026",
    why: "K = 19, the fit carried through to profiles and PCA (BIC still falling at K = 30)", pca: true },
  { name: "Croatia", key: "croatia", title: "Croatia", k: 10, k4: "assets/world_k4/croatia.json", model: "Dirichlet-multinomial mixture",
    data: "556 municipalities, Sabor elections 2007–2024", why: "K = 10, the national fit", pca: true },
  { name: "Czechia", key: "czechia", title: "Czechia", k: 10, k4: "assets/world_k4/czechia.json", kShade: 5, model: "Dirichlet-multinomial mixture",
    data: "14,711 polling districts (2025 map; 2017 and 2021 districts carried onto it by an address-point crosswalk), Chamber of Deputies elections 2017, 2021 and 2025, parties with at least 1% plus Other (the two smallest folded into Other)",
    why: "K = 10, against K = 5 (only these two fitted; BIC 2,210,027 and 2,239,587); 4 of 8 K = 10 starts and 5 of 6 K = 5 starts reach the same best fit; the globe shades the K = 5 blocs, each municipality (city district in the statutory cities) taking the bloc of most of its 2025 voters",
    figs: [
      ["map.png", "Bloc map, K = 10, drawn on the 2025 polling districts, with Prague, Brno and Ostrava insets. Legend: bloc, polling districts and mean 2025 ANO and SPOLU shares. Blocs numbered by 2025 ANO share, highest first; the names are drafts."],
      ["pca.gif", "Rotating principal components (Hellinger-transformed shares) of the districts' 2017, 2021 and 2025 vote shares, coloured by the K = 10 blocs. PC1 (37%) runs from SPOLU, ODS and TOP 09 to ANO."],
      ["demog.gif", "Demographics: the same turning PCA in six panels, coloured by the K = 10 blocs and by five 2021 census measures in sextiles (dark = high): university degree, unemployment, Roman Catholic, Moravian nationality and moving in within the past year. The census publishes these by municipality and city district, so districts in one municipality share a value. Education follows PC1 (r = −0.72); Catholicism (r = 0.70) and Moravian identity (0.49) follow PC2."]] },
  { name: "Hungary", key: "hungary", title: "Hungary", k: 15, k4: "assets/world_k4/hungary.json", model: "Dirichlet-multinomial mixture",
    data: "3,177 settlements, parliamentary elections 2014–2026",
    why: "K = 15, the largest fitted (BIC still falling at K = 15)", pca: true },
  { name: "India", key: "india", title: "India", k: 16, k4: "assets/world_k4/india.json", model: "Dirichlet-multinomial mixture",
    data: "assembly-constituency segments, Lok Sabha general elections 2009–2024",
    why: "K = 16 has the lowest BIC of K = 2–16", pca: false },
  { name: "Israel", key: "israel", title: "Israel", k: 12, k4: "assets/world_k4/israel.json", model: "Dirichlet-multinomial mixture",
    data: "2,873 statistical areas (2011), five Knesset elections April 2019–2022",
    why: "K = 12 by the 3% rule (draft fit)", pca: true },
  { name: "Japan", key: "japan", title: "Japan", k: 11, k4: "assets/world_k4/japan.json", kShade: 5, model: "Dirichlet-multinomial mixture",
    data: "1,887 municipalities, Tokyo special wards and designated-city wards, House of Representatives party-list (PR) votes 2012–2026 (six elections), party families with at least 2% of the national PR vote",
    why: "K = 11 by the 3% rule (every bloc at least 3% of locations; K = 12 is the first to fail; 3 starts per K for K = 2–20, 2 of 3 reach the best fit at K = 11; BIC still falling at K = 20); the globe shades the K = 5 blocs (provincial west, metropolitan and industrial belt, the north, Kinai, Osaka)",
    figs: [
      ["map.png", "Bloc map, K = 11, with each bloc's name and the evidence behind it: its geography, 2020 census profile, vote history 2012–2026 and the historical provinces and domains it covers. Blocs numbered by mean 2026 PR LDP share, highest first; the names are interpretations."],
      ["pca.gif", "Rotating Jensen–Shannon principal coordinates of the locations' PR vote shares, coloured by the K = 11 blocs. PC1 (32%) runs from Ishin's Osaka and Kinai to the rural north and southwest; it is the rural–urban axis (population density r = −0.65, farm workers 0.60, university graduates −0.56). Click for the demographic panels.",
        { open: "demog.gif", cap: "Demographics: the same turning PCA in seven panels, coloured by the K = 11 blocs and by six 2020 census measures (red below the median, blue above): population density, foreign nationals, married, employed, agriculture and forestry, and university graduates. Census tables by municipality and ward." }]] },
  { name: "Netherlands", key: "netherlands", title: "Netherlands", k: 15, k4: "assets/world_k4/netherlands.json", model: "Dirichlet-multinomial mixture",
    data: "342 municipalities, Tweede Kamer elections 2010–2025", why: "K = 15", pca: true },
  { name: "Poland", key: "poland", title: "Poland", k: 10, k4: "assets/world_k4/poland.json", kShade: 5, model: "Dirichlet-multinomial mixture",
    data: "29,790 polling districts (2025 map; earlier districts carried onto it by an address-point crosswalk), Sejm elections 2019 and 2023, votes for PiS, KO, Lewica, PSL / Trzecia Droga and Other (Konfederacja, German Minority and minor lists)",
    why: "K = 10, against K = 5 (only these two fitted, five starts each; BIC 2,082,589 and 2,116,238); all five K = 5 starts reach the same partition, but only one of five K = 10 starts reaches the best fit, so the smaller K = 10 blocs are provisional; the globe shades the K = 5 blocs, each gmina taking the bloc of most of its 2023 voters",
    figs: [
      ["map.png", "Bloc map, K = 10, drawn on the 2025 polling districts (each 250 m cell takes the district of its nearest address point). Legend: mean 2023 shares of each bloc and its number of districts. Blocs numbered by 2023 PiS share, lowest first."],
      ["pca.gif", "Rotating principal coordinates (Jensen-Shannon distance) of the districts' 2019 and 2023 vote shares, coloured by the K = 10 blocs; dot area proportional to 2025 residents. Landmark classical scaling (3,000 random landmarks)."],
      ["heat.json", "List vote shares in 2019 and 2023 (columns), one row per polling district, grouped by K = 10 bloc and ordered by 2023 PiS share. Hover for a district's share, click to pin it; hover the bloc bar for the bloc's averages."]] },
  { name: "Romania", key: "romania", title: "Romania", k: 10, k4: "assets/world_k4/romania.json", kShade: 5, model: "Dirichlet-multinomial mixture",
    data: "3,186 communes and towns (Bucharest by sector), Chamber of Deputies elections 2016, 2020 and 2024",
    why: "K = 10, against K = 5 (only these two fitted; BIC 620,768 and 631,301); the globe shades the K = 5 blocs",
    figs: [
      ["map.png", "Bloc map, K = 10. Bucharest's sectors are drawn as schematic wedges in the inset."],
      ["map_k5.png", "Bloc map, K = 5."],
      ["pca.gif", "Rotating principal coordinates (Jensen-Shannon distance) of the communes and towns, coloured by the K = 5 and K = 10 blocs."],
      ["census_k10.png", "Census profile of the K = 10 blocs: ethnicity, religion, age, education, birthplace, emigration and housing (2021 and 2011 censuses), bloc means weighted by electorate."],
      ["census_k5.png", "Census profile of the K = 5 blocs."],
      ["heatmap.png", "Chamber of Deputies list vote shares, 2016, 2020 and 2024, one row per commune or town."]] },
  { name: "Serbia", key: "serbia", title: "Serbia", k: 10, k4: "assets/world_k4/serbia.json", kShade: 5, model: "Dirichlet-multinomial mixture",
    data: "8,270 polling stations of 2026 (Serbia and Kosovo), National Assembly elections 2020, 2022, 2023 and 2026 re-expressed on the 2026 stations, each election's lists with at least 1% plus Other (2026: Studentska lista, SNS, SPS, Other)",
    why: "K = 10, against K = 5 (only these two fitted, ten starts each; BIC 1,672,514 and 1,721,155); all K = 5 starts that reach the best fit give the same partition, but only one of ten K = 10 starts reaches the best fit, so the boundaries between neighbouring SNS-leaning K = 10 blocs are provisional; the globe shades the K = 5 blocs (central Serbia, the SNS south and east, the towns, Belgrade and Novi Sad, the minority areas), each municipality taking the bloc of most of its 2026 voters",
    figs: [
      ["map.png", "Bloc map, K = 10: each municipality coloured by the bloc whose stations cast most of its 2026 votes, paler where its stations are spread over more blocs (effective number of blocs); dots are the polling stations in their own bloc's colour, placed at their settlement. Inset: central Belgrade. Blocs numbered by 2026 SNS share, lowest first."],
      ["pca.gif", "Rotating principal components of the stations' 39 list shares, 2020–2026, coloured by the K = 10 blocs. PC1 (44%) runs from the opposition (SPN 2023, UZPS 2022, Studentska lista 2026) to SNS; PC2 (26%) separates the Bosniak and Albanian lists; PC3 (11%) is the Hungarian SVM vote. Click for the demographic panels.",
        { open: "demog.gif", cap: "Demographics: the same turning PCA in nine panels, coloured by the K = 10 blocs, by municipal measures (2022 census ethnicity, religion, mother tongue, tertiary education and unemployment; 2025 net wages; the 2014 development group) and by the station's own 2026 Studentska lista share. Each station takes its municipality's value; sextiles of stations, dark = high." }]] },
  { name: "Slovakia", key: "slovakia", title: "Slovakia", k: 10, k4: "assets/world_k4/slovakia.json", kShade: 5, model: "Dirichlet-multinomial mixture",
    data: "4,137 stable units (polling districts, pooled districts and municipalities), National Council elections 2016, 2020 and 2023",
    why: "K = 10, against K = 5 (only these two fitted, three starts each; BIC 928,858 and 956,392); the globe shades the K = 5 blocs",
    figs: [
      ["map.png", "Bloc map, K = 10, drawn on municipalities: a municipality split into several units takes the bloc of most of its 2023 voters (black outline where its units fall in more than one bloc). Insets: Bratislava and Košice city districts."],
      ["pca.gif", "Rotating principal components of the units' 2016–2023 vote shares, coloured by the K = 10 blocs; dot area proportional to 2023 voters."],
      ["heatmap.png", "Party vote shares in each election (columns), one row per unit, grouped by K = 10 bloc."]] },
  { name: "Switzerland", key: "switzerland", title: "Switzerland", k: 10, k4: "assets/world_k4/switzerland.json", model: "beta-binomial mixture",
    data: "communes, federal referendums 2010–2024", why: "K = 10 by the 3% rule (best BIC at K = 15)", pca: true }
];

// US states with statewide blocs in the atlas (data/places.json); cities and counties elsewhere are on the US page
const US_STATES = ["California", "Washington", "Utah", "Colorado", "Massachusetts", "Maine", "New Mexico", "Florida", "Louisiana",
  "Alabama", "Michigan", "Ohio", "Maryland", "Georgia", "Wisconsin", "North Carolina"];
// from the folders in Teaching/Country.Politics/Countries: data pulled or maps made, but no bloc fit
const STARTED = [
  { name: "Botswana", note: "parliamentary results by constituency, with current and historical constituency maps" },
  { name: "France", note: "2022 presidential results by commune, 2024 legislative maps, Paris polling stations" },
  { name: "Ghana", note: "parliamentary results by constituency, with constituency maps" },
  { name: "Mexico", note: "work begun" },
  { name: "Slovenia", note: "polling stations matched to the 212 current municipalities, 2002–2026" },
  { name: "Turkey", note: "work begun" }
];
const CANADA = { name: "Canada", key: "canada", title: "Canada", k: 15, k4: "assets/world_k4/canada.json",
  data: "70,644 polling divisions, federal elections 2015–2025; full interactive panels",
  open: () => window.atlasOpen ? window.atlasOpen("canada") : (location.search = "?place=canada") };
// Germany: full interactive panels (Germany/realign_2025/model/atlas_export_de.R); the globe shades its K = 5 blocs
const GERMANY = { name: "Germany", key: "germany", title: "Germany", k: 10, k4: "assets/world_k4/germany.json", kShade: 5,
  data: "10,754 municipalities, Bundestag elections 2017–2025; full interactive panels",
  open: () => window.atlasOpen ? window.atlasOpen("germany") : (location.search = "?place=germany") };
const PANELS = [CANADA, GERMANY];   // countries with the full interactive panels

const GRADES = [
  { g: 4, name: "Excellent: ready to go", text: "Polling-station or municipal results for many elections, machine-readable, with boundaries." },
  { g: 3, name: "Good", text: "Fine-grained or constituency results with gaps: fewer elections, missing boundaries or awkward formats." },
  { g: 2, name: "Limited", text: "Coarse units, few elections, or results only in scanned documents." },
  { g: 1, name: "Poor: not usable", text: "National totals only, or records too scattered or unreliable to use." }
];
