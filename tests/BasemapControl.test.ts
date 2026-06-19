import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BasemapControl } from '../src/lib/core/BasemapControl';
import type { BasemapDefinition } from '../src/lib/core/types';

const basemaps: BasemapDefinition[] = [
  {
    id: 'one',
    name: 'One Streets',
    provider: 'test',
    type: 'raster',
    category: 'Street',
    attribution: '&copy; One',
    source: {
      type: 'raster',
      tiles: ['https://example.com/one/{z}/{x}/{y}.png'],
    },
  },
  {
    id: 'two',
    name: 'Two Imagery',
    provider: 'test',
    type: 'raster',
    category: 'Imagery',
    attribution: '&copy; Two',
    source: {
      type: 'raster',
      tiles: ['https://example.com/two/{z}/{x}/{y}.png'],
    },
  },
];

function createMockMap() {
  const mapContainer = document.createElement('div');
  const controlCorner = document.createElement('div');
  controlCorner.className = 'maplibregl-ctrl-top-right';
  mapContainer.appendChild(controlCorner);
  document.body.appendChild(mapContainer);

  const sources = new Set<string>();
  const layers: Array<{ id: string; type: string }> = [
    { id: 'background', type: 'background' },
    { id: 'overlay', type: 'circle' },
  ];

  const map = {
    getContainer: vi.fn(() => mapContainer),
    on: vi.fn(),
    off: vi.fn(),
    addSource: vi.fn((id: string) => {
      sources.add(id);
    }),
    addLayer: vi.fn((layer: { id: string; type: string }, beforeId?: string) => {
      const index = beforeId ? layers.findIndex((candidate) => candidate.id === beforeId) : -1;
      if (index === -1) {
        layers.push(layer);
      } else {
        layers.splice(index, 0, layer);
      }
    }),
    removeLayer: vi.fn((id: string) => {
      const index = layers.findIndex((layer) => layer.id === id);
      if (index !== -1) layers.splice(index, 1);
    }),
    removeSource: vi.fn((id: string) => {
      sources.delete(id);
    }),
    getLayer: vi.fn((id: string) => layers.find((layer) => layer.id === id)),
    getSource: vi.fn((id: string) => (sources.has(id) ? { id } : undefined)),
    getStyle: vi.fn(() => ({ version: 8, sources: {}, layers })),
    setStyle: vi.fn(),
    jumpTo: vi.fn(),
  };

  return { map, controlCorner };
}

