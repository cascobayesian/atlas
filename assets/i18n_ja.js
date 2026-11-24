// Japanese for the Japan country page (country.html?c=japan&lang=ja): assets/country.js loads this before assets/atlas.js
// and translates every text node and title / aria-label / data-tip attribute on the page as the panel draws it.
//   exact: whole strings (after trimming);  terms: names inside longer strings (longest first);  rules: [RegExp, replacement]
// Party and bloc names are the atlas's own renderings; CRA (2026) is the joint CDP-Kōmeitō list.
(() => {
  const exact = {
    "Atlas of Voting Blocs": "投票ブロック地図帳", "Countries": "国", "Cities": "都市", "Japan": "日本",
    "Jack O’Brien · Bowdoin College": "ジャック・オブライエン・ボウディン大学", "← Back to the globe": "← 地球儀に戻る",
    "High-contrast color scheme": "高コントラスト配色", "Place": "地域", "PCA": "主成分分析", "Blocs": "ブロック", "Map": "地図",
    "Data": "データ", "Demographics": "人口統計", "Bloc profile": "ブロックの特徴", "Municipality profile": "市区町村の特徴",
    "Heatmap": "ヒートマップ", "Data from": "データ：",
    "1,887 municipalities, 6 House of Representatives elections (2012–2026) × 17 parties, PR votes; Tokyo and designated-city wards as units, 11 voting blocs.":
      "1,887市区町村、衆議院選挙6回（2012〜2026年）×17政党の比例代表得票。東京特別区と政令指定都市の区を単位とし、投票ブロックは11。",
    "Scroll or pinch to zoom, drag to pan. Click a municipality for its profile.":
      "スクロールまたはピンチで拡大・縮小、ドラッグで移動。市区町村をクリックするとその特徴を表示します。",
    "Every party in every election, 2012–2026: municipalities as rows (a sample), grouped by bloc; columns by election, 2012 to 2026, with the parties within each.":
      "2012〜2026年の全選挙・全政党：行は市区町村（標本）をブロック別に並べ、列は選挙ごと（2012〜2026年）の各政党。",
    "Hover for the election and party, the municipality’s share and its bloc’s and Japan’s averages; click to pin. Hovering a municipality on either map or in the PCA marks its row here.":
      "カーソルを合わせると選挙と政党、その市区町村の得票率、ブロック平均と全国平均を表示。クリックで固定。地図や主成分分析で市区町村にカーソルを合わせると、ここでその行が示されます。",
    "Click a municipality on the map or a row of the heatmap for its profile.": "地図の市区町村かヒートマップの行をクリックすると、その特徴を表示します。",
    "Municipalities, grouped by bloc": "市区町村（ブロック別）",
    "Population density": "人口密度", "Residents per km²": "1km²あたりの人口", "Industry": "産業", "University degree": "大学卒",
    "Residents 25 and over whose last school was a university or graduate school": "最終学歴が大学・大学院の25歳以上人口の割合",
    "Farming and industry against Japan as a whole (services left out)": "農林漁業と工業の全国比（サービス業を除く）",
    "Near the Japanese average": "全国平均並み", "Farming, forestry, fishing above average": "農林漁業が平均以上",
    "Manufacturing, construction, mining above average": "製造業・建設業・鉱業が平均以上", "Both above average": "両方とも平均以上",
    "Aged 65 and over": "65歳以上", "Residents aged 65 and over, as a share of those 15 and over": "15歳以上人口に占める65歳以上の割合",
    "Pinned. Click anywhere on the heatmap to free it.": "固定中。ヒートマップのどこかをクリックすると解除します。",
    "probability of belonging to this bloc": "このブロックに属する確率", "Bloc probability": "ブロック所属確率", "Assignment certainty": "所属の確からしさ",
    "No votes recorded here.": "得票の記録はありません。", "No data recorded here.": "データの記録はありません。", "no vote": "得票なし",
    "Residents per km².": "1km²あたりの人口。", "All blocs": "全ブロック", "← All blocs": "← 全ブロック",
    // the heatmap's party strip (short names)
    "LDP": "自民", "Kōmei": "公明", "CDP": "立憲", "Ishin": "維新", "JCP": "共産", "SDP": "社民", "Your": "みんな", "Tomorrow": "未来",
    "Oth": "他", "Other": "その他", "NextGen": "次世代", "Kibō": "希望", "DPFP": "国民", "Reiwa": "れいわ", "Sansei": "参政", "Hoshu": "保守", "CRA": "中道", "Mirai": "みらい",
    // buttons and labels
    "Enlarge": "拡大表示", "Pause rotation": "回転を止める", "Resume rotation": "回転させる", "Zoom in": "拡大", "Zoom out": "縮小", "Close": "閉じる",
    "Close subpanel": "閉じる", "Sections": "セクション", "Subpanels": "サブパネル", "Choose a place": "地域を選ぶ", "Enlarge the map": "地図を拡大表示",
    "Enlarge the PCA plot": "主成分分析を拡大表示", "Toggle attribution": "出典の表示切替", "The country's voting blocs": "この国の投票ブロック",
    "Open the referendum heatmap": "ヒートマップを開く",
    "Switch between the national colors and distinct colors for this place's blocs": "全国共通の色とブロックごとの区別しやすい色を切り替えます"
  };
  const terms = [
    // blocs
    ["Satchō periphery", "薩長周縁"], ["Ōuetsu rice country", "奥羽越の米どころ"], ["Castle towns & company towns", "城下町と企業城下町"],
    ["Ezo frontier", "蝦夷地"], ["Komeito provincial cities", "公明党の強い地方都市"], ["Ryūkyū & Bungo", "琉球と豊後"],
    ["Kinai & its rim", "畿内とその周辺"], ["Tōkaidō & Kantō-plain industry", "東海道・関東平野の工業地帯"],
    ["Shinano & the progressive capitals", "信濃と革新系の県都"], ["Metropolitan Japan", "大都市圏"], ["Ōsaka", "大阪"],
    // parties
    ["Liberal Democrats (LDP)", "自由民主党"], ["CRA (CDP + Kōmeitō)", "中道改革連合（立憲・公明）"], ["Kōmeitō", "公明党"],
    ["DPJ / CDP", "民主党・立憲民主党"], ["Communists (JCP)", "日本共産党"], ["Social Democrats (SDP)", "社会民主党"],
    ["Your Party", "みんなの党"], ["Tomorrow Party", "日本未来の党"], ["Next Generation", "次世代の党"], ["Kibō no Tō", "希望の党"],
    ["Reiwa Shinsengumi", "れいわ新選組"], ["Sanseitō", "参政党"], ["Conservative Party (Hoshutō)", "日本保守党"], ["Team Mirai", "チームみらい"],
    // census topics
    ["Age (residents 15 and over)", "年齢（15歳以上）"], ["65 and over", "65歳以上"],
    ["Last school completed (25 and over)", "最終学歴（25歳以上）"], ["Elementary or junior high", "小学校・中学校"], ["High school", "高校"],
    ["Junior college or kōsen", "短大・高専"], ["University or graduate school", "大学・大学院"],
    ["Industry of the employed", "就業者の産業"], ["Farming, forestry, fishing", "農林漁業"],
    ["Manufacturing, construction, mining", "製造業・建設業・鉱業"], ["Services", "サービス業"],
    ["Nationality", "国籍"], ["Foreign nationals", "外国人"], ["Japanese", "日本人"],
    ["Japan", "日本"], ["Other", "その他"],
    ["of residents 25+ with a university degree", "（25歳以上のうち大学卒）"], ["of residents 15+ aged 65 and over", "（15歳以上のうち65歳以上）"]
  ];
  const short = { LDP: "自民", "Kōmei": "公明", CDP: "立憲", Ishin: "維新", JCP: "共産", SDP: "社民", Your: "みんな", Tomorrow: "未来", Oth: "他",
    NextGen: "次世代", "Kibō": "希望", DPFP: "国民", Reiwa: "れいわ", Sansei: "参政", Hoshu: "保守", CRA: "中道", Mirai: "みらい" };
  const NOTE_BLOC = "太字：ブロック、灰色：日本全体。比例代表得票は総務省の市区町村別得票数、年齢・学歴・産業・国籍は2020年国勢調査（e-Stat市区町村別集計、「不詳」と分類不能を除く）による。ブロック内の市区町村の合計。";
  const NOTE_UNIT = "太字：この市区町村、灰色：ブロック$1・日本全体。比例代表得票は総務省の市区町村別得票数、年齢・学歴・産業・国籍は2020年国勢調査（e-Stat市区町村別集計、「不詳」と分類不能を除く）による。";
  const rules = [
    [/^Bold: the bloc; gray: 日本 overall\..*$/s, NOTE_BLOC],
    [/^Bold: this municipality; gray: bloc (\d+) · 日本 overall\..*$/s, NOTE_UNIT],
    [/^Bold: this municipality; gray: bloc (\d+) · 日本\.$/, "太字：この市区町村、灰色：ブロック$1・日本。"],
    [/^([\d,]+) municipalities · (\S+) (\d{4}) (\d+)%(.*)$/s, (m, n, p, y, s, rest) => `${n}市区町村・${y}年${short[p] || p} ${s}%${rest}`],
    [/ · ([\d,]+) residents \((\d+)% of 日本\)/, "・人口$1人（全国の$2%）"],
    [/\(bloc (\d+)\) · ([\d,]+) residents/, "（ブロック$1）・人口$2人"],
    [/^([\d,]+) residents$/, "人口$1人"],
    [/^Bloc (\d+) median$/, "ブロック$1の中央値"], [/^日本 median$/, "全国の中央値"],
    [/^Bloc (\d+)$/, "ブロック$1"], [/^K = (\d+) voting blocs$/, "投票ブロック（K = $1）"],
    [/; next most likely bloc (\d+) \((\d+%)\)/, "、次に可能性が高いのはブロック$1（$2）"],
    [/(\d{4}) House of Representatives election \(PR vote\)/g, "$1年衆議院選挙（比例代表）"],
    [/^(\d{4}), /, "$1年・"],
    [/ average$/, "の平均"], [/^日本の平均$/, "全国平均"],
    [/^(\d+%) (\S+)$/, (m, v, p) => `${v} ${short[p] || p}`],
    [/^Enlarge the (.+) plot$/, (m, t) => `${tr(t)}を拡大表示`],
    [/^日本 · (.+)$/, (m, t) => `日本・${tr(t)}`],
    [/: <b>(\d+%)<\/b> in bloc (\d+)$/, "：<b>$1</b>（ブロック$2）"],
    [/: <b>(\d+%)<\/b> in 日本$/, "：<b>$1</b>（全国）"],
    [/: <b>(\d+%)<\/b> in (.+)$/, "：<b>$1</b>（$2）"],
    [/^(\d+)–(\d+)$/, "$1〜$2歳"]
  ];
  terms.sort((a, b) => b[0].length - a[0].length);
  const EN = /[A-Za-zÀ-ž]/;
  function tr(s) {
    const t = s.trim(); if (!t || !EN.test(t)) return s;
    if (exact[t] != null) return s.replace(t, exact[t]);
    let o = t;
    for (const [e, j] of terms) if (o.includes(e)) o = o.split(e).join(j);
    if (exact[o] != null) o = exact[o];
    for (const [re, rep] of rules) o = o.replace(re, rep);
    if (o === t) return s;
    return s.replace(t, o);
  }
  const ATTR = ["title", "aria-label", "data-tip"];
  const node = n => {
    if (n.nodeType === 3) { if (n.parentElement && n.parentElement.closest("script,style")) return; const v = tr(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; return; }
    if (n.nodeType !== 1) return;
    for (const a of ATTR) if (n.hasAttribute(a)) { const v = n.getAttribute(a), w = tr(v); if (w !== v) n.setAttribute(a, w); }
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let x;
    while ((x = w.nextNode())) { if (x.nodeType === 3) { if (!x.parentElement.closest("script,style")) { const v = tr(x.nodeValue); if (v !== x.nodeValue) x.nodeValue = v; } }
      else for (const a of ATTR) if (x.hasAttribute(a)) { const v = x.getAttribute(a), y = tr(v); if (y !== v) x.setAttribute(a, y); } }
  };
  window.atlasTr = tr;
  document.documentElement.lang = "ja";
  node(document.body);
  new MutationObserver(ms => { for (const m of ms) {
    if (m.type === "characterData") node(m.target);
    else if (m.type === "attributes") node(m.target);
    else m.addedNodes.forEach(node); } })
    .observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTR });
  const t0 = document.title; document.title = tr(t0.replace(" · Atlas of Voting Blocs", "")) + "・投票ブロック地図帳";
  new MutationObserver(() => { if (/[A-Za-z]/.test(document.title.replace("PCA", ""))) document.title = tr(document.title.replace(" · Atlas of Voting Blocs", "")) + "・投票ブロック地図帳"; })
    .observe(document.querySelector("title"), { childList: true });
})();
