import type { BasemapDefinition, BasemapProvider } from './types';

export const DEFAULT_BASEMAP_PROVIDERS: BasemapProvider[] = [
  { id: 'openstreetmap', name: 'OpenStreetMap', category: 'Community' },
  { id: 'carto', name: 'Carto', category: 'General' },
  { id: 'esri', name: 'ESRI', category: 'Imagery' },
  { id: 'opentopomap', name: 'OpenTopoMap', category: 'Terrain' },
  { id: 'openfreemap', name: 'OpenFreeMap', category: 'Vector Styles' },
];

export const DEFAULT_BASEMAPS: BasemapDefinition[] = [
  {
    id: 'osm-standard',
    name: 'OpenStreetMap Standard',
    provider: 'openstreetmap',
    type: 'raster',
    category: 'Street',
    description: 'Community-maintained street map.',
    attribution: '&copy; OpenStreetMap contributors',
    source: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
    },
    tags: ['osm', 'street', 'standard'],
  },
  {
    id: 'carto-positron',
    name: 'Carto Positron',
    provider: 'carto',
    type: 'raster',
    category: 'Light',
    description: 'Light basemap for data overlays.',
    attribution:
      '&copy; OpenStreetMap contributors &copy; CARTO',
    source: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      maxzoom: 20,
    },
    tags: ['carto', 'light', 'positron'],
  },
  {
    id: 'carto-dark-matter',
    name: 'Carto Dark Matter',
    provider: 'carto',
    type: 'raster',
    category: 'Dark',
    description: 'Dark basemap for high-contrast overlays.',
    attribution:
      '&copy; OpenStreetMap contributors &copy; CARTO',
    source: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      maxzoom: 20,
    },
    tags: ['carto', 'dark', 'matter'],
  },
  {
    id: 'carto-voyager',
    name: 'Carto Voyager',
    provider: 'carto',
    type: 'raster',
    category: 'Street',
    description: 'Detailed street basemap with subtle styling.',
    attribution:
      '&copy; OpenStreetMap contributors &copy; CARTO',
    source: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      maxzoom: 20,
    },
    tags: ['carto', 'street', 'voyager'],
  },
  {
    id: 'esri-world-imagery',
    name: 'World Imagery',
    provider: 'esri',
    type: 'raster',
    category: 'Imagery',
    description: 'Satellite and aerial imagery.',
    attribution:
      'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    source: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
    },
    tags: ['esri', 'satellite', 'imagery'],
  },
  {
    id: 'esri-world-topo',
    name: 'World Topographic',
    provider: 'esri',
    type: 'raster',
    category: 'Terrain',
    description: 'Reference topographic map.',
    attribution:
      'Tiles &copy; Esri and the GIS User Community',
    source: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
    },
    tags: ['esri', 'topographic', 'terrain'],
  },
  {
    id: 'opentopomap',
    name: 'OpenTopoMap',
    provider: 'opentopomap',
    type: 'raster',
    category: 'Terrain',
    description: 'Topographic map with relief and contour styling.',
    attribution:
      'Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap',
    source: {
      type: 'raster',
      tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 17,
    },
    tags: ['terrain', 'topo', 'relief'],
  },
  {
    id: 'openfreemap-liberty',
    name: 'OpenFreeMap Liberty',
    provider: 'openfreemap',
    type: 'style',
    category: 'Vector',
    description: 'Open vector style loaded as a full MapLibre style.',
    attribution: '&copy; OpenMapTiles &copy; OpenStreetMap contributors',
    source: {
      type: 'style',
      url: 'https://tiles.openfreemap.org/styles/liberty',
    },
    tags: ['openfreemap', 'vector', 'style'],
  },
];

export function combineProviders(
  defaults: BasemapProvider[],
  custom: BasemapProvider[] = [],
): BasemapProvider[] {
  const byId = new Map<string, BasemapProvider>();
  defaults.forEach((provider) => byId.set(provider.id, provider));
  custom.forEach((provider) => byId.set(provider.id, provider));
  return [...byId.values()];
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
  return [...byId.values()];
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
