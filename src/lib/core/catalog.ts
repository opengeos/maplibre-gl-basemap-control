import type { BasemapDefinition, BasemapProvider } from './types';

export const DEFAULT_BASEMAP_PROVIDERS: BasemapProvider[] = [
  { id: 'amazon', name: 'Amazon Location', category: 'General' },
  { id: 'carto', name: 'Carto', category: 'General' },
  { id: 'cyclosm', name: 'CyclOSM', category: 'Cycling' },
  { id: 'esri', name: 'ESRI', category: 'Imagery' },
  { id: 'google', name: 'Google', category: 'General' },
  { id: 'maptiler', name: 'MapTiler', category: 'General' },
  { id: 'nasa-gibs', name: 'NASA GIBS', category: 'Imagery' },
  { id: 'nlmaps', name: 'nlmaps', category: 'Regional' },
  { id: 'openfreemap', name: 'OpenFreeMap', category: 'Vector Styles' },
  { id: 'openrailwaymap', name: 'OpenRailwayMap', category: 'Transport' },
  { id: 'openstreetmap', name: 'OpenStreetMap', category: 'Community' },
  { id: 'opentopomap', name: 'OpenTopoMap', category: 'Terrain' },
  { id: 'swisstopo', name: 'Swiss Federal Geoportal', category: 'Regional' },
  { id: 'topplusopen', name: 'TopPlusOpen', category: 'Regional' },
  { id: 'usgs', name: 'USGS', category: 'United States' },
  { id: 'waymarkedtrails', name: 'Waymarked Trails', category: 'Outdoor' },
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
  tags = [],
}: Omit<BasemapDefinition, 'type' | 'source'> & {
  tiles: string[];
  maxzoom?: number;
}): BasemapDefinition {
  return {
    id,
    name,
    provider,
    type: 'raster',
    category,
    description,
    attribution,
    source: {
      type: 'raster',
      tiles,
      tileSize: 256,
      maxzoom,
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
}: Omit<BasemapDefinition, 'type' | 'source'> & {
  url: string;
}): BasemapDefinition {
  return {
    id,
    name,
    provider,
    type: 'style',
    category,
    description,
    attribution,
    source: {
      type: 'style',
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
    provider: 'maptiler',
    category,
    description,
    attribution: MAPTILER_ATTRIBUTION,
    url: url ?? `https://api.maptiler.com/maps/${mapId}/style.json?key={api-key}`,
    tags: ['maptiler', 'vector', 'style', ...tags],
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
    provider: 'amazon',
    category,
    description,
    attribution: AMAZON_ATTRIBUTION,
    url: `https://maps.geo.{aws-region}.amazonaws.com/v2/styles/${mapStyle}/descriptor?key={api-key}`,
    tags: ['amazon', 'aws', 'location', 'style', ...tags],
  });
}

function sortProviders(providers: BasemapProvider[]): BasemapProvider[] {
  return [...providers].sort((a, b) => a.name.localeCompare(b.name));
}

const AMAZON_ATTRIBUTION = '&copy; Amazon Location Service';
const CARTO_ATTRIBUTION = '&copy; OpenStreetMap contributors &copy; CARTO';
const ESRI_ATTRIBUTION = 'Tiles &copy; Esri and the GIS User Community';
const MAPTILER_ATTRIBUTION = '&copy; MapTiler &copy; OpenStreetMap contributors';
const OSM_ATTRIBUTION = '&copy; OpenStreetMap contributors';
const OPENFREEMAP_ATTRIBUTION = 'OpenFreeMap &copy; OpenMapTiles Data from OpenStreetMap';

export const DEFAULT_BASEMAPS: BasemapDefinition[] = [
  rasterBasemap({
    id: 'osm-standard',
    name: 'OpenStreetMap Standard',
    provider: 'openstreetmap',
    category: 'Street',
    description: 'Community-maintained street map.',
    attribution: OSM_ATTRIBUTION,
    tiles: [
      'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ],
    tags: ['osm', 'street', 'standard'],
  }),
  rasterBasemap({
    id: 'osm-hot',
    name: 'OpenStreetMap HOT',
    provider: 'openstreetmap',
    category: 'Street',
    description: 'Humanitarian OpenStreetMap Team style.',
    attribution: `${OSM_ATTRIBUTION}, Tiles style by Humanitarian OpenStreetMap Team`,
    tiles: ['https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'],
    tags: ['osm', 'hot', 'humanitarian'],
  }),
  rasterBasemap({
    id: 'osm-de',
    name: 'OpenStreetMap DE',
    provider: 'openstreetmap',
    category: 'Regional',
    description: 'German OpenStreetMap tile style.',
    attribution: OSM_ATTRIBUTION,
    tiles: ['https://tile.openstreetmap.de/{z}/{x}/{y}.png'],
    tags: ['osm', 'germany', 'regional'],
  }),
  rasterBasemap({
    id: 'osm-ch',
    name: 'OpenStreetMap CH',
    provider: 'openstreetmap',
    category: 'Regional',
    description: 'Swiss OpenStreetMap tile style.',
    attribution: OSM_ATTRIBUTION,
    tiles: ['https://tile.osm.ch/switzerland/{z}/{x}/{y}.png'],
    tags: ['osm', 'switzerland', 'regional'],
  }),
  rasterBasemap({
    id: 'google-maps',
    name: 'Google Maps',
    provider: 'google',
    category: 'Street',
    description: 'Google road map tiles from the QGIS basemaps source.',
    attribution: '&copy; Google',
    tiles: ['https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'],
    maxzoom: 20,
    tags: ['google', 'street'],
  }),
  rasterBasemap({
    id: 'google-satellite',
    name: 'Google Satellite',
    provider: 'google',
    category: 'Imagery',
    description: 'Google satellite tiles from the QGIS basemaps source.',
    attribution: '&copy; Google',
    tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
    maxzoom: 20,
    tags: ['google', 'satellite', 'imagery'],
  }),
  rasterBasemap({
    id: 'google-terrain',
    name: 'Google Terrain',
    provider: 'google',
    category: 'Terrain',
    description: 'Google terrain tiles from the QGIS basemaps source.',
    attribution: '&copy; Google',
    tiles: ['https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'],
    maxzoom: 20,
    tags: ['google', 'terrain'],
  }),
  rasterBasemap({
    id: 'google-hybrid',
    name: 'Google Hybrid',
    provider: 'google',
    category: 'Imagery',
    description: 'Google hybrid imagery tiles from the QGIS basemaps source.',
    attribution: '&copy; Google',
    tiles: ['https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'],
    maxzoom: 20,
    tags: ['google', 'hybrid', 'imagery'],
  }),
  amazonStyleBasemap({
    id: 'amazon-standard',
    name: 'Amazon Standard',
    mapStyle: 'Standard',
    category: 'Street',
    description: 'Amazon Location general-purpose vector map style.',
    tags: ['standard', 'street'],
  }),
  amazonStyleBasemap({
    id: 'amazon-monochrome',
    name: 'Amazon Monochrome',
    mapStyle: 'Monochrome',
    category: 'Light',
    description: 'Amazon Location grey scale map style for overlays.',
    tags: ['monochrome', 'light', 'dataviz'],
  }),
  amazonStyleBasemap({
    id: 'amazon-hybrid',
    name: 'Amazon Hybrid',
    mapStyle: 'Hybrid',
    category: 'Imagery',
    description: 'Amazon Location satellite imagery with road and label overlay.',
    tags: ['hybrid', 'satellite', 'imagery', 'labels'],
  }),
  amazonStyleBasemap({
    id: 'amazon-satellite',
    name: 'Amazon Satellite',
    mapStyle: 'Satellite',
    category: 'Imagery',
    description: 'Amazon Location satellite imagery map style.',
    tags: ['satellite', 'imagery'],
  }),
  mapTilerStyleBasemap({
    id: 'maptiler-aquarelle',
    name: 'MapTiler Aquarelle',
    mapId: 'aquarelle-v4',
    category: 'Artistic',
    description: 'Watercolor-style vector basemap.',
    tags: ['aquarelle', 'watercolor', 'artistic'],
  }),
  mapTilerStyleBasemap({
    id: 'maptiler-backdrop',
    name: 'MapTiler Backdrop',
    mapId: 'backdrop-v4',
    category: 'Light',
    description: 'Subtle monochrome context map.',
    tags: ['backdrop', 'monochrome', 'context'],
  }),
  mapTilerStyleBasemap({
    id: 'maptiler-base',
    name: 'MapTiler Base',
    mapId: 'base-v4',
    category: 'Street',
    description: 'General-purpose vector basemap.',
    tags: ['base', 'street'],
  }),
  mapTilerStyleBasemap({
    id: 'maptiler-dataviz',
    name: 'MapTiler Dataviz',
    mapId: 'dataviz-v4',
    category: 'Light',
    description: 'Minimal basemap for data visualization and overlays.',
    tags: ['dataviz', 'data', 'light'],
  }),
  mapTilerStyleBasemap({
    id: 'maptiler-landscape',
    name: 'MapTiler Landscape',
    mapId: 'landscape-v4',
    category: 'Terrain',
    description: 'Light terrain and hillshade map.',
    tags: ['landscape', 'terrain', 'hillshade'],
  }),
  mapTilerStyleBasemap({
    id: 'maptiler-ocean',
    name: 'MapTiler Ocean',
    mapId: 'ocean-v4',
    category: 'Marine',
    description: 'Ocean bathymetry and marine-focused basemap.',
    tags: ['ocean', 'marine', 'bathymetry'],
  }),
  mapTilerStyleBasemap({
    id: 'maptiler-openstreetmap',
    name: 'MapTiler OpenStreetMap',
    mapId: 'openstreetmap',
    category: 'Street',
    description: 'OpenStreetMap style hosted by MapTiler.',
    url: 'https://api.maptiler.com/maps/openstreetmap/style.json?key',
    tags: ['openstreetmap', 'osm', 'street'],
  }),
  mapTilerStyleBasemap({
    id: 'maptiler-outdoor',
    name: 'MapTiler Outdoor',
    mapId: 'outdoor-v4',
    category: 'Outdoor',
    description: 'Outdoor recreation basemap with terrain detail.',
    tags: ['outdoor', 'terrain', 'recreation'],
  }),
  mapTilerStyleBasemap({
    id: 'maptiler-satellite-hybrid',
    name: 'MapTiler Satellite Hybrid',
    mapId: 'hybrid-v4',
    category: 'Imagery',
    description: 'Satellite imagery with labels, roads, and borders.',
    tags: ['satellite', 'hybrid', 'imagery', 'labels'],
  }),
  mapTilerStyleBasemap({
    id: 'maptiler-satellite-plain',
    name: 'MapTiler Satellite Plain',
    mapId: 'satellite-v4',
    category: 'Imagery',
    description: 'Satellite imagery without the hybrid reference overlay.',
    tags: ['satellite', 'imagery'],
  }),
  mapTilerStyleBasemap({
    id: 'maptiler-streets',
    name: 'MapTiler Streets',
    mapId: 'streets-v4',
    category: 'Street',
    description: 'Detailed street map for general navigation.',
    tags: ['streets', 'street', 'navigation'],
  }),
  mapTilerStyleBasemap({
    id: 'maptiler-toner',
    name: 'MapTiler Toner',
    mapId: 'toner-v2',
    category: 'Dark',
    description: 'High-contrast monochrome basemap.',
    url: 'https://api.maptiler.com/maps/toner-v2/style.json?key=',
    tags: ['toner', 'monochrome', 'contrast'],
  }),
  mapTilerStyleBasemap({
    id: 'maptiler-topo',
    name: 'MapTiler Topo',
    mapId: 'topo-v4',
    category: 'Terrain',
    description: 'Topographic basemap with contours and terrain context.',
    tags: ['topo', 'topographic', 'terrain'],
  }),
  mapTilerStyleBasemap({
    id: 'maptiler-winter',
    name: 'MapTiler Winter',
    mapId: 'winter-v4',
    category: 'Outdoor',
    description: 'Winter sports and mountain activity basemap.',
    tags: ['winter', 'skiing', 'outdoor'],
  }),
  rasterBasemap({
    id: 'carto-positron',
    name: 'Carto Positron',
    provider: 'carto',
    category: 'Light',
    description: 'Light basemap for data overlays.',
    attribution: CARTO_ATTRIBUTION,
    tiles: [
      'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    ],
    maxzoom: 20,
    tags: ['carto', 'light', 'positron'],
  }),
  rasterBasemap({
    id: 'carto-positron-no-labels',
    name: 'Carto Positron No Labels',
    provider: 'carto',
    category: 'Light',
    description: 'Light basemap without labels.',
    attribution: CARTO_ATTRIBUTION,
    tiles: ['https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png'],
    maxzoom: 20,
    tags: ['carto', 'light', 'no labels'],
  }),
  rasterBasemap({
    id: 'carto-positron-only-labels',
    name: 'Carto Positron Only Labels',
    provider: 'carto',
    category: 'Labels',
    description: 'Carto Positron labels layer.',
    attribution: CARTO_ATTRIBUTION,
    tiles: ['https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png'],
    maxzoom: 20,
    tags: ['carto', 'labels'],
  }),
  rasterBasemap({
    id: 'carto-dark-matter',
    name: 'Carto Dark Matter',
    provider: 'carto',
    category: 'Dark',
    description: 'Dark basemap for high-contrast overlays.',
    attribution: CARTO_ATTRIBUTION,
    tiles: [
      'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    ],
    maxzoom: 20,
    tags: ['carto', 'dark', 'matter'],
  }),
  rasterBasemap({
    id: 'carto-dark-matter-no-labels',
    name: 'Carto Dark Matter No Labels',
    provider: 'carto',
    category: 'Dark',
    description: 'Dark basemap without labels.',
    attribution: CARTO_ATTRIBUTION,
    tiles: ['https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png'],
    maxzoom: 20,
    tags: ['carto', 'dark', 'no labels'],
  }),
  rasterBasemap({
    id: 'carto-dark-matter-only-labels',
    name: 'Carto Dark Matter Only Labels',
    provider: 'carto',
    category: 'Labels',
    description: 'Carto Dark Matter labels layer.',
    attribution: CARTO_ATTRIBUTION,
    tiles: ['https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png'],
    maxzoom: 20,
    tags: ['carto', 'dark', 'labels'],
  }),
  rasterBasemap({
    id: 'carto-voyager',
    name: 'Carto Voyager',
    provider: 'carto',
    category: 'Street',
    description: 'Detailed street basemap with subtle styling.',
    attribution: CARTO_ATTRIBUTION,
    tiles: [
      'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    ],
    maxzoom: 20,
    tags: ['carto', 'street', 'voyager'],
  }),
  rasterBasemap({
    id: 'carto-voyager-no-labels',
    name: 'Carto Voyager No Labels',
    provider: 'carto',
    category: 'Street',
    description: 'Carto Voyager without labels.',
    attribution: CARTO_ATTRIBUTION,
    tiles: ['https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png'],
    maxzoom: 20,
    tags: ['carto', 'voyager', 'no labels'],
  }),
  rasterBasemap({
    id: 'carto-voyager-only-labels',
    name: 'Carto Voyager Only Labels',
    provider: 'carto',
    category: 'Labels',
    description: 'Carto Voyager labels layer.',
    attribution: CARTO_ATTRIBUTION,
    tiles: ['https://a.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png'],
    maxzoom: 20,
    tags: ['carto', 'voyager', 'labels'],
  }),
  rasterBasemap({
    id: 'carto-voyager-labels-under',
    name: 'Carto Voyager Labels Under',
    provider: 'carto',
    category: 'Street',
    description: 'Carto Voyager labels-under variant.',
    attribution: CARTO_ATTRIBUTION,
    tiles: ['https://a.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}.png'],
    maxzoom: 20,
    tags: ['carto', 'voyager', 'labels'],
  }),
  rasterBasemap({
    id: 'cyclosm',
    name: 'CyclOSM',
    provider: 'cyclosm',
    category: 'Cycling',
    description: 'Cycling-focused OpenStreetMap style.',
    attribution: 'CyclOSM | Map data: &copy; OpenStreetMap contributors',
    tiles: ['https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png'],
    tags: ['cycling', 'osm'],
  }),
  rasterBasemap({
    id: 'esri-world-imagery',
    name: 'World Imagery',
    provider: 'esri',
    category: 'Imagery',
    description: 'Satellite and aerial imagery.',
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ],
    tags: ['esri', 'satellite', 'imagery'],
  }),
  rasterBasemap({
    id: 'esri-world-topo',
    name: 'World Topographic',
    provider: 'esri',
    category: 'Terrain',
    description: 'Reference topographic map.',
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    ],
    tags: ['esri', 'topographic', 'terrain'],
  }),
  rasterBasemap({
    id: 'esri-world-street-map',
    name: 'World Street Map',
    provider: 'esri',
    category: 'Street',
    description: 'ESRI street reference basemap.',
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    ],
    tags: ['esri', 'street'],
  }),
  rasterBasemap({
    id: 'esri-world-gray-canvas',
    name: 'World Gray Canvas',
    provider: 'esri',
    category: 'Light',
    description: 'Light gray canvas basemap.',
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    ],
    tags: ['esri', 'gray', 'canvas'],
  }),
  rasterBasemap({
    id: 'esri-natgeo-world-map',
    name: 'NatGeo World Map',
    provider: 'esri',
    category: 'Street',
    description: 'National Geographic style world map.',
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
    ],
    tags: ['esri', 'natgeo'],
  }),
  rasterBasemap({
    id: 'esri-ocean-basemap',
    name: 'Ocean Basemap',
    provider: 'esri',
    category: 'Marine',
    description: 'Ocean reference basemap.',
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    ],
    tags: ['esri', 'ocean', 'marine'],
  }),
  rasterBasemap({
    id: 'esri-world-physical',
    name: 'World Physical',
    provider: 'esri',
    category: 'Terrain',
    description: 'Physical world map.',
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
    ],
    tags: ['esri', 'physical', 'terrain'],
  }),
  rasterBasemap({
    id: 'esri-world-shaded-relief',
    name: 'World Shaded Relief',
    provider: 'esri',
    category: 'Terrain',
    description: 'Shaded relief world map.',
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
    ],
    tags: ['esri', 'relief', 'terrain'],
  }),
  rasterBasemap({
    id: 'esri-world-terrain',
    name: 'World Terrain',
    provider: 'esri',
    category: 'Terrain',
    description: 'ESRI terrain base.',
    attribution: ESRI_ATTRIBUTION,
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}',
    ],
    tags: ['esri', 'terrain'],
  }),
  rasterBasemap({
    id: 'nasa-gibs-blue-marble',
    name: 'Blue Marble',
    provider: 'nasa-gibs',
    category: 'Imagery',
    description: 'NASA Blue Marble Next Generation imagery.',
    attribution: 'Imagery provided by NASA Global Imagery Browse Services',
    tiles: [
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
    ],
    maxzoom: 8,
    tags: ['nasa', 'gibs', 'blue marble'],
  }),
  rasterBasemap({
    id: 'nasa-gibs-aster-gdem-shaded-relief',
    name: 'ASTER GDEM Shaded Relief',
    provider: 'nasa-gibs',
    category: 'Terrain',
    description: 'NASA ASTER GDEM greyscale shaded relief.',
    attribution: 'Imagery provided by NASA Global Imagery Browse Services',
    tiles: [
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/ASTER_GDEM_Greyscale_Shaded_Relief/default/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg',
    ],
    maxzoom: 12,
    tags: ['nasa', 'gibs', 'relief', 'terrain'],
  }),
  rasterBasemap({
    id: 'nasa-gibs-modis-terra-true-color',
    name: 'MODIS Terra True Color',
    provider: 'nasa-gibs',
    category: 'Imagery',
    description: 'NASA MODIS Terra corrected reflectance true color.',
    attribution: 'Imagery provided by NASA Global Imagery Browse Services',
    tiles: [
      'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/MODIS_Terra_CorrectedReflectance_TrueColor/default//GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    ],
    maxzoom: 9,
    tags: ['nasa', 'gibs', 'modis', 'true color'],
  }),
  rasterBasemap({
    id: 'nasa-gibs-viirs-earth-at-night',
    name: 'VIIRS Earth At Night 2012',
    provider: 'nasa-gibs',
    category: 'Imagery',
    description: 'NASA VIIRS city lights imagery.',
    attribution: 'Imagery provided by NASA Global Imagery Browse Services',
    tiles: [
      'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default//GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
    ],
    maxzoom: 8,
    tags: ['nasa', 'gibs', 'night', 'viirs'],
  }),
  rasterBasemap({
    id: 'openrailwaymap',
    name: 'OpenRailwayMap',
    provider: 'openrailwaymap',
    category: 'Transport',
    description: 'Railway infrastructure map.',
    attribution: 'Map data: &copy; OpenStreetMap contributors | Map style: OpenRailwayMap',
    tiles: ['https://a.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png'],
    tags: ['rail', 'transport', 'osm'],
  }),
  rasterBasemap({
    id: 'opentopomap',
    name: 'OpenTopoMap',
    provider: 'opentopomap',
    category: 'Terrain',
    description: 'Topographic map with relief and contour styling.',
    attribution: 'Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap',
    tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
    maxzoom: 17,
    tags: ['terrain', 'topo', 'relief'],
  }),
  rasterBasemap({
    id: 'swisstopo-national-map-color',
    name: 'Swiss National Map Color',
    provider: 'swisstopo',
    category: 'Regional',
    description: 'Swiss federal color national map.',
    attribution: '&copy; swisstopo',
    tiles: [
      'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    ],
    maxzoom: 18,
    tags: ['switzerland', 'regional'],
  }),
  rasterBasemap({
    id: 'swisstopo-national-map-grey',
    name: 'Swiss National Map Grey',
    provider: 'swisstopo',
    category: 'Regional',
    description: 'Swiss federal grey national map.',
    attribution: '&copy; swisstopo',
    tiles: [
      'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg',
    ],
    maxzoom: 18,
    tags: ['switzerland', 'regional', 'grey'],
  }),
  rasterBasemap({
    id: 'swisstopo-swissimage',
    name: 'SWISSIMAGE',
    provider: 'swisstopo',
    category: 'Imagery',
    description: 'Swiss federal aerial imagery.',
    attribution: '&copy; swisstopo',
    tiles: [
      'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg',
    ],
    maxzoom: 18,
    tags: ['switzerland', 'imagery'],
  }),
  rasterBasemap({
    id: 'topplusopen-color',
    name: 'TopPlusOpen Color',
    provider: 'topplusopen',
    category: 'Regional',
    description: 'German TopPlusOpen color basemap.',
    attribution: 'Map data: &copy; dl-de/by-2-0',
    tiles: [
      'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png',
    ],
    maxzoom: 18,
    tags: ['germany', 'regional'],
  }),
  rasterBasemap({
    id: 'topplusopen-grey',
    name: 'TopPlusOpen Grey',
    provider: 'topplusopen',
    category: 'Regional',
    description: 'German TopPlusOpen grey basemap.',
    attribution: 'Map data: &copy; dl-de/by-2-0',
    tiles: [
      'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web_grau/default/WEBMERCATOR/{z}/{y}/{x}.png',
    ],
    maxzoom: 18,
    tags: ['germany', 'regional', 'grey'],
  }),
  rasterBasemap({
    id: 'usgs-us-imagery',
    name: 'USGS US Imagery',
    provider: 'usgs',
    category: 'Imagery',
    description: 'USGS imagery-only basemap.',
    attribution: 'Tiles courtesy of the U.S. Geological Survey',
    tiles: [
      'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
    ],
    tags: ['usgs', 'imagery', 'united states'],
  }),
  rasterBasemap({
    id: 'usgs-us-imagery-topo',
    name: 'USGS US Imagery Topo',
    provider: 'usgs',
    category: 'Imagery',
    description: 'USGS imagery with topographic reference.',
    attribution: 'Tiles courtesy of the U.S. Geological Survey',
    tiles: [
      'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}',
    ],
    tags: ['usgs', 'imagery', 'topo', 'united states'],
  }),
  rasterBasemap({
    id: 'usgs-us-topo',
    name: 'USGS US Topo',
    provider: 'usgs',
    category: 'Terrain',
    description: 'USGS topographic basemap.',
    attribution: 'Tiles courtesy of the U.S. Geological Survey',
    tiles: [
      'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
    ],
    tags: ['usgs', 'topo', 'united states'],
  }),
  rasterBasemap({
    id: 'waymarkedtrails-hiking',
    name: 'Waymarked Trails Hiking',
    provider: 'waymarkedtrails',
    category: 'Outdoor',
    description: 'Hiking routes from Waymarked Trails.',
    attribution: 'Map data: &copy; OpenStreetMap contributors | Map style: Waymarked Trails',
    tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
    tags: ['hiking', 'outdoor', 'trails'],
  }),
  rasterBasemap({
    id: 'waymarkedtrails-cycling',
    name: 'Waymarked Trails Cycling',
    provider: 'waymarkedtrails',
    category: 'Cycling',
    description: 'Cycling routes from Waymarked Trails.',
    attribution: 'Map data: &copy; OpenStreetMap contributors | Map style: Waymarked Trails',
    tiles: ['https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png'],
    tags: ['cycling', 'outdoor', 'trails'],
  }),
  rasterBasemap({
    id: 'waymarkedtrails-mtb',
    name: 'Waymarked Trails MTB',
    provider: 'waymarkedtrails',
    category: 'Cycling',
    description: 'Mountain biking routes from Waymarked Trails.',
    attribution: 'Map data: &copy; OpenStreetMap contributors | Map style: Waymarked Trails',
    tiles: ['https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png'],
    tags: ['mtb', 'outdoor', 'trails'],
  }),
  rasterBasemap({
    id: 'waymarkedtrails-slopes',
    name: 'Waymarked Trails Slopes',
    provider: 'waymarkedtrails',
    category: 'Outdoor',
    description: 'Slope routes from Waymarked Trails.',
    attribution: 'Map data: &copy; OpenStreetMap contributors | Map style: Waymarked Trails',
    tiles: ['https://tile.waymarkedtrails.org/slopes/{z}/{x}/{y}.png'],
    tags: ['slopes', 'outdoor', 'trails'],
  }),
  rasterBasemap({
    id: 'nlmaps-standaard',
    name: 'nlmaps Standaard',
    provider: 'nlmaps',
    category: 'Regional',
    description: 'Netherlands standard background map.',
    attribution: 'Kaartgegevens &copy; Kadaster',
    tiles: [
      'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png',
    ],
    tags: ['netherlands', 'regional'],
  }),
  rasterBasemap({
    id: 'nlmaps-grijs',
    name: 'nlmaps Grijs',
    provider: 'nlmaps',
    category: 'Regional',
    description: 'Netherlands grey background map.',
    attribution: 'Kaartgegevens &copy; Kadaster',
    tiles: [
      'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png',
    ],
    tags: ['netherlands', 'regional', 'grey'],
  }),
  rasterBasemap({
    id: 'nlmaps-pastel',
    name: 'nlmaps Pastel',
    provider: 'nlmaps',
    category: 'Regional',
    description: 'Netherlands pastel background map.',
    attribution: 'Kaartgegevens &copy; Kadaster',
    tiles: [
      'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/pastel/EPSG:3857/{z}/{x}/{y}.png',
    ],
    tags: ['netherlands', 'regional', 'pastel'],
  }),
  rasterBasemap({
    id: 'nlmaps-water',
    name: 'nlmaps Water',
    provider: 'nlmaps',
    category: 'Regional',
    description: 'Netherlands water-focused background map.',
    attribution: 'Kaartgegevens &copy; Kadaster',
    tiles: [
      'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/water/EPSG:3857/{z}/{x}/{y}.png',
    ],
    tags: ['netherlands', 'regional', 'water'],
  }),
  rasterBasemap({
    id: 'nlmaps-luchtfoto',
    name: 'nlmaps Luchtfoto',
    provider: 'nlmaps',
    category: 'Imagery',
    description: 'Netherlands aerial photography.',
    attribution: 'Kaartgegevens &copy; Kadaster',
    tiles: [
      'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_ortho25/EPSG:3857/{z}/{x}/{y}.jpeg',
    ],
    tags: ['netherlands', 'imagery', 'aerial'],
  }),
  {
    id: 'openfreemap-positron',
    name: 'OpenFreeMap Positron',
    provider: 'openfreemap',
    type: 'style',
    category: 'Light',
    description: 'Light, minimal OpenFreeMap vector style for data overlays.',
    attribution: OPENFREEMAP_ATTRIBUTION,
    source: {
      type: 'style',
      url: 'https://tiles.openfreemap.org/styles/positron',
    },
    tags: ['openfreemap', 'vector', 'style', 'positron', 'light'],
  },
  {
    id: 'openfreemap-bright',
    name: 'OpenFreeMap Bright',
    provider: 'openfreemap',
    type: 'style',
    category: 'Street',
    description: 'Colorful OpenFreeMap vector street style.',
    attribution: OPENFREEMAP_ATTRIBUTION,
    source: {
      type: 'style',
      url: 'https://tiles.openfreemap.org/styles/bright',
    },
    tags: ['openfreemap', 'vector', 'style', 'bright', 'street'],
  },
  {
    id: 'openfreemap-liberty',
    name: 'OpenFreeMap Liberty',
    provider: 'openfreemap',
    type: 'style',
    category: 'Vector',
    description: 'Open vector style loaded as a full MapLibre style.',
    attribution: OPENFREEMAP_ATTRIBUTION,
    source: {
      type: 'style',
      url: 'https://tiles.openfreemap.org/styles/liberty',
    },
    tags: ['openfreemap', 'vector', 'style'],
  },
  {
    id: 'openfreemap-dark',
    name: 'OpenFreeMap Dark',
    provider: 'openfreemap',
    type: 'style',
    category: 'Dark',
    description: 'Dark OpenFreeMap vector style.',
    attribution: OPENFREEMAP_ATTRIBUTION,
    source: {
      type: 'style',
      url: 'https://tiles.openfreemap.org/styles/dark',
    },
    tags: ['openfreemap', 'vector', 'style', 'dark'],
  },
  {
    id: 'openfreemap-fiord',
    name: 'OpenFreeMap Fiord',
    provider: 'openfreemap',
    type: 'style',
    category: 'Dark',
    description: 'Blue-toned dark OpenFreeMap vector style.',
    attribution: OPENFREEMAP_ATTRIBUTION,
    source: {
      type: 'style',
      url: 'https://tiles.openfreemap.org/styles/fiord',
    },
    tags: ['openfreemap', 'vector', 'style', 'fiord', 'dark'],
  },
  {
    id: 'openfreemap-3d',
    name: 'OpenFreeMap 3D',
    provider: 'openfreemap',
    type: 'style',
    category: '3D',
    description: 'OpenFreeMap Liberty style with a pitched 3D camera view.',
    attribution: OPENFREEMAP_ATTRIBUTION,
    source: {
      type: 'style',
      url: 'https://tiles.openfreemap.org/styles/liberty',
    },
    view: {
      center: [-0.114, 51.506],
      zoom: 14.2,
      bearing: 55.2,
      pitch: 60,
    },
    tags: ['openfreemap', 'vector', 'style', '3d', 'liberty'],
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
    DEFAULT_BASEMAP_PROVIDERS.forEach((provider) => byId.set(provider.id, provider));
  }
  customProviders.forEach((provider) => byId.set(provider.id, provider));
  // Derive any provider referenced by the catalog but not yet listed so the
  // filter never omits a custom provider or shows defaults with no results.
  basemaps.forEach((basemap) => {
    if (basemap.provider && !byId.has(basemap.provider)) {
      byId.set(basemap.provider, { id: basemap.provider, name: basemap.provider });
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
  const query = filter.query?.trim().toLowerCase() ?? '';

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
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function getBasemapCategories(basemaps: BasemapDefinition[]): string[] {
  return [...new Set(basemaps.map((basemap) => basemap.category).filter(Boolean) as string[])].sort();
}
