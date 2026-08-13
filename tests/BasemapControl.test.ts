import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BasemapControl } from '../src/lib/core/BasemapControl';
import type { BasemapDefinition } from '../src/lib/core/types';

// Drains pending microtasks so a panel click's async basemap application
// (which may resolve provider credentials before adding the layer) settles.
const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

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

  // Minimal event-emitter so the control's `on`/`once`/`off` listeners (e.g. the
  // style-load watcher) can be exercised. `fire` dispatches an event and, for
  // `once`, detaches the listener afterward.
  const listeners = new Map<string, Set<{ fn: (event?: unknown) => void; once: boolean }>>();
  const addListener = (type: string, fn: (event?: unknown) => void, once: boolean) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add({ fn, once });
  };
  const fire = (type: string, event?: unknown) => {
    for (const entry of [...(listeners.get(type) ?? [])]) {
      if (entry.once) listeners.get(type)!.delete(entry);
      entry.fn(event);
    }
  };

  const map = {
    getContainer: vi.fn(() => mapContainer),
    on: vi.fn((type: string, fn: (event?: unknown) => void) => addListener(type, fn, false)),
    once: vi.fn((type: string, fn: (event?: unknown) => void) => addListener(type, fn, true)),
    off: vi.fn((type: string, fn: (event?: unknown) => void) => {
      for (const entry of [...(listeners.get(type) ?? [])]) {
        if (entry.fn === fn) listeners.get(type)!.delete(entry);
      }
    }),
    fire,
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

    // The basemap list itself no longer carries credential inputs; they live in
    // the dedicated API-keys view behind the header key button (#837).
    expect(screen.queryByLabelText('MapTiler API key')).toBeNull();
    const settingsToggle = document.querySelector<HTMLButtonElement>(
      '.basemap-control-settings-toggle',
    );
    expect(settingsToggle).toBeTruthy();
    expect(settingsToggle?.hidden).toBe(false);

    settingsToggle?.click();

    expect(screen.getByText('API keys')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('MapTiler API key').value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>('Mapbox access token').value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>('Mapbox access token').autocomplete).toBe(
      'new-password',
    );
    expect(screen.getByLabelText<HTMLInputElement>('Amazon API key').value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>('AWS region').value).toBe('us-east-1');
  });

  it('hides the API-keys button when no keyed providers are available', () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      basemaps: [
        {
          id: 'plain-style',
          name: 'Plain Style',
          provider: 'osm',
          type: 'style',
          source: { type: 'style', url: 'https://example.com/style.json' },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));

    const settingsToggle = document.querySelector<HTMLButtonElement>(
      '.basemap-control-settings-toggle',
    );
    expect(settingsToggle?.hidden).toBe(true);
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

    // The failing provider's credential field is shown inline beside the error
    // so the fix is one input away (#837).
    const inlineFields = status?.querySelector('.basemap-control-status-fields');
    expect(inlineFields).toBeTruthy();
    expect(inlineFields?.querySelector('[aria-label="Amazon API key"]')).toBeTruthy();
    expect(inlineFields?.querySelector('[aria-label="AWS region"]')).toBeTruthy();
    // Only the failing provider's fields appear, not every other provider's.
    expect(screen.queryByLabelText('MapTiler API key')).toBeNull();
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

  it('requires an API key before applying Stadia basemaps', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({ collapsed: false });

    controlCorner.appendChild(control.onAdd(map as never));

    await expect(control.setBasemap('stadia-stamen-watercolor')).rejects.toThrow(
      'Enter a Stadia Maps API key before applying this layer.',
    );
  });

  it('substitutes the Stadia API key into the tile URL', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({ stadiaApiKey: 'st secret' });

    controlCorner.appendChild(control.onAdd(map as never));
    await control.setBasemap('stadia-stamen-watercolor');

    expect(lastSourceFor(map, 'stadia-stamen-watercolor')?.tiles?.[0]).toBe(
      'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg?api_key=st%20secret',
    );
  });

  it('applies a Stadia key set after the failed attempt', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({});

    controlCorner.appendChild(control.onAdd(map as never));
    await expect(control.setBasemap('stadia-alidade-smooth')).rejects.toThrow(
      'Enter a Stadia Maps API key before applying this layer.',
    );

    control.setStadiaApiKey('later-key');
    await control.setBasemap('stadia-alidade-smooth');

    expect(lastSourceFor(map, 'stadia-alidade-smooth')?.tiles?.[0]).toBe(
      'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png?api_key=later-key',
    );
  });

  it('requires an API key before applying Tianditu basemaps', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({ collapsed: false });

    controlCorner.appendChild(control.onAdd(map as never));

    await expect(control.setBasemap('tianditu-vector')).rejects.toThrow(
      'Enter a Tianditu API key before applying this layer.',
    );
  });

  it('substitutes the Tianditu API key into every host template', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({ tiandituApiKey: 'td key' });

    controlCorner.appendChild(control.onAdd(map as never));
    await control.setBasemap('tianditu-imagery');

    const tiles = lastSourceFor(map, 'tianditu-imagery')?.tiles ?? [];
    expect(tiles).toHaveLength(8);
    expect(tiles[0]).toBe(
      'https://t0.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=td%20key',
    );
    expect(tiles[7]).toBe(
      'https://t7.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=td%20key',
    );
  });

  it('applies a Tianditu key set after the failed attempt', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({});

    controlCorner.appendChild(control.onAdd(map as never));
    await expect(control.setBasemap('tianditu-vector')).rejects.toThrow(
      'Enter a Tianditu API key before applying this layer.',
    );

    control.setTiandituApiKey('later-key');
    await control.setBasemap('tianditu-vector');

    expect(lastSourceFor(map, 'tianditu-vector')?.tiles?.[0]).toBe(
      'https://t0.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=later-key',
    );
  });

  it('applies keyless Amap and Tencent basemaps, preserving the TMS scheme', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({});

    controlCorner.appendChild(control.onAdd(map as never));

    await control.setBasemap('amap-street');
    expect(lastSourceFor(map, 'amap-street')?.tiles?.[0]).toBe(
      'https://wprd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scl=1&style=7&x={x}&y={y}&z={z}',
    );
    expect(lastSourceFor(map, 'amap-street')?.scheme).toBeUndefined();

    await control.setBasemap('tencent-street');
    expect(lastSourceFor(map, 'tencent-street')?.scheme).toBe('tms');
  });

  it('requires an API key before applying Protomaps styles', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({ collapsed: false });

    controlCorner.appendChild(control.onAdd(map as never));

    await expect(control.setBasemap('protomaps-light')).rejects.toThrow(
      'Enter a Protomaps API key before applying this basemap.',
    );
    expect(map.setStyle).not.toHaveBeenCalled();
  });

  it('substitutes the Protomaps API key into the style URL', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({ protomapsApiKey: 'pm secret' });

    controlCorner.appendChild(control.onAdd(map as never));
    await control.setBasemap('protomaps-dark');

    expect(map.setStyle).toHaveBeenCalledWith(
      'https://api.protomaps.com/styles/v5/dark/en.json?key=pm%20secret',
    );
  });

  it('applies a Protomaps key set after the failed attempt', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({});

    controlCorner.appendChild(control.onAdd(map as never));
    await expect(control.setBasemap('protomaps-grayscale')).rejects.toThrow(
      'Enter a Protomaps API key before applying this basemap.',
    );

    control.setProtomapsApiKey('later-key');
    await control.setBasemap('protomaps-grayscale');

    expect(map.setStyle).toHaveBeenCalledWith(
      'https://api.protomaps.com/styles/v5/grayscale/en.json?key=later-key',
    );
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
    await flushAsync();
    expect(control.isBasemapActive('one')).toBe(true);
    expect(map.getLayer('one')).toBeTruthy();

    fireEvent.click(screen.getByText('One Streets'));
    await flushAsync();
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

  it('keeps stacked rasters when confirmStyleReplace rejects', async () => {
    const { map, controlCorner } = createMockMap();
    const confirmStyleReplace = vi.fn().mockRejectedValue(new Error('prompt failed'));
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
    await expect(control.setBasemap('style')).resolves.toBeUndefined();

    expect(confirmStyleReplace).toHaveBeenCalledTimes(1);
    expect(map.setStyle).not.toHaveBeenCalled();
    expect(map.getLayer('one')).toBeTruthy();
    expect(map.getLayer('two')).toBeTruthy();
    expect(control.getState().activeBasemapIds).toEqual(['one', 'two']);
  });

  it('validates style credentials before the destructive confirm prompt', async () => {
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
    await control.addBasemap('one');
    await control.addBasemap('two');

    // The Amazon key is missing, so the missing-credential error must surface
    // before the user is ever asked to discard their stacked rasters (#837).
    await expect(control.setBasemap('amazon-standard')).rejects.toThrow(
      'Enter an Amazon API key before applying this basemap.',
    );
    expect(confirmStyleReplace).not.toHaveBeenCalled();
    expect(map.setStyle).not.toHaveBeenCalled();
    expect(map.getLayer('one')).toBeTruthy();
    expect(map.getLayer('two')).toBeTruthy();
    expect(control.getState().activeBasemapIds).toEqual(['one', 'two']);
  });

  it('clears a stale credential error when the user searches for an alternative', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      collapsed: false,
      basemaps: [
        ...basemaps,
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
    await expect(control.setBasemap('amazon-standard')).rejects.toThrow();
    expect(document.querySelector('.basemap-control-status.is-error')).toBeTruthy();

    const search = screen.getByLabelText<HTMLInputElement>('Search basemaps');
    fireEvent.input(search, { target: { value: 'two' } });

    expect(document.querySelector('.basemap-control-status.is-error')).toBeNull();
    expect(control.getState().error).toBeUndefined();
  });

  it('clears a stale credential error when the provider filter changes', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      collapsed: false,
      basemaps: [
        ...basemaps,
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
    await expect(control.setBasemap('amazon-standard')).rejects.toThrow();
    expect(document.querySelector('.basemap-control-status.is-error')).toBeTruthy();

    const providerSelect = screen.getByLabelText<HTMLSelectElement>('Provider');
    fireEvent.change(providerSelect, { target: { value: 'test' } });

    expect(document.querySelector('.basemap-control-status.is-error')).toBeNull();
    expect(control.getState().error).toBeUndefined();
  });

  it('retries the failed basemap from the inline credential field on Enter', async () => {
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
    await expect(control.setBasemap('amazon-standard')).rejects.toThrow();

    const keyInput = screen.getByLabelText<HTMLInputElement>('Amazon API key');
    fireEvent.input(keyInput, { target: { value: 'amazon key' } });
    // Typing the key does not yank the inline field away mid-edit.
    expect(document.querySelector('.basemap-control-status-fields')).toBeTruthy();

    fireEvent.keyDown(keyInput, { key: 'Enter' });
    await flushAsync();

    expect(map.setStyle).toHaveBeenCalledWith(
      'https://maps.geo.us-east-1.amazonaws.com/v2/styles/Standard/descriptor?key=amazon%20key',
    );
    expect(document.querySelector('.basemap-control-status.is-error')).toBeNull();
  });

  it('emits the resolved style URL for a provider style basemap', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      collapsed: false,
      amazonApiKey: 'secret-key',
      awsRegion: 'us-west-2',
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
    const handler = vi.fn();
    control.on('basemapchange', handler);

    controlCorner.appendChild(control.onAdd(map as never));
    await control.setBasemap('amazon-standard');

    const resolved =
      'https://maps.geo.us-west-2.amazonaws.com/v2/styles/Standard/descriptor?key=secret-key';
    expect(map.setStyle).toHaveBeenCalledWith(resolved);
    // The event carries the fully substituted URL, not the raw template, so a
    // host that manages the map style itself applies the same URL the control
    // did rather than one still containing `{api-key}`/`{aws-region}`.
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'basemapchange', resolvedStyleUrl: resolved }),
    );
  });

  it('restores the previous basemap and reports an error when a style fails to load', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      collapsed: false,
      amazonApiKey: 'bad-key',
      basemaps: [
        {
          id: 'base-style',
          name: 'Base Style',
          provider: 'test',
          type: 'style',
          source: { type: 'style', url: 'https://example.com/base.json' },
        },
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
    const changeHandler = vi.fn();
    const errorHandler = vi.fn();
    control.on('basemapchange', changeHandler);
    control.on('error', errorHandler);

    controlCorner.appendChild(control.onAdd(map as never));
    await control.setBasemap('base-style');
    await control.setBasemap('amazon-standard');
    expect(control.getActiveBasemap()?.id).toBe('amazon-standard');

    const amazonUrl =
      'https://maps.geo.us-east-1.amazonaws.com/v2/styles/Standard/descriptor?key=bad-key';
    // Simulate MapLibre reporting the descriptor request failing (HTTP 403).
    map.fire('error', { error: { url: amazonUrl, status: 403 } });

    // Rolled back to the working basemap and reapplied its style.
    expect(control.getActiveBasemap()?.id).toBe('base-style');
    expect(map.setStyle).toHaveBeenLastCalledWith('https://example.com/base.json');
    // The failure is surfaced inline and through the error event.
    expect(control.getState().error).toContain('Amazon Standard');
    expect(control.getState().error).toContain('403');
    expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    expect(document.querySelector('.basemap-control-status.is-error')).toBeTruthy();
    // A basemapchange was emitted for the restored basemap so a host store can
    // follow the rollback, flagged `restored` so the host can tell it apart from
    // a user selection.
    expect(changeHandler).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'basemapchange',
        basemap: expect.objectContaining({ id: 'base-style' }),
        restored: true,
      }),
    );
  });

  it('rolls back a credentialed provider basemap when its tiles are unauthorized', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      collapsed: false,
      amazonApiKey: 'bad-key',
      basemaps: [
        {
          id: 'base-style',
          name: 'Base Style',
          provider: 'test',
          type: 'style',
          source: { type: 'style', url: 'https://example.com/base.json' },
        },
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
    await control.setBasemap('base-style');
    await control.setBasemap('amazon-standard');

    // The descriptor loaded fine, but the provider 403s the tiles for a bad key
    // (a different URL from the style document).
    map.fire('error', {
      error: {
        url: 'https://maps.geo.us-east-1.amazonaws.com/v2/tiles/vector.basemap/0/0/0?key=bad-key',
        status: 403,
      },
    });

    expect(control.getActiveBasemap()?.id).toBe('base-style');
    expect(control.getState().error).toContain('Amazon Standard');
    expect(control.getState().error).toContain('403');
  });

  it('ignores non-auth resource errors on a style that loaded', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      collapsed: false,
      amazonApiKey: 'good-key',
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

    // A single missing tile (404, not an auth failure) must not roll back a
    // basemap whose credentials are accepted.
    map.fire('error', { error: { url: 'https://example.com/tiles/1/2/3.png', status: 404 } });

    expect(control.getActiveBasemap()?.id).toBe('amazon-standard');
    expect(control.getState().error).toBeUndefined();
  });

  it('does not roll back a keyless style basemap on a transient tile error', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      includeDefaultBasemaps: false,
      collapsed: false,
      basemaps: [
        {
          id: 'base-style',
          name: 'Base Style',
          provider: 'test',
          type: 'style',
          source: { type: 'style', url: 'https://example.com/base.json' },
        },
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));
    await control.setBasemap('base-style');

    // A keyless provider is not subject to the credential heuristic, so even a
    // 403 on an unrelated resource leaves it active.
    map.fire('error', { error: { url: 'https://example.com/tiles/9/9/9.png', status: 403 } });

    expect(control.getActiveBasemap()?.id).toBe('base-style');
    expect(control.getState().error).toBeUndefined();
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
    await flushAsync();
    fireEvent.click(screen.getByText('Two Imagery'));
    await flushAsync();

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
    await flushAsync();
    fireEvent.click(screen.getByText('Two Imagery'));
    await flushAsync();

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
    await flushAsync();
    await flushAsync();

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

