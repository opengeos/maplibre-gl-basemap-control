import maplibregl from 'maplibre-gl';
import { BasemapControl } from '../../src/index';
import '../../src/index.css';
import 'maplibre-gl/dist/maplibre-gl.css';

const map = new maplibregl.Map({
  container: 'map',
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

map.addControl(new maplibregl.NavigationControl(), 'top-right');
map.addControl(new maplibregl.FullscreenControl(), 'top-right');

map.on('load', () => {
  const basemapControl = new BasemapControl({
    title: 'Basemaps',
    collapsed: false,
    defaultBasemapId: 'carto-positron',
    panelWidth: 360,
  });

  map.addControl(basemapControl, 'top-right');

  basemapControl.on('basemapchange', (event) => {
    if (event.type === 'basemapchange') {
      console.log('Basemap changed:', event.basemap.name);
    }
  });

  basemapControl.on('error', (event) => {
    if (event.type === 'error') {
      console.error('Basemap error:', event.error);
    }
  });
});
