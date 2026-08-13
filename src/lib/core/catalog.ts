import type {
  BasemapDefinition,
  BasemapProvider,
  GoogleSessionConfig,
} from "./types";

export const DEFAULT_BASEMAP_PROVIDERS: BasemapProvider[] = [
  { id: "amap", name: "Amap", category: "Regional" },
  { id: "amazon", name: "Amazon Location", category: "General" },
  { id: "carto", name: "Carto", category: "General" },
  { id: "cyclosm", name: "CyclOSM", category: "Cycling" },
  { id: "eox", name: "EOX", category: "Imagery" },
  { id: "esri", name: "ESRI", category: "Imagery" },
  { id: "google", name: "Google", category: "General" },
  { id: "here", name: "HERE", category: "Traffic" },
  { id: "mapbox", name: "Mapbox", category: "General" },
  { id: "maptiler", name: "MapTiler", category: "General" },
  { id: "maptoolkit", name: "Maptoolkit", category: "Outdoor" },
  { id: "nasa-gibs", name: "NASA GIBS", category: "Imagery" },
  { id: "openbasiskaart", name: "Openbasiskaart", category: "Regional" },
  { id: "openfreemap", name: "OpenFreeMap", category: "Vector Styles" },
  { id: "openrailwaymap", name: "OpenRailwayMap", category: "Transport" },
  { id: "openstreetmap", name: "OpenStreetMap", category: "Community" },
  { id: "opentopomap", name: "OpenTopoMap", category: "Terrain" },
  { id: "protomaps", name: "Protomaps", category: "Vector Styles" },
  { id: "stadia", name: "Stadia Maps", category: "General" },
  { id: "swisstopo", name: "Swiss Federal Geoportal", category: "Regional" },
  { id: "tencent", name: "Tencent Maps", category: "Regional" },
  { id: "tianditu", name: "Tianditu", category: "Regional" },
  { id: "tomtom", name: "TomTom", category: "Traffic" },
  { id: "topplusopen", name: "TopPlusOpen", category: "Regional" },
  { id: "usgs", name: "USGS", category: "United States" },
  { id: "waymarkedtrails", name: "Waymarked Trails", category: "Outdoor" },
];

function rasterBasemap({
  id,
  name,
  provider,
  category,
  description,
  attribution,
  tiles,
  maxzoom = 19,
  scheme,
  tags = [],
}: Omit<BasemapDefinition, "type" | "source"> & {
  tiles: string[];
  maxzoom?: number;
  scheme?: "xyz" | "tms";
}): BasemapDefinition {
  return {
    id,
    name,
    provider,
    type: "raster",
    category,
    description,
    attribution,
    source: {
      type: "raster",
      tiles,
      tileSize: 256,
      maxzoom,
      scheme,
    },
    tags,
  };
}

function styleBasemap({
  id,
  name,
  provider,
  category,
  description,
  attribution,
  url,
  view,
  tags = [],
}: Omit<BasemapDefinition, "type" | "source"> & {
  url: string;
}): BasemapDefinition {
  return {
    id,
    name,
    provider,
    type: "style",
    category,
    description,
    attribution,
    source: {
      type: "style",
      url,
    },
    view,
    tags,
  };
}

function mapTilerStyleBasemap({
  id,
  name,
  mapId,
  category,
  description,
  url,
  tags = [],
}: {
  id: string;
  name: string;
  mapId: string;
  category: string;
  description: string;
  url?: string;
  tags?: string[];
}): BasemapDefinition {
  return styleBasemap({
    id,
    name,
    provider: "maptiler",
    category,
    description,
    attribution: MAPTILER_ATTRIBUTION,
    url:
      url ?? `https://api.maptiler.com/maps/${mapId}/style.json?key={api-key}`,
    tags: ["maptiler", "vector", "style", ...tags],
  });
}

function amazonStyleBasemap({
  id,
  name,
  mapStyle,
  category,
  description,
  tags = [],
}: {
  id: string;
  name: string;
  mapStyle: string;
  category: string;
  description: string;
  tags?: string[];
}): BasemapDefinition {
  return styleBasemap({
    id,
    name,
    provider: "amazon",
    category,
    description,
    attribution: AMAZON_ATTRIBUTION,
    url: `https://maps.geo.{aws-region}.amazonaws.com/v2/styles/${mapStyle}/descriptor?key={api-key}`,
    tags: ["amazon", "aws", "location", "style", ...tags],
  });
}

function mapboxStyleBasemap({
  id,
  name,
  styleId,
  category,
  description,
  tags = [],
}: {
  id: string;
  name: string;
  styleId: string;
  category: string;
  description: string;
  tags?: string[];
}): BasemapDefinition {
  return styleBasemap({
    id,
    name,
    provider: "mapbox",
    category,
    description,
    attribution: MAPBOX_ATTRIBUTION,
    url: `https://api.mapbox.com/styles/v1/mapbox/${styleId}?access_token={api-key}`,
    tags: ["mapbox", "vector", "style", ...tags],
  });
}

function mapToolkitStyleBasemap({
  id,
  name,
  styleId,
  category,
  description,
  tags = [],
}: {
  id: string;
  name: string;
  styleId: string;
  category: string;
  description: string;
  tags?: string[];
}): BasemapDefinition {
  return styleBasemap({
    id,
    name,
    provider: "maptoolkit",
    category,
    description,
    attribution: MAPTOOLKIT_ATTRIBUTION,
    url: `https://styles.maptoolkit.org/${styleId}.json`,
    tags: ["maptoolkit", "vector", "style", ...tags],
  });
}

function protomapsStyleBasemap({
  id,
  name,
  styleId,
  category,
  description,
  tags = [],
}: {
  id: string;
  name: string;
  styleId: string;
  category: string;
  description: string;
  tags?: string[];
}): BasemapDefinition {
  return styleBasemap({
    id,
    name,
    provider: "protomaps",
    category,
    description,
    attribution: PROTOMAPS_ATTRIBUTION,
    url: `https://api.protomaps.com/styles/v5/${styleId}/en.json?key={api-key}`,
    tags: ["protomaps", "vector", "style", ...tags],
  });
}

// Stadia Maps raster tiles. The key rides on each tile URL as `?api_key=`, so
// the standard `{api-key}` raster substitution covers it (like TomTom/HERE).
// The Stamen styles carry an extra Stamen Design credit.
function stadiaRasterBasemap({
  id,
  name,
  slug,
  category,
  description,
  extension = "png",
  maxzoom = 20,
  stamen = false,
  tags = [],
}: {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  extension?: "png" | "jpg";
  maxzoom?: number;
  stamen?: boolean;
  tags?: string[];
}): BasemapDefinition {
  return rasterBasemap({
    id,
    name,
    provider: "stadia",
    category,
    description,
    attribution: stamen ? STADIA_STAMEN_ATTRIBUTION : STADIA_ATTRIBUTION,
    tiles: [
      `https://tiles.stadiamaps.com/tiles/${slug}/{z}/{x}/{y}.${extension}?api_key={api-key}`,
    ],
    maxzoom,
    tags: ["stadia", ...(stamen ? ["stamen"] : []), ...tags],
  });
}

// Tianditu serves the same tiles from t0..t7. Browsers multiplex over HTTP/2 so
// the sharding no longer buys throughput, but spreading requests keeps any one
// host from tripping the per-host rate limit on a free key.
const TIANDITU_HOSTS = [0, 1, 2, 3, 4, 5, 6, 7];

// Tianditu's DataServer endpoint, the xyz-shaped form of its WMTS services.
// `T` names the layer (`vec_w` vector, `img_w` imagery, `ter_w` terrain, and the
// `c*_w` annotation overlays that carry their labels), and `tk` is the free API
// key from tianditu.gov.cn, which rides on the URL like TomTom's and HERE's, so
// the standard `{api-key}` raster substitution covers it. The layers are
// published in CGCS2000 on the Web Mercator grid, so `{z}/{x}/{y}` maps
// directly onto `l`/`x`/`y`.
function tiandituRasterBasemap({
  id,
  name,
  layer,
  category,
  description,
  maxzoom = 18,
  tags = [],
}: {
  id: string;
  name: string;
  layer: string;
  category: string;
  description: string;
  maxzoom?: number;
  tags?: string[];
}): BasemapDefinition {
  return rasterBasemap({
    id,
    name,
    provider: "tianditu",
    category,
    description,
    attribution: TIANDITU_ATTRIBUTION,
    tiles: TIANDITU_HOSTS.map(
      (host) =>
        `https://t${host}.tianditu.gov.cn/DataServer?T=${layer}&x={x}&y={y}&l={z}&tk={api-key}`,
    ),
    maxzoom,
    tags: ["tianditu", "china", "天地图", ...tags],
  });
}

