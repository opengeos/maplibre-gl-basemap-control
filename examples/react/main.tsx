import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl, { Map } from 'maplibre-gl';
import { BasemapControlReact, useBasemapState } from '../../src/react';
import '../../src/index.css';
import 'maplibre-gl/dist/maplibre-gl.css';

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const { state, setState } = useBasemapState({
    collapsed: false,
    activeBasemapId: 'carto-positron',
  });

  useEffect(() => {
    if (!mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': '#eef2f7',
            },
          },
        ],
      },
      center: [-98, 39],
      zoom: 3,
    });

    mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapInstance.addControl(new maplibregl.FullscreenControl(), 'top-right');
    mapInstance.on('load', () => setMap(mapInstance));

    return () => {
      mapInstance.remove();
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {map && (
        <BasemapControlReact
          map={map}
          title="Basemaps"
          collapsed={state.collapsed}
          activeBasemapId={state.activeBasemapId}
          panelWidth={360}
          onStateChange={setState}
          onBasemapChange={(basemap) => {
            console.log('Basemap changed:', basemap.name);
          }}
          onError={(error) => {
            console.error('Basemap error:', error);
          }}
        />
      )}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
