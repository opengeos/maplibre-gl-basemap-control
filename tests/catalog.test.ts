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

  it('deduplicates providers by id', () => {
    const providers = combineProviders(DEFAULT_BASEMAP_PROVIDERS, [
      { id: 'carto', name: 'Carto Custom' },
      { id: 'custom', name: 'Custom' },
    ]);

    expect(providers.find((provider) => provider.id === 'carto')?.name).toBe('Carto Custom');
    expect(providers.find((provider) => provider.id === 'custom')?.name).toBe('Custom');
  });

  it('returns sorted categories', () => {
    const categories = getBasemapCategories(createBasemapCatalog());

    expect(categories).toEqual([...categories].sort());
    expect(categories).toContain('Street');
  });
});