// Amap serves each product from four numbered hosts (`wprd01`..`wprd04` for the
// street map, `webst01`..`webst04` for imagery and the label overlay). `style`
// selects the product: 7 street, 6 imagery, 8 roads-and-labels.
function amapTiles(host: "wprd" | "webst", query: string): string[] {
  return [1, 2, 3, 4].map(
    (index) =>
      `https://${host}0${index}.is.autonavi.com/appmaptile?${query}&x={x}&y={y}&z={z}`,
  );
}

function sortProviders(providers: BasemapProvider[]): BasemapProvider[] {
  return [...providers].sort((a, b) => a.name.localeCompare(b.name));
}

const AMAZON_ATTRIBUTION = "&copy; Amazon Location Service";
const CARTO_ATTRIBUTION = "&copy; OpenStreetMap contributors &copy; CARTO";
const ESRI_ATTRIBUTION = "Tiles &copy; Esri and the GIS User Community";
const MAPBOX_ATTRIBUTION = "&copy; Mapbox &copy; OpenStreetMap contributors";
const MAPTILER_ATTRIBUTION =
  "&copy; MapTiler &copy; OpenStreetMap contributors";
const OSM_ATTRIBUTION = "&copy; OpenStreetMap contributors";
// The Maptoolkit style JSONs ship no `attribution` on their sources, and
// Maptoolkit requires the "© Maptoolkit © OSM" credit as clickable links, so the
// catalog supplies it.
const MAPTOOLKIT_ATTRIBUTION =
  '<a href="https://www.maptoolkit.org" target="_blank" rel="noopener">&copy; Maptoolkit</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">&copy; OSM</a>';
const STADIA_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noopener">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> &copy; OpenStreetMap contributors';
const STADIA_STAMEN_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noopener">Stadia Maps</a> &copy; <a href="https://stamen.com/" target="_blank" rel="noopener">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> &copy; OpenStreetMap contributors';
const PROTOMAPS_ATTRIBUTION =
  '<a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a> &copy; <a href="https://openstreetmap.org" target="_blank" rel="noopener">OpenStreetMap</a>';
const OPENFREEMAP_ATTRIBUTION =
  "OpenFreeMap &copy; OpenMapTiles Data from OpenStreetMap";
const TIANDITU_ATTRIBUTION =
  '&copy; <a href="https://www.tianditu.gov.cn" target="_blank" rel="noopener">天地图 Tianditu</a> (National Platform for Common Geospatial Information Services)';
const AMAP_ATTRIBUTION =
  '&copy; <a href="https://www.amap.com" target="_blank" rel="noopener">高德地图 Amap</a>';
const TENCENT_ATTRIBUTION =
  '&copy; <a href="https://map.qq.com" target="_blank" rel="noopener">腾讯地图 Tencent Maps</a>';

// Amap and Tencent tiles are drawn in GCJ-02 ("Mars coordinates"), the offset
// datum Chinese law mandates for public map services. WGS84 data overlaid on
// them lands roughly 100-700 m off, and neither this control nor MapLibre
// applies the shift, so every affected basemap says so in its description.
// Tianditu is the exception: it publishes in CGCS2000, which is close enough to
// WGS84 for web mapping, so ordinary data aligns without conversion.
const GCJ02_WARNING =
  "Tiles are in the GCJ-02 datum, so WGS84 data overlaid on them appears offset by roughly 100-700 m.";

const TOMTOM_ATTRIBUTION = "&copy; TomTom";
const HERE_ATTRIBUTION = "&copy; HERE";
const GOOGLE_ATTRIBUTION = "&copy; Google";
// Authorized Google Map Tiles API 2D tile endpoint. `{session}` is replaced
// with a token minted from `createSession` and `{api-key}` with the configured
// Google Maps API key.
const GOOGLE_2DTILES_URL =
  "https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session={session}&key={api-key}";

// Google base raster basemaps default to the keyless QGIS-style xyz tiles from
// mt1.google.com, so `tiles` is directly usable with no credentials. When a
// Google Maps API key is configured they upgrade to `sessionTiles`, the official
// Map Tiles API endpoint (like the Google Traffic overlay), minting a session
// token so tiles come from Google's authorized endpoint.
function googleRasterBasemap({
  id,
  name,
  category,
  description,
  publicLyrs,
  session,
  tags,
}: {
  id: string;
  name: string;
  category: string;
  description: string;
  publicLyrs: string;
  session: GoogleSessionConfig;
  tags: string[];
}): BasemapDefinition {
  return {
    id,
    name,
    provider: "google",
    type: "raster",
    category,
    description,
    attribution: GOOGLE_ATTRIBUTION,
    source: {
      type: "raster",
      tiles: [`https://mt1.google.com/vt/lyrs=${publicLyrs}&x={x}&y={y}&z={z}`],
      sessionTiles: [GOOGLE_2DTILES_URL],
      tileSize: 256,
      maxzoom: 20,
      googleSession: session,
    },
    tags,
  };
}
const eoxS2CloudlessAttribution = (year: number): string =>
  `Sentinel-2 cloudless <a href="https://cloudless.eox.at" target="_blank" rel="noopener">EOxCloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data ${year})`;
// Annual EOX Sentinel-2 cloudless mosaics published as WMTS layers
// (s2cloudless-<year>_3857). EOX offers yearly mosaics from 2017 onward; the
// catalog exposes one basemap per year so users can pick a specific vintage.
const EOX_S2CLOUDLESS_YEARS = [
  2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
] as const;

function eoxS2CloudlessBasemap(year: number): BasemapDefinition {
  return rasterBasemap({
    id: `eox-s2cloudless-${year}`,
    name: `EOX Sentinel-2 cloudless ${year}`,
    provider: "eox",
    category: "Imagery",
    description: `Cloudless Sentinel-2 satellite mosaic for ${year} (non-commercial use).`,
    attribution: eoxS2CloudlessAttribution(year),
    tiles: [
      `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg`,
    ],
    maxzoom: 16,
    tags: [
      "eox",
      "sentinel",
      "satellite",
      "imagery",
      "cloudless",
      "copernicus",
      String(year),
    ],
  });
}
const EOX_TERRAIN_LIGHT_ATTRIBUTION =
  'Terrain Light <a href="https://maps.eox.at" target="_blank" rel="noopener">EOX</a> (Data &copy; OpenStreetMap contributors and others, Rendering &copy; EOX)';
const EOX_TERRAIN_ATTRIBUTION =
  'Terrain <a href="https://maps.eox.at" target="_blank" rel="noopener">EOX</a> (Data &copy; OpenStreetMap contributors and others, Rendering &copy; EOX)';
const EOX_OVERLAY_ATTRIBUTION =
  'Overlay <a href="https://maps.eox.at" target="_blank" rel="noopener">EOX</a> (Data &copy; OpenStreetMap contributors and others, Rendering &copy; EOX)';

// Congestion color ramp shared by the Mapbox Traffic vector overlay. Mapbox
// Traffic v1 encodes each road segment's level in a `congestion` property, so a
// single line layer can color the whole network with a data-driven `match`.
const MAPBOX_TRAFFIC_CONGESTION_COLORS = [
  "match",
  ["get", "congestion"],
  "low",
  "#4caf50",
  "moderate",
  "#ffc107",
  "heavy",
  "#ff5722",
  "severe",
  "#b71c1c",
  "#9e9e9e",
];

function rasterTrafficBasemap({
  id,
  name,
  provider,
  description,
  attribution,
  tiles,
  maxzoom = 22,
  tags = [],
}: {
  id: string;
  name: string;
  provider: string;
  description: string;
  attribution: string;
  tiles: string[];
  maxzoom?: number;
  tags?: string[];
}): BasemapDefinition {
  return rasterBasemap({
    id,
    name,
    provider,
    category: "Traffic",
    description,
    attribution,
    tiles,
    maxzoom,
    tags: ["traffic", "overlay", ...tags],
  });
}

