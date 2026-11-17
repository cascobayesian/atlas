// The US map at the top of the atlas: click (or Enter/Space on) a state or point to open that place's panels
// below, by reloading with ?place=<key>; the open place is outlined on the map.
(() => {
  const cur = new URLSearchParams(location.search).get("place");
  document.querySelectorAll(".us-hot [data-state]").forEach(el => {
    const key = el.dataset.state;
    el.classList.toggle("active", key === cur);
    const go = () => { const u = new URL(location.href); u.searchParams.set("place", key); u.hash = "ap-name"; location.href = u.href; };
    el.addEventListener("click", go);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });
})();
