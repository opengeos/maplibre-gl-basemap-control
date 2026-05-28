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
    fireEvent.input(screen.getByLabelText('Search basemaps'), { target: { value: 'imagery' } });

    expect(screen.queryByText('One Streets')).toBeNull();
    expect(screen.getByText('Two Imagery')).toBeTruthy();
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
    expect(map.removeLayer).toHaveBeenCalledWith('maplibre-basemap-control-layer-one');
    expect(map.removeSource).toHaveBeenCalledWith('maplibre-basemap-control-source-one');
    expect(map.addLayer).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'maplibre-basemap-control-layer-two' }),
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
});