export const DEFAULT_BASEMAPS: BasemapDefinition[] = [
  rasterBasemap({
    id: "osm-standard",
    name: "OpenStreetMap Standard",
    provider: "openstreetmap",
    category: "Street",
    description: "Community-maintained street map.",
    attribution: OSM_ATTRIBUTION,
    tiles: [
      "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
      "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
      "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
    ],
    tags: ["osm", "street", "standard"],
  }),
  rasterBasemap({
    id: "osm-hot",
    name: "OpenStreetMap HOT",
    provider: "openstreetmap",
    category: "Street",
    description: "Humanitarian OpenStreetMap Team style.",
    attribution: `${OSM_ATTRIBUTION}, Tiles style by Humanitarian OpenStreetMap Team`,
    tiles: ["https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"],
    tags: ["osm", "hot", "humanitarian"],
  }),
  rasterBasemap({
    id: "osm-de",
    name: "OpenStreetMap DE",
    provider: "openstreetmap",
    category: "Regional",
    description: "German OpenStreetMap tile style.",
    attribution: OSM_ATTRIBUTION,
    tiles: ["https://tile.openstreetmap.de/{z}/{x}/{y}.png"],
    tags: ["osm", "germany", "regional"],
  }),
  rasterBasemap({
    id: "osm-ch",
    name: "OpenStreetMap CH",
    provider: "openstreetmap",
    category: "Regional",
    description: "Swiss OpenStreetMap tile style.",
    attribution: OSM_ATTRIBUTION,
    tiles: ["https://tile.osm.ch/switzerland/{z}/{x}/{y}.png"],
    tags: ["osm", "switzerland", "regional"],
  }),
  googleRasterBasemap({
    id: "google-maps",
    name: "Google Maps",
    category: "Street",
    description:
      "Google road map tiles. Uses the Map Tiles API when a Google Maps API key is set, otherwise keyless xyz tiles.",
    publicLyrs: "m",
    session: { mapType: "roadmap" },
    tags: ["google", "street"],
  }),
  googleRasterBasemap({
    id: "google-satellite",
    name: "Google Satellite",
    category: "Imagery",
    description:
      "Google satellite tiles. Uses the Map Tiles API when a Google Maps API key is set, otherwise keyless xyz tiles.",
    publicLyrs: "s",
    session: { mapType: "satellite" },
    tags: ["google", "satellite", "imagery"],
  }),
  googleRasterBasemap({
    id: "google-terrain",
    name: "Google Terrain",
    category: "Terrain",
    description:
      "Google terrain tiles. Uses the Map Tiles API when a Google Maps API key is set, otherwise keyless xyz tiles.",
    publicLyrs: "p",
    // The Map Tiles API requires `layerRoadmap` alongside the terrain map type
    // for the terrain tiles to render.
    session: { mapType: "terrain", layerTypes: ["layerRoadmap"] },
    tags: ["google", "terrain"],
  }),
  googleRasterBasemap({
    id: "google-hybrid",
    name: "Google Hybrid",
    category: "Imagery",
    description:
      "Google hybrid imagery tiles. Uses the Map Tiles API when a Google Maps API key is set, otherwise keyless xyz tiles.",
    publicLyrs: "y",
    // Hybrid is satellite imagery with the roadmap layer (roads and labels)
    // painted on top, matching the classic Google "hybrid" map type.
    session: { mapType: "satellite", layerTypes: ["layerRoadmap"] },
    tags: ["google", "hybrid", "imagery"],
  }),
  amazonStyleBasemap({
    id: "amazon-standard",
    name: "Amazon Standard",
    mapStyle: "Standard",
    category: "Street",
    description: "Amazon Location general-purpose vector map style.",
    tags: ["standard", "street"],
  }),
  amazonStyleBasemap({
    id: "amazon-monochrome",
    name: "Amazon Monochrome",
    mapStyle: "Monochrome",
    category: "Light",
    description: "Amazon Location grey scale map style for overlays.",
    tags: ["monochrome", "light", "dataviz"],
  }),
  amazonStyleBasemap({
    id: "amazon-hybrid",
    name: "Amazon Hybrid",
    mapStyle: "Hybrid",
    category: "Imagery",
    description:
      "Amazon Location satellite imagery with road and label overlay.",
    tags: ["hybrid", "satellite", "imagery", "labels"],
  }),
  amazonStyleBasemap({
    id: "amazon-satellite",
    name: "Amazon Satellite",
    mapStyle: "Satellite",
    category: "Imagery",
    description: "Amazon Location satellite imagery map style.",
    tags: ["satellite", "imagery"],
  }),
  mapboxStyleBasemap({
    id: "mapbox-streets",
    name: "Mapbox Streets",
    styleId: "streets-v12",
    category: "Street",
    description: "Mapbox general-purpose street map style.",
    tags: ["streets", "street"],
  }),
  mapboxStyleBasemap({
    id: "mapbox-outdoors",
    name: "Mapbox Outdoors",
    styleId: "outdoors-v12",
    category: "Outdoor",
    description: "Mapbox outdoor recreation and terrain style.",
    tags: ["outdoors", "terrain", "recreation"],
  }),
  mapboxStyleBasemap({
    id: "mapbox-light",
    name: "Mapbox Light",
    styleId: "light-v11",
    category: "Light",
    description: "Light Mapbox style for data overlays.",
    tags: ["light", "dataviz"],
  }),
  mapboxStyleBasemap({
    id: "mapbox-dark",
    name: "Mapbox Dark",
    styleId: "dark-v11",
    category: "Dark",
    description: "Dark Mapbox style for high-contrast overlays.",
    tags: ["dark"],
  }),
  mapboxStyleBasemap({
    id: "mapbox-satellite",
    name: "Mapbox Satellite",
    styleId: "satellite-v9",
    category: "Imagery",
    description: "Mapbox satellite imagery style.",
    tags: ["satellite", "imagery"],
  }),
  mapboxStyleBasemap({
    id: "mapbox-satellite-streets",
    name: "Mapbox Satellite Streets",
    styleId: "satellite-streets-v12",
    category: "Imagery",
    description: "Mapbox satellite imagery with streets and labels.",
    tags: ["satellite", "streets", "imagery", "labels"],
  }),
  mapboxStyleBasemap({
    id: "mapbox-navigation-day",
    name: "Mapbox Navigation Day",
    styleId: "navigation-day-v1",
    category: "Navigation",
    description: "Mapbox daytime navigation style.",
    tags: ["navigation", "day"],
  }),
  mapboxStyleBasemap({
    id: "mapbox-navigation-night",
    name: "Mapbox Navigation Night",
    styleId: "navigation-night-v1",
    category: "Navigation",
    description: "Mapbox nighttime navigation style.",
    tags: ["navigation", "night", "dark"],
  }),
  mapTilerStyleBasemap({
    id: "maptiler-aquarelle",
    name: "MapTiler Aquarelle",
    mapId: "aquarelle-v4",
    category: "Artistic",
    description: "Watercolor-style vector basemap.",
    tags: ["aquarelle", "watercolor", "artistic"],
  }),
  mapTilerStyleBasemap({
    id: "maptiler-backdrop",
    name: "MapTiler Backdrop",
    mapId: "backdrop-v4",
    category: "Light",
    description: "Subtle monochrome context map.",
    tags: ["backdrop", "monochrome", "context"],
  }),
  mapTilerStyleBasemap({
    id: "maptiler-base",
    name: "MapTiler Base",
    mapId: "base-v4",
    category: "Street",
    description: "General-purpose vector basemap.",
    tags: ["base", "street"],
  }),
  mapTilerStyleBasemap({
    id: "maptiler-dataviz",
    name: "MapTiler Dataviz",
    mapId: "dataviz-v4",
    category: "Light",
    description: "Minimal basemap for data visualization and overlays.",
    tags: ["dataviz", "data", "light"],
  }),
  mapTilerStyleBasemap({
    id: "maptiler-landscape",
    name: "MapTiler Landscape",
    mapId: "landscape-v4",
    category: "Terrain",
    description: "Light terrain and hillshade map.",
    tags: ["landscape", "terrain", "hillshade"],
  }),
  mapTilerStyleBasemap({
    id: "maptiler-ocean",
    name: "MapTiler Ocean",
    mapId: "ocean-v4",
    category: "Marine",
    description: "Ocean bathymetry and marine-focused basemap.",
    tags: ["ocean", "marine", "bathymetry"],
  }),
  mapTilerStyleBasemap({
    id: "maptiler-openstreetmap",
    name: "MapTiler OpenStreetMap",
    mapId: "openstreetmap",
    category: "Street",
    description: "OpenStreetMap style hosted by MapTiler.",
    url: "https://api.maptiler.com/maps/openstreetmap/style.json?key",
    tags: ["openstreetmap", "osm", "street"],
  }),
  mapTilerStyleBasemap({
    id: "maptiler-outdoor",
    name: "MapTiler Outdoor",
    mapId: "outdoor-v4",
    category: "Outdoor",
    description: "Outdoor recreation basemap with terrain detail.",
    tags: ["outdoor", "terrain", "recreation"],
  }),
  mapTilerStyleBasemap({
    id: "maptiler-satellite-hybrid",
    name: "MapTiler Satellite Hybrid",
    mapId: "hybrid-v4",
    category: "Imagery",
    description: "Satellite imagery with labels, roads, and borders.",
    tags: ["satellite", "hybrid", "imagery", "labels"],
  }),
  mapTilerStyleBasemap({
    id: "maptiler-satellite-plain",
    name: "MapTiler Satellite Plain",
    mapId: "satellite-v4",
    category: "Imagery",
    description: "Satellite imagery without the hybrid reference overlay.",
    tags: ["satellite", "imagery"],
  }),
  mapTilerStyleBasemap({
    id: "maptiler-streets",
    name: "MapTiler Streets",
    mapId: "streets-v4",
    category: "Street",
    description: "Detailed street map for general navigation.",
    tags: ["streets", "street", "navigation"],
  }),
  mapTilerStyleBasemap({
    id: "maptiler-toner",
    name: "MapTiler Toner",
    mapId: "toner-v2",
    category: "Dark",
    description: "High-contrast monochrome basemap.",
    url: "https://api.maptiler.com/maps/toner-v2/style.json?key=",
    tags: ["toner", "monochrome", "contrast"],
  }),
  mapTilerStyleBasemap({
    id: "maptiler-topo",
    name: "MapTiler Topo",
    mapId: "topo-v4",
    category: "Terrain",
    description: "Topographic basemap with contours and terrain context.",
    tags: ["topo", "topographic", "terrain"],
  }),
  mapTilerStyleBasemap({
    id: "maptiler-winter",
    name: "MapTiler Winter",
    mapId: "winter-v4",
    category: "Outdoor",
    description: "Winter sports and mountain activity basemap.",
    tags: ["winter", "skiing", "outdoor"],
  }),
  rasterBasemap({
    id: "carto-positron",
    name: "Carto Positron",
    provider: "carto",
    category: "Light",
    description: "Light basemap for data overlays.",
    attribution: CARTO_ATTRIBUTION,
    tiles: [
      "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    ],
    maxzoom: 20,
    tags: ["carto", "light", "positron"],
  }),
  rasterBasemap({
    id: "carto-positron-no-labels",
    name: "Carto Positron No Labels",
    provider: "carto",
    category: "Light",
    description: "Light basemap without labels.",
    attribution: CARTO_ATTRIBUTION,
    tiles: ["https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png"],
    maxzoom: 20,
    tags: ["carto", "light", "no labels"],
  }),
  rasterBasemap({
    id: "carto-positron-only-labels",
    name: "Carto Positron Only Labels",
    provider: "carto",
    category: "Labels",
    description: "Carto Positron labels layer.",
    attribution: CARTO_ATTRIBUTION,
    tiles: [
      "https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png",
    ],
    maxzoom: 20,
    tags: ["carto", "labels"],
  }),
  rasterBasemap({
    id: "carto-dark-matter",
    name: "Carto Dark Matter",
    provider: "carto",
    category: "Dark",
    description: "Dark basemap for high-contrast overlays.",
    attribution: CARTO_ATTRIBUTION,
    tiles: [
      "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    ],
    maxzoom: 20,
    tags: ["carto", "dark", "matter"],
  }),
  rasterBasemap({
    id: "carto-dark-matter-no-labels",
    name: "Carto Dark Matter No Labels",
    provider: "carto",
    category: "Dark",
    description: "Dark basemap without labels.",
    attribution: CARTO_ATTRIBUTION,
    tiles: ["https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png"],
    maxzoom: 20,
    tags: ["carto", "dark", "no labels"],
  }),
  rasterBasemap({
    id: "carto-dark-matter-only-labels",
    name: "Carto Dark Matter Only Labels",
    provider: "carto",
    category: "Labels",
    description: "Carto Dark Matter labels layer.",
    attribution: CARTO_ATTRIBUTION,
    tiles: ["https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png"],
    maxzoom: 20,
    tags: ["carto", "dark", "labels"],
  }),
  rasterBasemap({
    id: "carto-voyager",
    name: "Carto Voyager",
    provider: "carto",
    category: "Street",
    description: "Detailed street basemap with subtle styling.",
    attribution: CARTO_ATTRIBUTION,
    tiles: [
      "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    ],
    maxzoom: 20,
    tags: ["carto", "street", "voyager"],
  }),
  rasterBasemap({
    id: "carto-voyager-no-labels",
    name: "Carto Voyager No Labels",
    provider: "carto",
    category: "Street",
    description: "Carto Voyager without labels.",
    attribution: CARTO_ATTRIBUTION,
    tiles: [
      "https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png",
    ],
    maxzoom: 20,
    tags: ["carto", "voyager", "no labels"],
  }),
  rasterBasemap({
    id: "carto-voyager-only-labels",
    name: "Carto Voyager Only Labels",
    provider: "carto",
    category: "Labels",
    description: "Carto Voyager labels layer.",
    attribution: CARTO_ATTRIBUTION,
    tiles: [
      "https://a.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png",
    ],
    maxzoom: 20,
    tags: ["carto", "voyager", "labels"],
  }),
  rasterBasemap({
    id: "carto-voyager-labels-under",
    name: "Carto Voyager Labels Under",
    provider: "carto",
    category: "Street",
    description: "Carto Voyager labels-under variant.",
    attribution: CARTO_ATTRIBUTION,
    tiles: [
      "https://a.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}.png",
    ],
    maxzoom: 20,
    tags: ["carto", "voyager", "labels"],
  }),
  rasterBasemap({
    id: "cyclosm",
    name: "CyclOSM",
    provider: "cyclosm",
    category: "Cycling",
    description: "Cycling-focused OpenStreetMap style.",
    attribution: "CyclOSM | Map data: &copy; OpenStreetMap contributors",
    tiles: ["https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png"],
    tags: ["cycling", "osm"],
  }),
  rasterBasemap({
    id: "esri-world-imagery",
    name: "World Imagery",
    provider: "esri",
    category: "Imagery",
    description: "Satellite and aerial imagery.",
    attribution:
      "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    tags: ["esri", "satellite", "imagery"],
  }),
  rasterBasemap({
    id: "esri-world-topo",
    name: "World Topographic",
    provider: "esri",
    category: "Terrain",
    description: "Reference topographic map.",
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    ],
    tags: ["esri", "topographic", "terrain"],
  }),
  rasterBasemap({
    id: "esri-world-street-map",
    name: "World Street Map",
    provider: "esri",
    category: "Street",
    description: "ESRI street reference basemap.",
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    ],
    tags: ["esri", "street"],
  }),
  rasterBasemap({
    id: "esri-world-gray-canvas",
    name: "World Gray Canvas",
    provider: "esri",
    category: "Light",
    description: "Light gray canvas basemap.",
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    ],
    tags: ["esri", "gray", "canvas"],
  }),
  rasterBasemap({
    id: "esri-world-dark-gray-canvas",
    name: "World Dark Gray Canvas",
    provider: "esri",
    category: "Dark",
    description: "Dark gray canvas basemap for high-contrast overlays.",
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    ],
    tags: ["esri", "dark", "gray", "canvas"],
  }),
  rasterBasemap({
    id: "esri-world-light-gray-reference",
    name: "World Light Gray Reference",
    provider: "esri",
    category: "Labels",
    description:
      "Boundary and place label overlay matching the Light Gray Canvas basemap.",
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    ],
    tags: ["esri", "labels", "reference", "gray", "overlay"],
  }),
  rasterBasemap({
    id: "esri-world-dark-gray-reference",
    name: "World Dark Gray Reference",
    provider: "esri",
    category: "Labels",
    description:
      "Boundary and place label overlay matching the Dark Gray Canvas basemap.",
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    ],
    tags: ["esri", "labels", "reference", "dark", "gray", "overlay"],
  }),
  rasterBasemap({
    id: "esri-natgeo-world-map",
    name: "NatGeo World Map",
    provider: "esri",
    category: "Street",
    description: "National Geographic style world map.",
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}",
    ],
    tags: ["esri", "natgeo"],
  }),
  rasterBasemap({
    id: "esri-ocean-basemap",
    name: "Ocean Basemap",
    provider: "esri",
    category: "Marine",
    description: "Ocean reference basemap.",
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
    ],
    tags: ["esri", "ocean", "marine"],
  }),
  rasterBasemap({
    id: "esri-world-physical",
    name: "World Physical",
    provider: "esri",
    category: "Terrain",
    description: "Physical world map.",
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}",
    ],
    tags: ["esri", "physical", "terrain"],
  }),
  rasterBasemap({
    id: "esri-world-shaded-relief",
    name: "World Shaded Relief",
    provider: "esri",
    category: "Terrain",
    description: "Shaded relief world map.",
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}",
    ],
    tags: ["esri", "relief", "terrain"],
  }),
  rasterBasemap({
    id: "esri-world-terrain",
    name: "World Terrain",
    provider: "esri",
    category: "Terrain",
    description: "ESRI terrain base.",
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}",
    ],
    tags: ["esri", "terrain"],
  }),
  ...EOX_S2CLOUDLESS_YEARS.map(eoxS2CloudlessBasemap),
  rasterBasemap({
    id: "eox-terrain-light",
    name: "EOX Terrain Light",
    provider: "eox",
    category: "Terrain",
    description: "Light terrain basemap from EOX Maps (non-commercial use).",
    attribution: EOX_TERRAIN_LIGHT_ATTRIBUTION,
    tiles: [
      "https://tiles.maps.eox.at/wmts/1.0.0/terrain-light_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
    ],
    maxzoom: 14,
    tags: ["eox", "terrain", "light", "hillshade"],
  }),
  rasterBasemap({
    id: "eox-terrain",
    name: "EOX Terrain",
    provider: "eox",
    category: "Terrain",
    description:
      "Natural-like terrain basemap from EOX Maps (non-commercial use).",
    attribution: EOX_TERRAIN_ATTRIBUTION,
    // terrain_3857 is only published on EOX's "g" tile matrix set, which is the
    // Web Mercator (GoogleMapsCompatible) grid under a different identifier.
    tiles: [
      "https://tiles.maps.eox.at/wmts/1.0.0/terrain_3857/default/g/{z}/{y}/{x}.jpg",
    ],
    maxzoom: 14,
    tags: ["eox", "terrain", "hillshade"],
  }),
  rasterBasemap({
    id: "eox-overlay",
    name: "EOX Overlay",
    provider: "eox",
    category: "Labels",
    description:
      "Transparent overlay with borders and points of interest from EOX Maps (non-commercial use).",
    attribution: EOX_OVERLAY_ATTRIBUTION,
    tiles: [
      "https://tiles.maps.eox.at/wmts/1.0.0/overlay_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.png",
    ],
    maxzoom: 14,
    tags: ["eox", "overlay", "labels", "borders", "reference"],
  }),
  rasterBasemap({
    id: "eox-overlay-bright",
    name: "EOX Overlay Bright",
    provider: "eox",
    category: "Labels",
    description:
      "Bright transparent overlay with borders and points of interest from EOX Maps (non-commercial use).",
    attribution: EOX_OVERLAY_ATTRIBUTION,
    tiles: [
      "https://tiles.maps.eox.at/wmts/1.0.0/overlay_bright_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.png",
    ],
    maxzoom: 14,
    tags: ["eox", "overlay", "labels", "borders", "reference", "bright"],
  }),
  rasterBasemap({
    id: "nasa-gibs-blue-marble",
    name: "Blue Marble",
    provider: "nasa-gibs",
    category: "Imagery",
    description: "NASA Blue Marble Next Generation imagery.",
    attribution: "Imagery provided by NASA Global Imagery Browse Services",
    tiles: [
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
    ],
    maxzoom: 8,
    tags: ["nasa", "gibs", "blue marble"],
  }),
  rasterBasemap({
    id: "nasa-gibs-aster-gdem-shaded-relief",
    name: "ASTER GDEM Shaded Relief",
    provider: "nasa-gibs",
    category: "Terrain",
    description: "NASA ASTER GDEM greyscale shaded relief.",
    attribution: "Imagery provided by NASA Global Imagery Browse Services",
    tiles: [
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/ASTER_GDEM_Greyscale_Shaded_Relief/default/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg",
    ],
    maxzoom: 12,
    tags: ["nasa", "gibs", "relief", "terrain"],
  }),
  rasterBasemap({
    id: "nasa-gibs-modis-terra-true-color",
    name: "MODIS Terra True Color",
    provider: "nasa-gibs",
    category: "Imagery",
    description: "NASA MODIS Terra corrected reflectance true color.",
    attribution: "Imagery provided by NASA Global Imagery Browse Services",
    tiles: [
      "https://map1.vis.earthdata.nasa.gov/wmts-webmerc/MODIS_Terra_CorrectedReflectance_TrueColor/default//GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
    ],
    maxzoom: 9,
    tags: ["nasa", "gibs", "modis", "true color"],
  }),
  rasterBasemap({
    id: "nasa-gibs-viirs-earth-at-night",
    name: "VIIRS Earth At Night 2012",
    provider: "nasa-gibs",
    category: "Imagery",
    description: "NASA VIIRS city lights imagery.",
    attribution: "Imagery provided by NASA Global Imagery Browse Services",
    tiles: [
      "https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default//GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg",
    ],
    maxzoom: 8,
    tags: ["nasa", "gibs", "night", "viirs"],
  }),
  rasterBasemap({
    id: "openrailwaymap",
    name: "OpenRailwayMap",
    provider: "openrailwaymap",
    category: "Transport",
    description: "Railway infrastructure map.",
    attribution:
      "Map data: &copy; OpenStreetMap contributors | Map style: OpenRailwayMap",
    tiles: ["https://a.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png"],
    tags: ["rail", "transport", "osm"],
  }),
  rasterBasemap({
    id: "openrailwaymap-maxspeed",
    name: "OpenRailwayMap Maxspeed",
    provider: "openrailwaymap",
    category: "Transport",
    description: "Railway line speed limits as a transparent overlay.",
    attribution:
      "Map data: &copy; OpenStreetMap contributors | Map style: OpenRailwayMap",
    tiles: ["https://a.tiles.openrailwaymap.org/maxspeed/{z}/{x}/{y}.png"],
    tags: ["rail", "transport", "osm", "maxspeed", "speed", "overlay"],
  }),
  rasterBasemap({
    id: "openrailwaymap-electrification",
    name: "OpenRailwayMap Electrification",
    provider: "openrailwaymap",
    category: "Transport",
    description:
      "Railway electrification systems and voltages as a transparent overlay.",
    attribution:
      "Map data: &copy; OpenStreetMap contributors | Map style: OpenRailwayMap",
    tiles: [
      "https://a.tiles.openrailwaymap.org/electrification/{z}/{x}/{y}.png",
    ],
    tags: ["rail", "transport", "osm", "electrification", "voltage", "overlay"],
  }),
  rasterBasemap({
    id: "openrailwaymap-signals",
    name: "OpenRailwayMap Signals",
    provider: "openrailwaymap",
    category: "Transport",
    description: "Railway signalling infrastructure as a transparent overlay.",
    attribution:
      "Map data: &copy; OpenStreetMap contributors | Map style: OpenRailwayMap",
    tiles: ["https://a.tiles.openrailwaymap.org/signals/{z}/{x}/{y}.png"],
    tags: ["rail", "transport", "osm", "signals", "signalling", "overlay"],
  }),
  rasterBasemap({
    id: "opentopomap",
    name: "OpenTopoMap",
    provider: "opentopomap",
    category: "Terrain",
    description: "Topographic map with relief and contour styling.",
    attribution:
      "Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap",
    tiles: ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png"],
    maxzoom: 17,
    tags: ["terrain", "topo", "relief"],
  }),
  stadiaRasterBasemap({
    id: "stadia-alidade-smooth",
    name: "Stadia Alidade Smooth",
    slug: "alidade_smooth",
    category: "Light",
    description: "Muted light basemap with few POIs, designed for overlays.",
    tags: ["alidade", "smooth", "light", "dataviz"],
  }),
  stadiaRasterBasemap({
    id: "stadia-alidade-smooth-dark",
    name: "Stadia Alidade Smooth Dark",
    slug: "alidade_smooth_dark",
    category: "Dark",
    description: "Dark counterpart to Alidade Smooth for overlays.",
    tags: ["alidade", "smooth", "dark", "dataviz"],
  }),
  stadiaRasterBasemap({
    id: "stadia-alidade-satellite",
    name: "Stadia Alidade Satellite",
    slug: "alidade_satellite",
    category: "Imagery",
    description: "Satellite imagery with Alidade labels and roads.",
    extension: "jpg",
    tags: ["alidade", "satellite", "imagery", "labels"],
  }),
  stadiaRasterBasemap({
    id: "stadia-outdoors",
    name: "Stadia Outdoors",
    slug: "outdoors",
    category: "Outdoor",
    description: "Outdoor basemap highlighting trails, parks, and ski slopes.",
    tags: ["outdoors", "trails", "hiking", "recreation"],
  }),
  stadiaRasterBasemap({
    id: "stadia-osm-bright",
    name: "Stadia OSM Bright",
    slug: "osm_bright",
    category: "Street",
    description: "General-purpose OpenStreetMap street basemap.",
    tags: ["osm", "bright", "street"],
  }),
  stadiaRasterBasemap({
    id: "stadia-stamen-toner",
    name: "Stamen Toner",
    slug: "stamen_toner",
    category: "Dark",
    description: "High-contrast black and white Stamen basemap.",
    stamen: true,
    tags: ["toner", "dark", "contrast", "monochrome"],
  }),
  stadiaRasterBasemap({
    id: "stadia-stamen-toner-lite",
    name: "Stamen Toner Lite",
    slug: "stamen_toner_lite",
    category: "Light",
    description: "Lighter, lower-contrast variant of Stamen Toner.",
    stamen: true,
    tags: ["toner", "lite", "light", "monochrome"],
  }),
  stadiaRasterBasemap({
    id: "stadia-stamen-toner-background",
    name: "Stamen Toner Background",
    slug: "stamen_toner_background",
    category: "Dark",
    description: "Stamen Toner without labels, for use under your own data.",
    stamen: true,
    tags: ["toner", "background", "no labels", "monochrome"],
  }),
  stadiaRasterBasemap({
    id: "stadia-stamen-toner-labels",
    name: "Stamen Toner Labels",
    slug: "stamen_toner_labels",
    category: "Labels",
    description: "Stamen Toner label overlay.",
    stamen: true,
    tags: ["toner", "labels", "overlay"],
  }),
  stadiaRasterBasemap({
    id: "stadia-stamen-terrain",
    name: "Stamen Terrain",
    slug: "stamen_terrain",
    category: "Terrain",
    description: "Stamen terrain basemap with hill shading and vegetation.",
    stamen: true,
    tags: ["terrain", "hillshade", "relief"],
  }),
  stadiaRasterBasemap({
    id: "stadia-stamen-terrain-background",
    name: "Stamen Terrain Background",
    slug: "stamen_terrain_background",
    category: "Terrain",
    description: "Stamen Terrain without labels or roads.",
    stamen: true,
    tags: ["terrain", "background", "hillshade", "no labels"],
  }),
  stadiaRasterBasemap({
    id: "stadia-stamen-terrain-labels",
    name: "Stamen Terrain Labels",
    slug: "stamen_terrain_labels",
    category: "Labels",
    description: "Stamen Terrain label overlay.",
    stamen: true,
    tags: ["terrain", "labels", "overlay"],
  }),
  stadiaRasterBasemap({
    id: "stadia-stamen-watercolor",
    name: "Stamen Watercolor",
    slug: "stamen_watercolor",
    category: "Artistic",
    description: "Hand-painted watercolor basemap from Stamen Design.",
    extension: "jpg",
    maxzoom: 16,
    stamen: true,
    tags: ["watercolor", "artistic", "painted"],
  }),
  rasterBasemap({
    id: "swisstopo-national-map-color",
    name: "Swiss National Map Color",
    provider: "swisstopo",
    category: "Regional",
    description: "Swiss federal color national map.",
    attribution: "&copy; swisstopo",
    tiles: [
      "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    ],
    maxzoom: 18,
    tags: ["switzerland", "regional"],
  }),
  rasterBasemap({
    id: "swisstopo-national-map-grey",
    name: "Swiss National Map Grey",
    provider: "swisstopo",
    category: "Regional",
    description: "Swiss federal grey national map.",
    attribution: "&copy; swisstopo",
    tiles: [
      "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg",
    ],
    maxzoom: 18,
    tags: ["switzerland", "regional", "grey"],
  }),
  rasterBasemap({
    id: "swisstopo-swissimage",
    name: "SWISSIMAGE",
    provider: "swisstopo",
    category: "Imagery",
    description: "Swiss federal aerial imagery.",
    attribution: "&copy; swisstopo",
    tiles: [
      "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg",
    ],
    maxzoom: 18,
    tags: ["switzerland", "imagery"],
  }),
  tiandituRasterBasemap({
    id: "tianditu-vector",
    name: "Tianditu Vector",
    layer: "vec_w",
    category: "Regional",
    description:
      "China's official street map, reachable from mainland China. Published in CGCS2000, so WGS84 data overlays without a datum shift. Pair with Tianditu Vector Labels. Requires a free Tianditu API key.",
    tags: ["vector", "street", "vec"],
  }),
  tiandituRasterBasemap({
    id: "tianditu-vector-labels",
    name: "Tianditu Vector Labels",
    layer: "cva_w",
    category: "Labels",
    description:
      "Place name and road label overlay for Tianditu Vector. Requires a free Tianditu API key.",
    tags: ["labels", "annotation", "overlay", "cva"],
  }),
  tiandituRasterBasemap({
    id: "tianditu-imagery",
    name: "Tianditu Imagery",
    layer: "img_w",
    category: "Imagery",
    description:
      "China's official satellite imagery, reachable from mainland China. Pair with Tianditu Imagery Labels. Requires a free Tianditu API key.",
    tags: ["imagery", "satellite", "img"],
  }),
  tiandituRasterBasemap({
    id: "tianditu-imagery-labels",
    name: "Tianditu Imagery Labels",
    layer: "cia_w",
    category: "Labels",
    description:
      "Place name and road label overlay for Tianditu Imagery. Requires a free Tianditu API key.",
    tags: ["labels", "annotation", "overlay", "cia"],
  }),
  tiandituRasterBasemap({
    id: "tianditu-terrain",
    name: "Tianditu Terrain",
    layer: "ter_w",
    category: "Terrain",
    description:
      "China's official shaded relief terrain map. Pair with Tianditu Terrain Labels. Requires a free Tianditu API key.",
    // The terrain pair is only published to zoom 14, unlike the vector and
    // imagery layers, which reach 18.
    maxzoom: 14,
    tags: ["terrain", "relief", "hillshade", "ter"],
  }),
  tiandituRasterBasemap({
    id: "tianditu-terrain-labels",
    name: "Tianditu Terrain Labels",
    layer: "cta_w",
    category: "Labels",
    description:
      "Place name label overlay for Tianditu Terrain. Requires a free Tianditu API key.",
    maxzoom: 14,
    tags: ["labels", "annotation", "overlay", "cta"],
  }),
  rasterBasemap({
    id: "amap-street",
    name: "Amap Street",
    provider: "amap",
    category: "Regional",
    description: `Amap street map of China, reachable from mainland China. ${GCJ02_WARNING}`,
    attribution: AMAP_ATTRIBUTION,
    tiles: amapTiles("wprd", "lang=zh_cn&size=1&scl=1&style=7"),
    tags: ["amap", "gaode", "高德", "china", "street", "gcj02"],
  }),
  rasterBasemap({
    id: "amap-satellite",
    name: "Amap Satellite",
    provider: "amap",
    category: "Imagery",
    description: `Amap satellite imagery, reachable from mainland China. Pair with Amap Labels. ${GCJ02_WARNING}`,
    attribution: AMAP_ATTRIBUTION,
    tiles: amapTiles("webst", "style=6"),
    // Past zoom 18 Amap returns a "no imagery" placeholder tile rather than a
    // 404, so cap here and let MapLibre overzoom instead.
    maxzoom: 18,
    tags: ["amap", "gaode", "高德", "china", "satellite", "imagery", "gcj02"],
  }),
  rasterBasemap({
    id: "amap-labels",
    name: "Amap Labels",
    provider: "amap",
    category: "Labels",
    description: `Transparent Amap road and label overlay, for use over Amap Satellite. ${GCJ02_WARNING}`,
    attribution: AMAP_ATTRIBUTION,
    tiles: amapTiles("webst", "style=8"),
    tags: [
      "amap",
      "gaode",
      "高德",
      "china",
      "labels",
      "roads",
      "overlay",
      "gcj02",
    ],
  }),
  rasterBasemap({
    id: "tencent-street",
    name: "Tencent Street",
    provider: "tencent",
    category: "Regional",
    description: `Tencent street map of China, reachable from mainland China. ${GCJ02_WARNING}`,
    attribution: TENCENT_ATTRIBUTION,
    // Tencent numbers tile rows from the bottom, so the source is TMS rather
    // than xyz; MapLibre flips `{y}` when `scheme` says so.
    tiles: [0, 1, 2, 3].map(
      (host) =>
        `https://rt${host}.map.gtimg.com/tile?z={z}&x={x}&y={y}&styleid=1&scene=0`,
    ),
    maxzoom: 18,
    scheme: "tms",
    tags: ["tencent", "qq", "腾讯", "china", "street", "gcj02"],
  }),
  rasterBasemap({
    id: "tencent-dark",
    name: "Tencent Dark",
    provider: "tencent",
    category: "Dark",
    description: `Dark Tencent street map for high-contrast overlays, reachable from mainland China. ${GCJ02_WARNING}`,
    attribution: TENCENT_ATTRIBUTION,
    tiles: [0, 1, 2, 3].map(
      (host) =>
        `https://rt${host}.map.gtimg.com/tile?z={z}&x={x}&y={y}&styleid=4&scene=0`,
    ),
    maxzoom: 18,
    scheme: "tms",
    tags: ["tencent", "qq", "腾讯", "china", "dark", "gcj02"],
  }),
  rasterBasemap({
    id: "topplusopen-color",
    name: "TopPlusOpen Color",
    provider: "topplusopen",
    category: "Regional",
    description: "German TopPlusOpen color basemap.",
    attribution: "Map data: &copy; dl-de/by-2-0",
    tiles: [
      "https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png",
    ],
    maxzoom: 18,
    tags: ["germany", "regional"],
  }),
  rasterBasemap({
    id: "topplusopen-grey",
    name: "TopPlusOpen Grey",
    provider: "topplusopen",
    category: "Regional",
    description: "German TopPlusOpen grey basemap.",
    attribution: "Map data: &copy; dl-de/by-2-0",
    tiles: [
      "https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web_grau/default/WEBMERCATOR/{z}/{y}/{x}.png",
    ],
    maxzoom: 18,
    tags: ["germany", "regional", "grey"],
  }),
  rasterBasemap({
    id: "usgs-us-imagery",
    name: "USGS US Imagery",
    provider: "usgs",
    category: "Imagery",
    description: "USGS imagery-only basemap.",
    attribution: "Tiles courtesy of the U.S. Geological Survey",
    tiles: [
      "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}",
    ],
    tags: ["usgs", "imagery", "united states"],
  }),
  rasterBasemap({
    id: "usgs-us-imagery-topo",
    name: "USGS US Imagery Topo",
    provider: "usgs",
    category: "Imagery",
    description: "USGS imagery with topographic reference.",
    attribution: "Tiles courtesy of the U.S. Geological Survey",
    tiles: [
      "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}",
    ],
    tags: ["usgs", "imagery", "topo", "united states"],
  }),
  rasterBasemap({
    id: "usgs-us-topo",
    name: "USGS US Topo",
    provider: "usgs",
    category: "Terrain",
    description: "USGS topographic basemap.",
    attribution: "Tiles courtesy of the U.S. Geological Survey",
    tiles: [
      "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}",
    ],
    tags: ["usgs", "topo", "united states"],
  }),
  rasterBasemap({
    id: "usgs-us-hydro",
    name: "USGS US Hydrography",
    provider: "usgs",
    category: "Labels",
    description:
      "USGS National Hydrography reference overlay of rivers, streams, and waterbodies.",
    attribution: "Tiles courtesy of the U.S. Geological Survey",
    tiles: [
      "https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/tile/{z}/{y}/{x}",
    ],
    tags: ["usgs", "hydrography", "water", "overlay", "united states"],
  }),
  rasterBasemap({
    id: "usgs-us-shaded-relief",
    name: "USGS US Shaded Relief",
    provider: "usgs",
    category: "Terrain",
    description: "USGS shaded relief basemap without other reference content.",
    attribution: "Tiles courtesy of the U.S. Geological Survey",
    tiles: [
      "https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}",
    ],
    tags: ["usgs", "relief", "hillshade", "terrain", "united states"],
  }),
  rasterBasemap({
    id: "waymarkedtrails-hiking",
    name: "Waymarked Trails Hiking",
    provider: "waymarkedtrails",
    category: "Outdoor",
    description: "Hiking routes from Waymarked Trails.",
    attribution:
      "Map data: &copy; OpenStreetMap contributors | Map style: Waymarked Trails",
    tiles: ["https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png"],
    tags: ["hiking", "outdoor", "trails"],
  }),
  rasterBasemap({
    id: "waymarkedtrails-cycling",
    name: "Waymarked Trails Cycling",
    provider: "waymarkedtrails",
    category: "Cycling",
    description: "Cycling routes from Waymarked Trails.",
    attribution:
      "Map data: &copy; OpenStreetMap contributors | Map style: Waymarked Trails",
    tiles: ["https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png"],
    tags: ["cycling", "outdoor", "trails"],
  }),
  rasterBasemap({
    id: "waymarkedtrails-mtb",
    name: "Waymarked Trails MTB",
    provider: "waymarkedtrails",
    category: "Cycling",
    description: "Mountain biking routes from Waymarked Trails.",
    attribution:
      "Map data: &copy; OpenStreetMap contributors | Map style: Waymarked Trails",
    tiles: ["https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png"],
    tags: ["mtb", "outdoor", "trails"],
  }),
  rasterBasemap({
    id: "waymarkedtrails-slopes",
    name: "Waymarked Trails Slopes",
    provider: "waymarkedtrails",
    category: "Outdoor",
    description: "Slope routes from Waymarked Trails.",
    attribution:
      "Map data: &copy; OpenStreetMap contributors | Map style: Waymarked Trails",
    tiles: ["https://tile.waymarkedtrails.org/slopes/{z}/{x}/{y}.png"],
    tags: ["slopes", "outdoor", "trails"],
  }),
  rasterBasemap({
    id: "openbasiskaart",
    name: "Openbasiskaart",
    provider: "openbasiskaart",
    category: "Regional",
    description:
      "Netherlands topographic background map based on OpenStreetMap data.",
    attribution: "Map data &copy; OpenStreetMap contributors | Openbasiskaart",
    // The Google Maps Compatible (osm-g) layer uses the standard Web Mercator
    // grid, so its WMTS {TileMatrix}/{TileRow}/{TileCol} maps directly to xyz.
    tiles: [
      "https://www.openbasiskaart.nl/mapcache/wmts/1.0.0/osm-g/default/g/{z}/{y}/{x}.png",
    ],
    maxzoom: 18,
    tags: ["netherlands", "regional", "topographic", "osm", "openbasiskaart"],
  }),
  {
    id: "openfreemap-positron",
    name: "OpenFreeMap Positron",
    provider: "openfreemap",
    type: "style",
    category: "Light",
    description: "Light, minimal OpenFreeMap vector style for data overlays.",
    attribution: OPENFREEMAP_ATTRIBUTION,
    source: {
      type: "style",
      url: "https://tiles.openfreemap.org/styles/positron",
    },
    tags: ["openfreemap", "vector", "style", "positron", "light"],
  },
  {
    id: "openfreemap-bright",
    name: "OpenFreeMap Bright",
    provider: "openfreemap",
    type: "style",
    category: "Street",
    description: "Colorful OpenFreeMap vector street style.",
    attribution: OPENFREEMAP_ATTRIBUTION,
    source: {
      type: "style",
      url: "https://tiles.openfreemap.org/styles/bright",
    },
    tags: ["openfreemap", "vector", "style", "bright", "street"],
  },
  {
    id: "openfreemap-liberty",
    name: "OpenFreeMap Liberty",
    provider: "openfreemap",
    type: "style",
    category: "Vector",
    description: "Open vector style loaded as a full MapLibre style.",
    attribution: OPENFREEMAP_ATTRIBUTION,
    source: {
      type: "style",
      url: "https://tiles.openfreemap.org/styles/liberty",
    },
    tags: ["openfreemap", "vector", "style"],
  },
  {
    id: "openfreemap-dark",
    name: "OpenFreeMap Dark",
    provider: "openfreemap",
    type: "style",
    category: "Dark",
    description: "Dark OpenFreeMap vector style.",
    attribution: OPENFREEMAP_ATTRIBUTION,
    source: {
      type: "style",
      url: "https://tiles.openfreemap.org/styles/dark",
    },
    tags: ["openfreemap", "vector", "style", "dark"],
  },
  {
    id: "openfreemap-fiord",
    name: "OpenFreeMap Fiord",
    provider: "openfreemap",
    type: "style",
    category: "Dark",
    description: "Blue-toned dark OpenFreeMap vector style.",
    attribution: OPENFREEMAP_ATTRIBUTION,
    source: {
      type: "style",
      url: "https://tiles.openfreemap.org/styles/fiord",
    },
    tags: ["openfreemap", "vector", "style", "fiord", "dark"],
  },
  {
    id: "openfreemap-3d",
    name: "OpenFreeMap 3D",
    provider: "openfreemap",
    type: "style",
    category: "3D",
    description: "OpenFreeMap Liberty style with a pitched 3D camera view.",
    attribution: OPENFREEMAP_ATTRIBUTION,
    source: {
      type: "style",
      url: "https://tiles.openfreemap.org/styles/liberty",
    },
    view: {
      center: [-0.114, 51.506],
      zoom: 14.2,
      bearing: 55.2,
      pitch: 60,
    },
    tags: ["openfreemap", "vector", "style", "3d", "liberty"],
  },
  protomapsStyleBasemap({
    id: "protomaps-light",
    name: "Protomaps Light",
    styleId: "light",
    category: "Light",
    description: "Light Protomaps vector basemap.",
    tags: ["light"],
  }),
  protomapsStyleBasemap({
    id: "protomaps-dark",
    name: "Protomaps Dark",
    styleId: "dark",
    category: "Dark",
    description: "Dark Protomaps vector basemap.",
    tags: ["dark"],
  }),
  protomapsStyleBasemap({
    id: "protomaps-white",
    name: "Protomaps White",
    styleId: "white",
    category: "Light",
    description: "Minimal white Protomaps basemap for data overlays.",
    tags: ["white", "minimal", "dataviz"],
  }),
  protomapsStyleBasemap({
    id: "protomaps-black",
    name: "Protomaps Black",
    styleId: "black",
    category: "Dark",
    description: "Minimal black Protomaps basemap for data overlays.",
    tags: ["black", "minimal", "dataviz"],
  }),
  protomapsStyleBasemap({
    id: "protomaps-grayscale",
    name: "Protomaps Grayscale",
    styleId: "grayscale",
    category: "Light",
    description: "Monochrome Protomaps basemap for data overlays.",
    tags: ["grayscale", "monochrome", "dataviz"],
  }),
  protomapsStyleBasemap({
    id: "protomaps-contrast",
    name: "Protomaps Contrast",
    styleId: "contrast",
    category: "Light",
    description: "High-contrast Protomaps basemap.",
    tags: ["contrast", "accessibility"],
  }),
  mapToolkitStyleBasemap({
    id: "maptoolkit-summer",
    name: "Maptoolkit Summer",
    styleId: "summer",
    category: "Outdoor",
    description:
      "Maptoolkit outdoor summer style with hillshading and terrain detail.",
    tags: ["summer", "outdoor", "terrain", "hillshade"],
  }),
  mapToolkitStyleBasemap({
    id: "maptoolkit-light",
    name: "Maptoolkit Light",
    styleId: "light",
    category: "Light",
    description: "Light Maptoolkit style for data overlays.",
    tags: ["light", "dataviz"],
  }),
  mapToolkitStyleBasemap({
    id: "maptoolkit-hiking",
    name: "Maptoolkit Hiking",
    styleId: "hiking",
    category: "Outdoor",
    description:
      "Maptoolkit hiking style with trails, rock drawing, and terrain.",
    tags: ["hiking", "outdoor", "trails", "terrain"],
  }),
  mapToolkitStyleBasemap({
    id: "maptoolkit-cycling",
    name: "Maptoolkit Cycling",
    styleId: "cycling",
    category: "Cycling",
    description: "Maptoolkit cycling style with bike routes and terrain.",
    tags: ["cycling", "outdoor", "routes"],
  }),
  mapToolkitStyleBasemap({
    id: "maptoolkit-winter",
    name: "Maptoolkit Winter",
    styleId: "winter",
    category: "Outdoor",
    description:
      "Maptoolkit winter sports style with slopes and mountain terrain.",
    tags: ["winter", "skiing", "slopes", "outdoor"],
  }),
  mapToolkitStyleBasemap({
    id: "maptoolkit-dark",
    name: "Maptoolkit Dark",
    styleId: "dark",
    category: "Dark",
    description: "Dark Maptoolkit style for high-contrast overlays.",
    tags: ["dark"],
  }),
  mapToolkitStyleBasemap({
    id: "maptoolkit-street",
    name: "Maptoolkit Street",
    styleId: "street",
    category: "Street",
    description: "Maptoolkit general-purpose street style.",
    tags: ["street", "streets", "navigation"],
  }),
  rasterTrafficBasemap({
    id: "tomtom-traffic-flow-relative",
    name: "TomTom Traffic Flow",
    provider: "tomtom",
    description:
      "TomTom traffic speeds relative to free-flow speed. Requires a TomTom API key.",
    attribution: TOMTOM_ATTRIBUTION,
    tiles: [
      "https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key={api-key}",
    ],
    tags: ["tomtom", "flow", "relative"],
  }),
  rasterTrafficBasemap({
    id: "tomtom-traffic-flow-absolute",
    name: "TomTom Traffic Flow Absolute",
    provider: "tomtom",
    description:
      "TomTom traffic colored by absolute speed. Requires a TomTom API key.",
    attribution: TOMTOM_ATTRIBUTION,
    tiles: [
      "https://api.tomtom.com/traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.png?key={api-key}",
    ],
    tags: ["tomtom", "flow", "absolute"],
  }),
  rasterTrafficBasemap({
    id: "tomtom-traffic-flow-relative-delay",
    name: "TomTom Traffic Flow Delay",
    provider: "tomtom",
    description:
      "TomTom traffic highlighting only roads delayed below free-flow speed. Requires a TomTom API key.",
    attribution: TOMTOM_ATTRIBUTION,
    tiles: [
      "https://api.tomtom.com/traffic/map/4/tile/flow/relative-delay/{z}/{x}/{y}.png?key={api-key}",
    ],
    tags: ["tomtom", "flow", "delay"],
  }),
  rasterTrafficBasemap({
    id: "here-traffic-flow",
    name: "HERE Traffic Flow",
    provider: "here",
    description:
      "HERE real-time traffic flow overlay. Requires a HERE API key.",
    attribution: HERE_ATTRIBUTION,
    tiles: [
      "https://traffic.maps.hereapi.com/v3/flow/mc/{z}/{x}/{y}/png?apiKey={api-key}",
    ],
    tags: ["here", "flow"],
  }),
  {
    id: "mapbox-traffic",
    name: "Mapbox Traffic",
    provider: "mapbox",
    type: "vector-overlay",
    category: "Traffic",
    description:
      "Mapbox real-time traffic congestion overlay. Requires a Mapbox access token.",
    attribution: MAPBOX_ATTRIBUTION,
    source: {
      type: "vector-overlay",
      url: "mapbox://mapbox.mapbox-traffic-v1",
      sourceLayer: "traffic",
      layerType: "line",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6,
          1.5,
          14,
          4,
          18,
          8,
        ],
        "line-color": MAPBOX_TRAFFIC_CONGESTION_COLORS,
      },
    },
    tags: ["mapbox", "traffic", "overlay", "congestion"],
  },
  {
    id: "google-traffic",
    name: "Google Traffic",
    provider: "google",
    type: "raster",
    category: "Traffic",
    description:
      "Google real-time traffic overlay via the Map Tiles API. Requires a Google Maps API key.",
    attribution: GOOGLE_ATTRIBUTION,
    source: {
      type: "raster",
      tiles: [
        "https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session={session}&key={api-key}",
      ],
      tileSize: 256,
      maxzoom: 22,
      googleSession: {
        mapType: "roadmap",
        layerTypes: ["layerTraffic"],
        overlay: true,
      },
    },
    tags: ["google", "traffic", "overlay"],
  },
];

