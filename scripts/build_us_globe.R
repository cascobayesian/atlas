# The globe's shading for the US states with atlas blocs (assets/world_night.js): each state's blocs dissolved and
# simplified, b = 1 the bloc with most units (shaded palest, as the countries' blocs are), from data/<key>/units.pmtiles.
#   Rscript scripts/build_us_globe.R   (from the atlas repo)  -> assets/world_k4/us_states.json
suppressMessages({ library(sf); library(dplyr) }); sf_use_s2(FALSE)
REPO <- normalizePath(file.path(dirname(sub("--file=", "", grep("--file=", commandArgs(FALSE), value = TRUE))), ".."))
STATES <- c("California", "Washington", "Utah", "Colorado", "Massachusetts", "Maine", "New Mexico", "Florida", "Louisiana",
            "Alabama", "Michigan", "Ohio", "Maryland", "Georgia", "Wisconsin", "North Carolina")   # US_STATES, assets/world_countries.js
pl <- jsonlite::fromJSON(file.path(REPO, "data", "places.json"))
out <- lapply(STATES, function(st) {
  key <- pl$key[match(st, pl$title)]; f <- file.path(REPO, "data", key, "units.pmtiles")
  if (is.na(key) || !file.exists(f)) { message("skip ", st); return(NULL) }
  g <- st_read(f, layer = "units", quiet = TRUE, options = "ZOOM_LEVEL=6")
  g <- st_transform(g, 5070) |> st_set_precision(1) |> st_make_valid() |> st_buffer(0)
  g <- g[!st_is_empty(g) & st_geometry_type(g) %in% c("POLYGON", "MULTIPOLYGON"), ]
  # tiles cut a unit into pieces: one bloc per u, then dissolve by bloc
  d <- g |> group_by(b) |> summarise(n = n_distinct(u), .groups = "drop")
  d <- d |> st_buffer(400, nQuadSegs = 1) |> st_simplify(dTolerance = 3000, preserveTopology = TRUE) |> st_buffer(-400, nQuadSegs = 1) |>
    st_simplify(dTolerance = 2500, preserveTopology = TRUE) |> st_make_valid()
  # drop specks smaller than 4 km2 (a few pixels even zoomed in)
  d <- st_cast(d, "MULTIPOLYGON") |> st_cast("POLYGON", warn = FALSE); d <- d[as.numeric(st_area(d)) > 4e6, ] |> group_by(b) |> summarise(n = first(n), do_union = FALSE, .groups = "drop") |> st_make_valid()
  d$rank <- rank(-d$n, ties.method = "first"); d$nb <- nrow(d); d$state <- st; d$key <- key
  d$share <- round(d$n / sum(d$n), 3)
  d <- st_collection_extract(d, "POLYGON") |> group_by(b, n) |> summarise(.groups = "drop")      # polygons only (no stray lines)
  d$rank <- rank(-d$n, ties.method = "first"); d$nb <- nrow(d); d$state <- st; d$key <- key; d$share <- round(d$n / sum(d$n), 3)
  st_transform(d[, c("state", "key", "rank", "nb", "share")], 4326)
})
w <- do.call(rbind, Filter(Negate(is.null), out)); names(w)[names(w) == "rank"] <- "b"
w <- st_collection_extract(w, "POLYGON") |> group_by(state, key, b, nb, share) |> summarise(.groups = "drop") |> st_cast("MULTIPOLYGON")
w <- w[order(w$state, w$b), ]
fw <- file.path(REPO, "assets", "world_k4", "us_states.json"); unlink(fw)
st_write(w, fw, driver = "GeoJSON", quiet = TRUE, layer_options = c("COORDINATE_PRECISION=2", "RFC7946=YES"))
writeLines(jsonlite::minify(paste(readLines(fw, warn = FALSE), collapse = "\n")), fw)
cat(sprintf("us_states.json: %d states, %d bloc shapes, %.0f KB\n", length(unique(w$state)), nrow(w), file.size(fw) / 1024))
