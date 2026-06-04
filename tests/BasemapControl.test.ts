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
      ],
    });

    controlCorner.appendChild(control.onAdd(map as never));

    expect(screen.getByText('Provider settings')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('MapTiler API key').value).toBe('');
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