export function combineProviders(
  defaults: BasemapProvider[],
  custom: BasemapProvider[] = [],
): BasemapProvider[] {
  const byId = new Map<string, BasemapProvider>();
  defaults.forEach((provider) => byId.set(provider.id, provider));
  custom.forEach((provider) => byId.set(provider.id, provider));
  return sortProviders([...byId.values()]);
}

export function resolveBasemapProviders(
  basemaps: BasemapDefinition[],
  customProviders: BasemapProvider[] = [],
  includeDefaultProviders = true,
): BasemapProvider[] {
  const byId = new Map<string, BasemapProvider>();
  if (includeDefaultProviders) {
    DEFAULT_BASEMAP_PROVIDERS.forEach((provider) =>
      byId.set(provider.id, provider),
    );
  }
  customProviders.forEach((provider) => byId.set(provider.id, provider));
  // Derive any provider referenced by the catalog but not yet listed so the
  // filter never omits a custom provider or shows defaults with no results.
  basemaps.forEach((basemap) => {
    if (basemap.provider && !byId.has(basemap.provider)) {
      byId.set(basemap.provider, {
        id: basemap.provider,
        name: basemap.provider,
      });
    }
  });
  return sortProviders([...byId.values()]);
}

export function createBasemapCatalog(
  customBasemaps: BasemapDefinition[] = [],
  includeDefaultBasemaps = true,
): BasemapDefinition[] {
  const basemaps = includeDefaultBasemaps
    ? [...DEFAULT_BASEMAPS, ...customBasemaps]
    : [...customBasemaps];
  const byId = new Map<string, BasemapDefinition>();
  basemaps.forEach((basemap) => byId.set(basemap.id, basemap));
  return [...byId.values()];
}

export interface BasemapFilter {
  query?: string;
  provider?: string;
  category?: string;
}

export function filterBasemaps(
  basemaps: BasemapDefinition[],
  filter: BasemapFilter,
): BasemapDefinition[] {
  const query = filter.query?.trim().toLowerCase() ?? "";

  return basemaps.filter((basemap) => {
    if (filter.provider && basemap.provider !== filter.provider) return false;
    if (filter.category && basemap.category !== filter.category) return false;
    if (!query) return true;

    const haystack = [
      basemap.name,
      basemap.provider,
      basemap.category,
      basemap.description,
      ...(basemap.tags ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function getBasemapCategories(basemaps: BasemapDefinition[]): string[] {
  return [
    ...new Set(
      basemaps.map((basemap) => basemap.category).filter(Boolean) as string[],
    ),
  ].sort();
}