// Reads the source spec the control handed to map.addSource for a basemap id.
function lastSourceFor(map: ReturnType<typeof createMockMap>['map'], basemapId: string) {
  const sourceId = `maplibre-basemap-control-source-${basemapId}`;
  const call = [...map.addSource.mock.calls].reverse().find((args) => args[0] === sourceId);
  return call?.[1] as { tiles?: string[]; url?: string } | undefined;
}

function lastLayerFor(map: ReturnType<typeof createMockMap>['map'], basemapId: string) {
  const call = [...map.addLayer.mock.calls].reverse().find((args) => args[0]?.id === basemapId);
  return call?.[0] as
    | { id: string; type: string; 'source-layer'?: string; paint?: Record<string, unknown> }
    | undefined;
}

describe('BasemapControl traffic overlays', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    document.body.innerHTML = '';
    globalThis.fetch = originalFetch;
  });

  it('reports a missing TomTom key and skips adding the layer', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({ collapsed: false, allowMultiple: true });
    controlCorner.appendChild(control.onAdd(map as never));

    await expect(control.addBasemap('tomtom-traffic-flow-relative')).rejects.toThrow(
      /TomTom API key/,
    );
    expect(control.getState().error).toMatch(/TomTom API key/);
    expect(lastSourceFor(map, 'tomtom-traffic-flow-relative')).toBeUndefined();
    // The missing-credential error reveals the provider settings and a help link.
    expect(screen.getByText('Get a TomTom API key')).toBeTruthy();
  });

  it('substitutes the TomTom API key into the raster tiles', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      collapsed: false,
      allowMultiple: true,
      tomtomApiKey: 'tt-secret',
    });
    controlCorner.appendChild(control.onAdd(map as never));

    await control.addBasemap('tomtom-traffic-flow-relative');

    expect(lastSourceFor(map, 'tomtom-traffic-flow-relative')?.tiles?.[0]).toBe(
      'https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=tt-secret',
    );
    expect(control.isBasemapActive('tomtom-traffic-flow-relative')).toBe(true);
  });

  it('substitutes the HERE API key into the raster tiles', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      collapsed: false,
      allowMultiple: true,
      hereApiKey: 'here-secret',
    });
    controlCorner.appendChild(control.onAdd(map as never));

    await control.addBasemap('here-traffic-flow');

    expect(lastSourceFor(map, 'here-traffic-flow')?.tiles?.[0]).toBe(
      'https://traffic.maps.hereapi.com/v3/flow/mc/{z}/{x}/{y}/png?apiKey=here-secret',
    );
  });

  it('renders Mapbox traffic as a vector overlay pointed at the token-authorized TileJSON', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({
      collapsed: false,
      allowMultiple: true,
      mapboxAccessToken: 'pk.test',
    });
    controlCorner.appendChild(control.onAdd(map as never));

    await control.addBasemap('mapbox-traffic');

    expect(lastSourceFor(map, 'mapbox-traffic')?.url).toBe(
      'https://api.mapbox.com/v4/mapbox.mapbox-traffic-v1.json?secure&access_token=pk.test',
    );
    const layer = lastLayerFor(map, 'mapbox-traffic');
    expect(layer?.type).toBe('line');
    expect(layer?.['source-layer']).toBe('traffic');
    expect(layer?.paint?.['line-color']).toBeDefined();
  });

  it('reports a missing Mapbox token for the traffic overlay', async () => {
    const { map, controlCorner } = createMockMap();
    const control = new BasemapControl({ collapsed: false, allowMultiple: true });
    controlCorner.appendChild(control.onAdd(map as never));

    await expect(control.addBasemap('mapbox-traffic')).rejects.toThrow(/Mapbox access token/);
    expect(lastSourceFor(map, 'mapbox-traffic')).toBeUndefined();
  });

  it('creates a Google tile session and substitutes the token, caching it across adds', async () => {
    const { map, controlCorner } = createMockMap();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ session: 'sess-123', expiry: String(Math.floor(Date.now() / 1000) + 3600) }),
      text: async () => '',
    }));
    globalThis.fetch = fetchMock as never;

    const control = new BasemapControl({
      collapsed: false,
      allowMultiple: true,
      googleMapsApiKey: 'g-secret',
    });
    controlCorner.appendChild(control.onAdd(map as never));

    await control.addBasemap('google-traffic');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://tile.googleapis.com/v1/createSession?key=g-secret');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({
      mapType: 'roadmap',
      layerTypes: ['layerTraffic'],
      overlay: true,
    });
    expect(lastSourceFor(map, 'google-traffic')?.tiles?.[0]).toBe(
      'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=sess-123&key=g-secret',
    );

    // Re-adding reuses the cached session token instead of creating a new one.
    await control.removeBasemap('google-traffic');
    await control.addBasemap('google-traffic');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a Google session failure with the API error message', async () => {
    const { map, controlCorner } = createMockMap();
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({}),
      text: async () => JSON.stringify({ error: { message: 'Map Tiles API has not been used' } }),
    })) as never;

    const control = new BasemapControl({
      collapsed: false,
      allowMultiple: true,
      googleMapsApiKey: 'g-secret',
    });
    controlCorner.appendChild(control.onAdd(map as never));

    await expect(control.addBasemap('google-traffic')).rejects.toThrow(/Map Tiles API/);
    expect(control.getState().error).toMatch(/HTTP 403/);
  });

  it('uses the keyless xyz fallback for the base Google basemaps without a key', async () => {
    const { map, controlCorner } = createMockMap();
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as never;

    const control = new BasemapControl({ collapsed: false, allowMultiple: true });
    controlCorner.appendChild(control.onAdd(map as never));

    await control.addBasemap('google-satellite');

    // No Map Tiles API session request is made when there is no key.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastSourceFor(map, 'google-satellite')?.tiles?.[0]).toBe(
      'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    );
  });

  it('upgrades the base Google basemaps to the Map Tiles API when a key is set', async () => {
    const { map, controlCorner } = createMockMap();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        session: 'sess-hybrid',
        expiry: String(Math.floor(Date.now() / 1000) + 3600),
      }),
      text: async () => '',
    }));
    globalThis.fetch = fetchMock as never;

    const control = new BasemapControl({
      collapsed: false,
      allowMultiple: true,
      googleMapsApiKey: 'g-secret',
    });
    controlCorner.appendChild(control.onAdd(map as never));

    await control.addBasemap('google-hybrid');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://tile.googleapis.com/v1/createSession?key=g-secret');
    expect(JSON.parse(init.body as string)).toMatchObject({
      mapType: 'satellite',
      layerTypes: ['layerRoadmap'],
    });
    expect(lastSourceFor(map, 'google-hybrid')?.tiles?.[0]).toBe(
      'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=sess-hybrid&key=g-secret',
    );
  });

  it('offers an optional key input after a base Google basemap falls back to public tiles', async () => {
    const { map, controlCorner } = createMockMap();
    globalThis.fetch = vi.fn() as never;

    const control = new BasemapControl({ collapsed: false, allowMultiple: true });
    controlCorner.appendChild(control.onAdd(map as never));

    await control.addBasemap('google-satellite');

    // The public fallback tiles are applied, and the optional key prompt shows
    // an API key input the user can fill in to upgrade.
    expect(lastSourceFor(map, 'google-satellite')?.tiles?.[0]).toBe(
      'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    );
    expect(document.querySelector('.basemap-control-optional-key')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Google Maps API key')).toBeTruthy();
  });

  it('upgrades to the Map Tiles API when a key is entered in the optional prompt', async () => {
    const { map, controlCorner } = createMockMap();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        session: 'sess-opt',
        expiry: String(Math.floor(Date.now() / 1000) + 3600),
      }),
      text: async () => '',
    }));
    globalThis.fetch = fetchMock as never;

    const control = new BasemapControl({ collapsed: false, allowMultiple: true });
    controlCorner.appendChild(control.onAdd(map as never));

    await control.addBasemap('google-satellite');
    expect(fetchMock).not.toHaveBeenCalled();

    const input = screen.getByLabelText<HTMLInputElement>('Google Maps API key');
    fireEvent.input(input, { target: { value: 'g-secret' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await flushAsync();
    await flushAsync();

    // The basemap is re-applied with the authorized Map Tiles API tiles, and the
    // now-redundant optional prompt disappears.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastSourceFor(map, 'google-satellite')?.tiles?.[0]).toBe(
      'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=sess-opt&key=g-secret',
    );
    expect(document.querySelector('.basemap-control-optional-key')).toBeNull();
  });

  it('does not show the optional key prompt when a Google key is configured', async () => {
    const { map, controlCorner } = createMockMap();
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        session: 'sess-z',
        expiry: String(Math.floor(Date.now() / 1000) + 3600),
      }),
      text: async () => '',
    })) as never;

    const control = new BasemapControl({
      collapsed: false,
      allowMultiple: true,
      googleMapsApiKey: 'g-secret',
    });
    controlCorner.appendChild(control.onAdd(map as never));

    await control.addBasemap('google-satellite');

    expect(document.querySelector('.basemap-control-optional-key')).toBeNull();
  });
});
