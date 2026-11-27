// Where the atlas's data lives: the Cloudflare R2 bucket behind votingblocatlas.org, which mirrors the site's own
// data/<key>/ and assets/world/ (uploaded by scripts/publish_place.sh).  ?localdata on any page reads them from
// this server instead (a local checkout with data/ in place).  Load before the other atlas scripts.
window.ATLAS_DATA = /[?&]localdata\b/.test(location.search) ? "" : "https://votingblocatlas.org/";
// a site path to its address: data/... and assets/world/... come from the bucket; anything else (or a full URL) as is
window.atlasData = p => typeof p === "string" && /^(data|assets\/world)\//.test(p) ? window.ATLAS_DATA + p : p;
