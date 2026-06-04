import { describe, expect, it } from 'vitest';
import {
  combineProviders,
  createBasemapCatalog,
  DEFAULT_BASEMAPS,
  DEFAULT_BASEMAP_PROVIDERS,
  filterBasemaps,
  getBasemapCategories,
} from '../src/lib/core/catalog';

describe('basemap catalog', () => {
  it('includes default basemaps and custom basemaps', () => {
    const catalog = createBasemapCatalog([
      {
        id: 'custom',
        name: 'Custom',
        provider: 'custom',
        type: 'raster',
        source: {
          type: 'raster',
          tiles: ['https://example.com/{z}/{x}/{y}.png'],
        },
      },
    ]);

    expect(catalog.length).toBe(DEFAULT_BASEMAPS.length + 1);
    expect(catalog.some((basemap) => basemap.id === 'custom')).toBe(true);
  });

  it('can replace the default catalog', () => {
    const catalog = createBasemapCatalog(
      [
        {
          id: 'custom',
          name: 'Custom',
          provider: 'custom',
          type: 'raster',
          source: {
            type: 'raster',
            tiles: ['https://example.com/{z}/{x}/{y}.png'],
          },
        },
      ],
      false,
    );

    expect(catalog).toHaveLength(1);
    expect(catalog[0].id).toBe('custom');
  });

  it('filters by query, provider, and category', () => {
    const catalog = createBasemapCatalog();

    expect(filterBasemaps(catalog, { query: 'imagery' }).map((item) => item.id)).toContain(
      'esri-world-imagery',
    );
    expect(filterBasemaps(catalog, { provider: 'carto' }).length).toBeGreaterThan(3);
    expect(filterBasemaps(catalog, { category: 'Terrain' }).map((item) => item.id)).toContain(
      'opentopomap',
    );
  });

  it('includes additional XYZ basemaps from the qgis-basemaps catalog', () => {
    const catalog = createBasemapCatalog();
    const ids = catalog.map((basemap) => basemap.id);

    expect(ids).toContain('google-satellite');
    expect(ids).toContain('swisstopo-swissimage');
    expect(ids).toContain('nasa-gibs-blue-marble');
    expect(ids).toContain('usgs-us-topo');
    expect(ids).toContain('nlmaps-luchtfoto');
  });

  it('includes OpenFreeMap vector styles', () => {
    const catalog = createBasemapCatalog();
    const ids = catalog.map((basemap) => basemap.id);

    expect(ids).toContain('openfreemap-positron');
    expect(ids).toContain('openfreemap-bright');
    expect(ids).toContain('openfreemap-liberty');
    expect(ids).toContain('openfreemap-dark');
    expect(ids).toContain('openfreemap-fiord');
    expect(ids).toContain('openfreemap-3d');
    expect(catalog.find((basemap) => basemap.id === 'openfreemap-3d')?.view?.pitch).toBe(60);
  });

  it('includes MapTiler styles with API key placeholders', () => {
    const catalog = createBasemapCatalog();
    const ids = catalog.map((basemap) => basemap.id);
    const streets = catalog.find((basemap) => basemap.id === 'maptiler-streets');
    const openstreetmap = catalog.find((basemap) => basemap.id === 'maptiler-openstreetmap');
    const toner = catalog.find((basemap) => basemap.id === 'maptiler-toner');

    expect(ids).toContain('maptiler-aquarelle');
    expect(ids).toContain('maptiler-backdrop');
    expect(ids).toContain('maptiler-base');
    expect(ids).toContain('maptiler-dataviz');
    expect(ids).toContain('maptiler-landscape');
    expect(ids).toContain('maptiler-ocean');
    expect(ids).toContain('maptiler-openstreetmap');
    expect(ids).toContain('maptiler-outdoor');
    expect(ids).toContain('maptiler-satellite-hybrid');
    expect(ids).toContain('maptiler-satellite-plain');
    expect(ids).toContain('maptiler-streets');
    expect(ids).toContain('maptiler-toner');
    expect(ids).toContain('maptiler-topo');
    expect(ids).toContain('maptiler-winter');
    expect(streets?.source.type).toBe('style');
    expect(streets?.source.type === 'style' ? streets.source.url : '').toBe(
      'https://api.maptiler.com/maps/streets-v4/style.json?key={api-key}',
    );
    expect(openstreetmap?.source.type === 'style' ? openstreetmap.source.url : '').toBe(
      'https://api.maptiler.com/maps/openstreetmap/style.json?key',
    );
    expect(toner?.source.type === 'style' ? toner.source.url : '').toBe(
      'https://api.maptiler.com/maps/toner-v2/style.json?key=',
    );
  });

  it('includes Amazon Location styles with API key and region placeholders', () => {
    const catalog = createBasemapCatalog();
    const ids = catalog.map((basemap) => basemap.id);
    const standard = catalog.find((basemap) => basemap.id === 'amazon-standard');

    expect(ids).toContain('amazon-standard');
    expect(ids).toContain('amazon-monochrome');
    expect(ids).toContain('amazon-hybrid');
    expect(ids).toContain('amazon-satellite');
    expect(standard?.source.type).toBe('style');
    expect(standard?.source.type === 'style' ? standard.source.url : '').toBe(
      'https://maps.geo.{aws-region}.amazonaws.com/v2/styles/Standard/descriptor?key={api-key}',
    );
  });

  it('deduplicates providers by id', () => {
    const providers = combineProviders(DEFAULT_BASEMAP_PROVIDERS, [
      { id: 'carto', name: 'Carto Custom' },
      { id: 'custom', name: 'Custom' },
    ]);

    expect(providers.find((provider) => provider.id === 'carto')?.name).toBe('Carto Custom');
    expect(providers.find((provider) => provider.id === 'custom')?.name).toBe('Custom');
  });

  it('returns providers alphabetically by name', () => {
    const providers = combineProviders(DEFAULT_BASEMAP_PROVIDERS, [
      { id: 'zzz', name: 'Zzz' },
      { id: 'aaa', name: 'Aaa' },
    ]);
    const names = providers.map((provider) => provider.name);

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('returns sorted categories', () => {
    const categories = getBasemapCategories(createBasemapCatalog());

    expect(categories).toEqual([...categories].sort());
    expect(categories).toContain('Street');
  });
});
