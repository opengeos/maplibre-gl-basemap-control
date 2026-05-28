import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BasemapControlReact } from '../src/lib/core/BasemapControlReact';
import type { BasemapDefinition } from '../src/lib/core/types';

const basemaps: BasemapDefinition[] = [
  {
    id: 'one',
    name: 'One Streets',
    provider: 'test',
    type: 'raster',
    source: {
      type: 'raster',
      tiles: ['https://example.com/one/{z}/{x}/{y}.png'],
    },
  },
  {
    id: 'two',
    name: 'Two Streets',
    provider: 'test',
    type: 'raster',
    source: {
      type: 'raster',
      tiles: ['https://example.com/two/{z}/{x}/{y}.png'],
    },
  },
];

function createReactMapMock() {
  const mapContainer = document.createElement('div');
  document.body.appendChild(mapContainer);

  const sources = new Set<string>();
  const layers: Array<{ id: string; type: string }> = [{ id: 'background', type: 'background' }];
  const controls = new Set<{ onAdd: (map: unknown) => HTMLElement; onRemove: () => void }>();

  const map = {
    getContainer: vi.fn(() => mapContainer),
    on: vi.fn(),
    off: vi.fn(),
    addControl: vi.fn((control: { onAdd: (map: unknown) => HTMLElement; onRemove: () => void }) => {
      controls.add(control);
      mapContainer.appendChild(control.onAdd(map));
    }),
    removeControl: vi.fn((control: { onRemove: () => void }) => {
      control.onRemove();
      controls.delete(control as never);
    }),
    hasControl: vi.fn((control: { onRemove: () => void }) => controls.has(control as never)),
    addSource: vi.fn((id: string) => {
      sources.add(id);
    }),
    addLayer: vi.fn((layer: { id: string; type: string }) => {
      layers.push(layer);
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

  return map;
}

describe('BasemapControlReact', () => {
  it('adds and removes the MapLibre control', () => {
    const map = createReactMapMock();
    const { unmount } = render(
      <BasemapControlReact
        map={map as never}
        basemaps={basemaps}
        includeDefaultBasemaps={false}
      />,
    );

    expect(map.addControl).toHaveBeenCalledTimes(1);
    unmount();
    expect(map.removeControl).toHaveBeenCalledTimes(1);
  });

  it('applies controlled active basemap changes', async () => {
    const map = createReactMapMock();
    const { rerender } = render(
      <BasemapControlReact
        map={map as never}
        basemaps={basemaps}
        includeDefaultBasemaps={false}
        activeBasemapId="one"
      />,
    );

    await waitFor(() => {
      expect(map.addSource).toHaveBeenCalledWith(
        'maplibre-basemap-control-source-one',
        expect.any(Object),
      );
    });

    rerender(
      <BasemapControlReact
        map={map as never}
        basemaps={basemaps}
        includeDefaultBasemaps={false}
        activeBasemapId="two"
      />,
    );

    await waitFor(() => {
      expect(map.addSource).toHaveBeenCalledWith(
        'maplibre-basemap-control-source-two',
        expect.any(Object),
      );
    });
  });
});