describe('BasemapControl', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('creates the collapsed button and renders basemap results', () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      basemaps,
      includeDefaultBasemaps: false,
      collapsed: true,
    });

    controlCorner.appendChild(control.onAdd(map as never));
    expect(screen.getByLabelText('Basemaps')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('before_id').value).toBe('');
    expect(screen.getByLabelText('Search basemaps').closest('.basemap-control-search-row')).toBe(
      screen.getByLabelText('before_id').closest('.basemap-control-search-row'),
    );
    expect(screen.getByText('One Streets')).toBeTruthy();
    expect(document.querySelector('.basemap-control-panel')?.classList.contains('expanded')).toBe(
      false,
    );

    fireEvent.click(screen.getByLabelText('Basemaps'));
    expect(document.querySelector('.basemap-control-panel')?.classList.contains('expanded')).toBe(
      true,
    );
  });

  it('filters results from the search input', () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      basemaps,
      includeDefaultBasemaps: false,
      collapsed: false,
    });

    controlCorner.appendChild(control.onAdd(map as never));
    const searchInput = screen.getByLabelText<HTMLInputElement>('Search basemaps');
    searchInput.focus();
    fireEvent.input(searchInput, { target: { value: 'imagery' } });

    expect(screen.queryByText('One Streets')).toBeNull();
    expect(screen.getByText('Two Imagery')).toBeTruthy();
    expect(document.activeElement).toBe(searchInput);
  });

  it('keeps the panel open when clicking outside', () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      basemaps,
      includeDefaultBasemaps: false,
      collapsed: false,
    });

    controlCorner.appendChild(control.onAdd(map as never));
    fireEvent.click(document.body);

    expect(document.querySelector('.basemap-control-panel')?.classList.contains('expanded')).toBe(
      true,
    );
  });

  it('filters results from the provider select', () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      basemaps,
      providers: [
        { id: 'one-provider', name: 'One Provider' },
        { id: 'two-provider', name: 'Two Provider' },
      ],
      includeDefaultBasemaps: false,
      collapsed: false,
    });
    control.setBasemaps([
      { ...basemaps[0], provider: 'one-provider' },
      { ...basemaps[1], provider: 'two-provider' },
    ]);

    controlCorner.appendChild(control.onAdd(map as never));
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'two-provider' } });

    expect(screen.queryByText('One Streets')).toBeNull();
    expect(screen.getByText('Two Imagery')).toBeTruthy();
  });

  it('filters built-in basemaps from the provider select', () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      collapsed: false,
    });

    controlCorner.appendChild(control.onAdd(map as never));
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'esri' } });

    expect(screen.getByLabelText<HTMLSelectElement>('Provider').value).toBe('esri');
    expect(screen.getByText('World Imagery')).toBeTruthy();
    expect(screen.getByText('World Topographic')).toBeTruthy();
    expect(screen.queryByText('OpenStreetMap Standard')).toBeNull();
  });

  it('selects a basemap, emits an event, and replaces the previous basemap', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      basemaps,
      includeDefaultBasemaps: false,
      collapsed: false,
    });
    const handler = vi.fn();
    control.on('basemapchange', handler);

    controlCorner.appendChild(control.onAdd(map as never));
    await control.setBasemap('one');
    await control.setBasemap('two');

    expect(handler).toHaveBeenCalledTimes(2);
    expect(control.getActiveBasemap()?.id).toBe('two');
    expect(map.removeLayer).toHaveBeenCalledWith('one');
    expect(map.removeSource).toHaveBeenCalledWith('maplibre-basemap-control-source-one');
    expect(map.addLayer).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'two' }),
      undefined,
    );
  });

  it('preserves the results scroll position when selecting a basemap', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      basemaps,
      includeDefaultBasemaps: false,
      collapsed: false,
    });

    controlCorner.appendChild(control.onAdd(map as never));
    const results = document.querySelector<HTMLElement>('.basemap-control-results');
    expect(results).toBeTruthy();
    results!.scrollTop = 42;

    await control.setBasemap('one');

    expect(document.querySelector<HTMLElement>('.basemap-control-results')?.scrollTop).toBe(42);
  });

  it('leaves the selected basemap on the map when removed', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      basemaps,
      includeDefaultBasemaps: false,
      collapsed: false,
    });

    controlCorner.appendChild(control.onAdd(map as never));
    await control.setBasemap('one');
    control.onRemove();

    expect(map.removeLayer).not.toHaveBeenCalled();
    expect(map.removeSource).not.toHaveBeenCalled();
    expect(map.getLayer('one')).toBeTruthy();
    expect(map.getSource('maplibre-basemap-control-source-one')).toBeTruthy();
  });

  it('uses the before_id input when adding raster basemaps', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      basemaps,
      includeDefaultBasemaps: false,
      collapsed: false,
    });

    controlCorner.appendChild(control.onAdd(map as never));
    fireEvent.input(screen.getByLabelText('before_id'), { target: { value: 'overlay' } });
    await control.setBasemap('one');

    expect(map.addLayer).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'one' }),
      'overlay',
    );
  });

  it('sets full styles for style basemaps', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      basemaps: [
        {
          id: 'style',
          name: 'Style',
          provider: 'test',
          type: 'style',
          source: {
            type: 'style',
            url: 'https://example.com/style.json',
          },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));
    await control.setBasemap('style');

    expect(map.setStyle).toHaveBeenCalledWith('https://example.com/style.json');
  });

  it('shows provider settings when keyed provider basemaps are available', () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      basemaps: [
        {
          id: 'maptiler-style',
          name: 'MapTiler Style',
          provider: 'maptiler',
          type: 'style',
          source: {
            type: 'style',
            url: 'https://api.maptiler.com/maps/streets-v4/style.json?key={api-key}',
          },
        },
        {
          id: 'amazon-style',
          name: 'Amazon Style',
          provider: 'amazon',
          type: 'style',
          source: {
            type: 'style',
            url: 'https://maps.geo.{aws-region}.amazonaws.com/v2/styles/Standard/descriptor?key={api-key}',
          },
        },
        {
          id: 'mapbox-style',
          name: 'Mapbox Style',
          provider: 'mapbox',
          type: 'style',
          source: {
            type: 'style',
            url: 'https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token={api-key}',
          },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));

    expect(screen.getByText('Provider settings')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('MapTiler API key').value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>('Mapbox access token').value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>('Mapbox access token').autocomplete).toBe(
      'new-password',
    );
    expect(screen.getByLabelText<HTMLInputElement>('Amazon API key').value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>('AWS region').value).toBe('us-east-1');
  });

  it('applies MapTiler styles with the configured API key', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      mapTilerApiKey: 'test key',
      basemaps: [
        {
          id: 'maptiler-style',
          name: 'MapTiler Style',
          provider: 'maptiler',
          type: 'style',
          source: {
            type: 'style',
            url: 'https://api.maptiler.com/maps/streets-v4/style.json?key={api-key}',
          },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));
    await control.setBasemap('maptiler-style');

    expect(map.setStyle).toHaveBeenCalledWith(
      'https://api.maptiler.com/maps/streets-v4/style.json?key=test%20key',
    );
  });

  it('applies MapTiler style URLs that end with key query exceptions', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      mapTilerApiKey: 'test key',
      basemaps: [
        {
          id: 'maptiler-openstreetmap',
          name: 'MapTiler OpenStreetMap',
          provider: 'maptiler',
          type: 'style',
          source: {
            type: 'style',
            url: 'https://api.maptiler.com/maps/openstreetmap/style.json?key',
          },
        },
        {
          id: 'maptiler-toner',
          name: 'MapTiler Toner',
          provider: 'maptiler',
          type: 'style',
          source: {
            type: 'style',
            url: 'https://api.maptiler.com/maps/toner-v2/style.json?key=',
          },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));
    await control.setBasemap('maptiler-openstreetmap');
    await control.setBasemap('maptiler-toner');

    expect(map.setStyle).toHaveBeenNthCalledWith(
      1,
      'https://api.maptiler.com/maps/openstreetmap/style.json?key=test%20key',
    );
    expect(map.setStyle).toHaveBeenNthCalledWith(
      2,
      'https://api.maptiler.com/maps/toner-v2/style.json?key=test%20key',
    );
  });

  it('applies Amazon styles with the configured API key and region', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      amazonApiKey: 'amazon key',
      awsRegion: 'eu-central-1',
      basemaps: [
        {
          id: 'amazon-standard',
          name: 'Amazon Standard',
          provider: 'amazon',
          type: 'style',
          source: {
            type: 'style',
            url: 'https://maps.geo.{aws-region}.amazonaws.com/v2/styles/Standard/descriptor?key={api-key}',
          },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));
    await control.setBasemap('amazon-standard');

    expect(map.setStyle).toHaveBeenCalledWith(
      'https://maps.geo.eu-central-1.amazonaws.com/v2/styles/Standard/descriptor?key=amazon%20key',
    );
  });

  it('requires an Amazon API key before applying Amazon styles', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      basemaps: [
        {
          id: 'amazon-standard',
          name: 'Amazon Standard',
          provider: 'amazon',
          type: 'style',
          source: {
            type: 'style',
            url: 'https://maps.geo.{aws-region}.amazonaws.com/v2/styles/Standard/descriptor?key={api-key}',
          },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));

    await expect(control.setBasemap('amazon-standard')).rejects.toThrow(
      'Enter an Amazon API key before applying this basemap.',
    );
    expect(map.setStyle).not.toHaveBeenCalled();
  });

  it('makes a missing-credential error actionable with a help link and reveals the inputs', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      collapsed: false,
      basemaps: [
        {
          id: 'amazon-standard',
          name: 'Amazon Standard',
          provider: 'amazon',
          type: 'style',
          source: {
            type: 'style',
            url: 'https://maps.geo.{aws-region}.amazonaws.com/v2/styles/Standard/descriptor?key={api-key}',
          },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));
    await expect(control.setBasemap('amazon-standard')).rejects.toThrow(
      'Enter an Amazon API key before applying this basemap.',
    );

    const status = document.querySelector('.basemap-control-status');
    expect(status?.classList.contains('is-error')).toBe(true);
    const link = status?.querySelector<HTMLAnchorElement>('.basemap-control-status-link');
    expect(link).toBeTruthy();
    expect(link?.textContent).toBe('Get an Amazon API key');
    expect(link?.href).toContain('aws.amazon.com');
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toBe('noopener noreferrer');

    // The Provider settings section auto-expands so the key input is visible.
    const details = document.querySelector<HTMLDetailsElement>(
      '.basemap-control-provider-settings',
    );
    expect(details?.open).toBe(true);
    expect(screen.getByLabelText('Amazon API key')).toBeTruthy();
  });

  it('applies Mapbox styles with the configured access token', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      mapboxAccessToken: 'mapbox token',
      basemaps: [
        {
          id: 'mapbox-streets',
          name: 'Mapbox Streets',
          provider: 'mapbox',
          type: 'style',
          source: {
            type: 'style',
            url: 'https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token={api-key}',
          },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));
    await control.setBasemap('mapbox-streets');

    expect(map.setStyle).toHaveBeenCalledWith(
      'https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=mapbox%20token',
      expect.objectContaining({ validate: false, transformStyle: expect.any(Function) }),
    );

    const styleOptions = map.setStyle.mock.calls[0][1];
    const transformedStyle = styleOptions.transformStyle(undefined, {
      version: 8,
      glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
      sprite: 'mapbox://sprites/mapbox/streets-v12',
      sources: {
        composite: {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2',
        },
      },
      layers: [],
    });

    expect(transformedStyle.glyphs).toBe(
      'https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=mapbox%20token',
    );
    expect(transformedStyle.sprite).toBe(
      'https://api.mapbox.com/styles/v1/mapbox/streets-v12/sprite?access_token=mapbox%20token',
    );
    expect(transformedStyle.sources.composite.url).toBe(
      'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2.json?secure&access_token=mapbox%20token',
    );
    expect(transformedStyle.projection).toEqual({ type: 'mercator' });
  });

  it('requires a Mapbox access token before applying Mapbox styles', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      basemaps: [
        {
          id: 'mapbox-streets',
          name: 'Mapbox Streets',
          provider: 'mapbox',
          type: 'style',
          source: {
            type: 'style',
            url: 'https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token={api-key}',
          },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));

    await expect(control.setBasemap('mapbox-streets')).rejects.toThrow(
      'Enter a Mapbox access token before applying this basemap.',
    );
    expect(map.setStyle).not.toHaveBeenCalled();
  });

  it('rejects URL-like Mapbox access tokens before applying Mapbox styles', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      mapboxAccessToken: 'http://localhost:5174/examples/basic/index.html',
      basemaps: [
        {
          id: 'mapbox-streets',
          name: 'Mapbox Streets',
          provider: 'mapbox',
          type: 'style',
          source: {
            type: 'style',
            url: 'https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token={api-key}',
          },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));

    await expect(control.setBasemap('mapbox-streets')).rejects.toThrow(
      'Enter a valid Mapbox access token, not a URL.',
    );
    expect(map.setStyle).not.toHaveBeenCalled();
  });

  it('requires an API key before applying MapTiler styles', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      basemaps: [
        {
          id: 'maptiler-style',
          name: 'MapTiler Style',
          provider: 'maptiler',
          type: 'style',
          source: {
            type: 'style',
            url: 'https://api.maptiler.com/maps/streets-v4/style.json?key={api-key}',
          },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));

    await expect(control.setBasemap('maptiler-style')).rejects.toThrow(
      'Enter a MapTiler API key before applying this basemap.',
    );
    expect(map.setStyle).not.toHaveBeenCalled();
  });

  it('stacks raster basemaps when allowMultiple is enabled', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      basemaps,
      includeDefaultBasemaps: false,
      collapsed: false,
      allowMultiple: true,
    });
    const handler = vi.fn();
    control.on('basemapchange', handler);

    controlCorner.appendChild(control.onAdd(map as never));
    await control.addBasemap('one');
    await control.addBasemap('two');

    expect(map.removeLayer).not.toHaveBeenCalled();
    expect(map.removeSource).not.toHaveBeenCalled();
    expect(map.getLayer('one')).toBeTruthy();
    expect(map.getLayer('two')).toBeTruthy();
    expect(control.getState().activeBasemapIds).toEqual(['one', 'two']);
    expect(control.getActiveBasemaps().map((basemap) => basemap.id)).toEqual(['one', 'two']);
    expect(control.getActiveBasemap()?.id).toBe('two');
    expect(handler).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'add' }));
  });

  it('removes a single managed raster basemap and emits basemapremove', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      basemaps,
      includeDefaultBasemaps: false,
      collapsed: false,
      allowMultiple: true,
    });
    const removeHandler = vi.fn();
    control.on('basemapremove', removeHandler);

    controlCorner.appendChild(control.onAdd(map as never));
    await control.addBasemap('one');
    await control.addBasemap('two');
    await control.removeBasemap('one');

    expect(map.removeLayer).toHaveBeenCalledWith('one');
    expect(map.removeSource).toHaveBeenCalledWith('maplibre-basemap-control-source-one');
    expect(map.getLayer('one')).toBeUndefined();
    expect(map.getLayer('two')).toBeTruthy();
    expect(control.getState().activeBasemapIds).toEqual(['two']);
    expect(control.getActiveBasemap()?.id).toBe('two');
    expect(removeHandler).toHaveBeenCalledTimes(1);
    expect(removeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'basemapremove',
        managedRaster: expect.objectContaining({ layerId: 'one' }),
      }),
    );
  });

  it('toggles a raster basemap on the second click in multiple mode', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      basemaps,
      includeDefaultBasemaps: false,
      collapsed: false,
      allowMultiple: true,
    });

    controlCorner.appendChild(control.onAdd(map as never));

    fireEvent.click(screen.getByText('One Streets'));
    await Promise.resolve();
    expect(control.isBasemapActive('one')).toBe(true);
    expect(map.getLayer('one')).toBeTruthy();

    fireEvent.click(screen.getByText('One Streets'));
    await Promise.resolve();
    expect(control.isBasemapActive('one')).toBe(false);
    expect(map.getLayer('one')).toBeUndefined();
  });

  it('clears stacked rasters when a style basemap is selected in multiple mode', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      collapsed: false,
      allowMultiple: true,
      basemaps: [
        ...basemaps,
        {
          id: 'style',
          name: 'Style',
          provider: 'test',
          type: 'style',
          source: { type: 'style', url: 'https://example.com/style.json' },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));
    await control.addBasemap('one');
    await control.addBasemap('two');
    await control.setBasemap('style');

    expect(map.removeLayer).toHaveBeenCalledWith('one');
    expect(map.removeLayer).toHaveBeenCalledWith('two');
    expect(map.setStyle).toHaveBeenCalledWith('https://example.com/style.json');
    expect(control.getState().activeBasemapIds).toEqual(['style']);
  });

  it('confirms before a style basemap replaces stacked rasters in multiple mode', async () => {
    const { map, controlCorner } = createMockMap();
    const confirmStyleReplace = vi.fn().mockResolvedValue(true);
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      collapsed: false,
      allowMultiple: true,
      confirmStyleReplace,
      basemaps: [
        ...basemaps,
        {
          id: 'style',
          name: 'Style',
          provider: 'test',
          type: 'style',
          source: { type: 'style', url: 'https://example.com/style.json' },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));
    await control.addBasemap('one');
    await control.addBasemap('two');
    await control.setBasemap('style');

    expect(confirmStyleReplace).toHaveBeenCalledTimes(1);
    expect(confirmStyleReplace).toHaveBeenCalledWith({
      basemap: expect.objectContaining({ id: 'style' }),
      replacedBasemapIds: ['one', 'two'],
    });
    expect(map.setStyle).toHaveBeenCalledWith('https://example.com/style.json');
    expect(control.getState().activeBasemapIds).toEqual(['style']);
  });

  it('keeps stacked rasters when the style-replace confirmation is declined', async () => {
    const { map, controlCorner } = createMockMap();
    const confirmStyleReplace = vi.fn().mockResolvedValue(false);
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      collapsed: false,
      allowMultiple: true,
      confirmStyleReplace,
      basemaps: [
        ...basemaps,
        {
          id: 'style',
          name: 'Style',
          provider: 'test',
          type: 'style',
          source: { type: 'style', url: 'https://example.com/style.json' },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));
    await control.addBasemap('one');
    await control.addBasemap('two');
    await control.setBasemap('style');

    expect(confirmStyleReplace).toHaveBeenCalledTimes(1);
    expect(map.setStyle).not.toHaveBeenCalled();
    expect(map.getLayer('one')).toBeTruthy();
    expect(map.getLayer('two')).toBeTruthy();
    expect(control.getState().activeBasemapIds).toEqual(['one', 'two']);
  });

  it('does not confirm a style basemap in single (replace) mode', async () => {
    const { map, controlCorner } = createMockMap();
    const confirmStyleReplace = vi.fn().mockResolvedValue(true);
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      collapsed: false,
      confirmStyleReplace,
      basemaps: [
        ...basemaps,
        {
          id: 'style',
          name: 'Style',
          provider: 'test',
          type: 'style',
          source: { type: 'style', url: 'https://example.com/style.json' },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));
    await control.setBasemap('one');
    await control.setBasemap('style');

    expect(confirmStyleReplace).not.toHaveBeenCalled();
    expect(map.setStyle).toHaveBeenCalledWith('https://example.com/style.json');
  });

  it('replaces the active raster when allowMultiple is disabled (default)', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      basemaps,
      includeDefaultBasemaps: false,
      collapsed: false,
    });

    controlCorner.appendChild(control.onAdd(map as never));
    fireEvent.click(screen.getByText('One Streets'));
    await Promise.resolve();
    fireEvent.click(screen.getByText('Two Imagery'));
    await Promise.resolve();

    expect(map.removeLayer).toHaveBeenCalledWith('one');
    expect(control.getState().activeBasemapIds).toEqual(['two']);
  });

  it('switches between replace and add modes via the panel toggle', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      basemaps,
      includeDefaultBasemaps: false,
      collapsed: false,
    });

    controlCorner.appendChild(control.onAdd(map as never));
    const toggle = screen.getByLabelText<HTMLInputElement>('Add basemaps instead of replacing');
    expect(toggle.checked).toBe(false);
    expect(control.getState().allowMultiple).toBe(false);

    fireEvent.click(toggle);
    expect(control.getState().allowMultiple).toBe(true);

    fireEvent.click(screen.getByText('One Streets'));
    await Promise.resolve();
    fireEvent.click(screen.getByText('Two Imagery'));
    await Promise.resolve();

    expect(map.removeLayer).not.toHaveBeenCalled();
    expect(control.getState().activeBasemapIds).toEqual(['one', 'two']);
  });

  it('keeps the default raster basemap applied in multiple mode', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      basemaps,
      includeDefaultBasemaps: false,
      collapsed: false,
      allowMultiple: true,
      defaultBasemapId: 'one',
    });

    controlCorner.appendChild(control.onAdd(map as never));
    // Let the deferred setBasemap promise settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(map.getLayer('one')).toBeTruthy();
    expect(control.isBasemapActive('one')).toBe(true);
    expect(control.getState().activeBasemapIds).toEqual(['one']);
  });

  it('hides the multiple toggle when showMultipleToggle is false', () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      basemaps,
      includeDefaultBasemaps: false,
      collapsed: false,
      showMultipleToggle: false,
    });

    controlCorner.appendChild(control.onAdd(map as never));
    expect(screen.queryByLabelText('Add basemaps instead of replacing')).toBeNull();
  });

  it('renders resize handles by default and omits them when disabled', () => {
    const first = createMockMap();
    const resizable = new BasemapControl({
      basemaps,
      includeDefaultBasemaps: false,
      collapsed: false,
    });
    first.controlCorner.appendChild(resizable.onAdd(first.map as never));
    expect(document.querySelectorAll('.basemap-control-resize-handle')).toHaveLength(2);
    resizable.onRemove();

    const second = createMockMap();
    const fixed = new BasemapControl({
      basemaps,
      includeDefaultBasemaps: false,
      collapsed: false,
      resizable: false,
    });
    second.controlCorner.appendChild(fixed.onAdd(second.map as never));
    expect(document.querySelectorAll('.basemap-control-resize-handle')).toHaveLength(0);
  });

  it('lets a drag resize the panel beyond the default size caps', () => {
    const { map, controlCorner } = createMockMap();
    // Give the map a large viewport so the resize bounds are generous.
    const mapContainer = map.getContainer() as HTMLElement;
    mapContainer.getBoundingClientRect = () =>
      ({
        width: 1400,
        height: 900,
        left: 0,
        top: 0,
        right: 1400,
        bottom: 900,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    const control = new BasemapControl({
      basemaps,
      includeDefaultBasemaps: false,
      collapsed: false,
    });
    controlCorner.appendChild(control.onAdd(map as never));

    const panel = document.querySelector<HTMLElement>('.basemap-control-panel')!;
    // The default top-right control anchors the resize to the panel's top-right
    // corner; stub the rect so the drag math is deterministic.
    panel.getBoundingClientRect = () =>
      ({
        width: 340,
        height: 350,
        left: 660,
        top: 50,
        right: 1000,
        bottom: 400,
        x: 660,
        y: 50,
        toJSON: () => ({}),
      }) as DOMRect;

    const handle = document.querySelector<HTMLElement>(
      '.basemap-control-resize-bottom-right',
    )!;
    fireEvent.pointerDown(handle, { pointerId: 1 });
    // Drag left and down to grow well past the old 420×560 defaults. jsdom's
    // synthetic PointerEvent drops clientX/clientY, so dispatch them directly.
    const move = new Event('pointermove') as Event & {
      clientX: number;
      clientY: number;
    };
    move.clientX = 100;
    move.clientY = 750;
    window.dispatchEvent(move);
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(panel.classList.contains('is-resized')).toBe(true);
    expect(parseInt(panel.style.width, 10)).toBeGreaterThan(420);
    expect(parseInt(panel.style.height, 10)).toBeGreaterThan(560);
  });

  it('applies optional basemap camera settings', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      basemaps: [
        {
          id: 'style-3d',
          name: 'Style 3D',
          provider: 'test',
          type: 'style',
          source: {
            type: 'style',
            url: 'https://example.com/style.json',
          },
          view: {
            center: [-0.114, 51.506],
            zoom: 14.2,
            bearing: 55.2,
            pitch: 60,
          },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));
    await control.setBasemap('style-3d');

    expect(map.jumpTo).toHaveBeenCalledWith({
      center: [-0.114, 51.506],
      zoom: 14.2,
      bearing: 55.2,
      pitch: 60,
    });
  });
});
