# MapLibre GL Basemap Control

A MapLibre GL JS control for searching and switching public basemaps. It keeps the standard compact MapLibre control button, opens a floating searchable panel, and can be used from vanilla TypeScript or React.

[![npm version](https://img.shields.io/npm/v/maplibre-gl-basemap-control.svg)](https://www.npmjs.com/package/maplibre-gl-basemap-control)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Search-first basemap picker inspired by QuickMapServices
- Built-in catalog for common public basemaps, MapTiler styles, Amazon Location styles, and Mapbox styles
- Custom basemap and provider definitions
- MapLibre `IControl` implementation
- React wrapper and state hook
- Vite library build with ESM/CJS outputs and TypeScript declarations
- Docker and GitHub Actions examples workflow

## Installation

```bash
npm install maplibre-gl-basemap-control maplibre-gl
```

## Vanilla TypeScript

```typescript
import maplibregl from 'maplibre-gl';
import { BasemapControl } from 'maplibre-gl-basemap-control';
import 'maplibre-gl-basemap-control/style.css';

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {},
    layers: [{ id: 'background', type: 'background' }],
  },
  center: [0, 0],
  zoom: 2,
});

map.on('load', () => {
  const basemaps = new BasemapControl({
    title: 'Basemaps',
    collapsed: true,
    defaultBasemapId: 'carto-positron',
  });

  map.addControl(basemaps, 'top-right');
});
```

## React

```tsx
import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map } from 'maplibre-gl';
import { BasemapControlReact, useBasemapState } from 'maplibre-gl-basemap-control/react';
import 'maplibre-gl-basemap-control/style.css';

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
      style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] },
      center: [0, 0],
      zoom: 2,
    });

    mapInstance.on('load', () => setMap(mapInstance));
    return () => mapInstance.remove();
  }, []);

  return (
    <>
      <div ref={mapContainer} />
      {map && (
        <BasemapControlReact
          map={map}
          collapsed={state.collapsed}
          activeBasemapId={state.activeBasemapId}
          onStateChange={setState}
          onBasemapChange={(basemap) => console.log(basemap.name)}
        />
      )}
    </>
  );
}
```

## Custom Basemaps

The built-in catalog can be extended or replaced.

```typescript
import type { BasemapDefinition } from 'maplibre-gl-basemap-control';

const customBasemaps: BasemapDefinition[] = [
  {
    id: 'example-raster',
    name: 'Example Raster',
    provider: 'example',
    type: 'raster',
    category: 'Custom',
    attribution: '&copy; Example Provider',
    source: {
      type: 'raster',
      tiles: ['https://tiles.example.com/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
    },
    tags: ['custom', 'street'],
  },
];

const control = new BasemapControl({
  basemaps: customBasemaps,
  providers: [{ id: 'example', name: 'Example Provider', category: 'Custom' }],
  includeDefaultBasemaps: true,
});
```

Set `includeDefaultBasemaps: false` to use only your supplied catalog.

## Keyed Provider Styles

The built-in catalog includes MapTiler styles such as Streets, Base, Dataviz, Outdoor, Topo,
Satellite Hybrid, Satellite Plain, Aquarelle, Backdrop, Landscape, Ocean, Toner, OpenStreetMap, and
Winter. It also includes Amazon Location styles: Standard, Monochrome, Hybrid, and Satellite.
Mapbox styles include Streets, Outdoors, Light, Dark, Satellite, Satellite Streets, Navigation Day,
and Navigation Night.

MapTiler and Amazon Location styles require API keys. Mapbox styles require an access token. Users
can enter keys and tokens in the collapsible provider settings section in the control panel, or you
can provide them when creating the control.

```typescript
const control = new BasemapControl({
  defaultBasemapId: 'maptiler-streets',
  mapTilerApiKey: 'YOUR_MAPTILER_API_KEY',
  amazonApiKey: 'YOUR_AMAZON_LOCATION_API_KEY',
  awsRegion: 'us-east-1',
  mapboxAccessToken: 'YOUR_MAPBOX_ACCESS_TOKEN',
});
```

The default MapTiler style URLs follow this form:

```text
https://api.maptiler.com/maps/{mapId}/style.json?key={api-key}
```

Amazon Location style URLs follow this form:

```text
https://maps.geo.{aws-region}.amazonaws.com/v2/styles/{mapStyle}/descriptor?key={api-key}
```

Mapbox style URLs follow this form:

```text
https://api.mapbox.com/styles/v1/mapbox/{styleId}?access_token={api-key}
```

## API

### BasemapControl Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `collapsed` | `boolean` | `true` | Whether the panel starts collapsed |
| `position` | `string` | `'top-right'` | Preferred control position |
| `title` | `string` | `'Basemaps'` | Panel title and button label |
| `panelWidth` | `number` | `340` | Floating panel width in pixels |
| `className` | `string` | `''` | Extra class for the control button container |
| `mapTilerApiKey` | `string` | `undefined` | Initial MapTiler API key for built-in MapTiler styles |
| `amazonApiKey` | `string` | `undefined` | Initial Amazon Location API key for built-in Amazon styles |
| `awsRegion` | `string` | `'us-east-1'` | AWS region for built-in Amazon Location styles |
| `mapboxAccessToken` | `string` | `undefined` | Initial Mapbox access token for built-in Mapbox styles |
| `basemaps` | `BasemapDefinition[]` | `[]` | Custom basemaps to add or use |
| `providers` | `BasemapProvider[]` | `[]` | Custom provider labels |
| `includeDefaultBasemaps` | `boolean` | `true` | Include the built-in public catalog |
| `defaultBasemapId` | `string` | `undefined` | Basemap to apply after the control is added |
| `allowMultiple` | `boolean` | `false` | Stack raster basemaps instead of replacing the active one |
| `showMultipleToggle` | `boolean` | `true` | Show the in-panel toggle that switches between adding and replacing |
| `resizable` | `boolean` | `true` | Allow resizing the panel by dragging its bottom-left or bottom-right corner |

### Multiple Basemaps

By default, selecting a basemap replaces the active one. Set `allowMultiple: true`
to stack raster basemaps instead: each click adds the selected raster basemap as
an additional overlay, and clicking an already-active raster basemap removes it.
This lets a project hold several raster basemaps at once and switch between them by
toggling the entries in the panel.

```typescript
const control = new BasemapControl({
  allowMultiple: true,
});
```

The panel also shows an **Add basemaps** toggle so users can switch between adding
and replacing at runtime. Hide it with `showMultipleToggle: false`.

### Resizable Panel

The panel can be resized by dragging either of its bottom corners (bottom-left or
bottom-right). The resized width and height are reflected in `state.panelWidth` and
`state.panelHeight`. Set `resizable: false` to disable the handles.

Style basemaps cannot stack because they replace the entire map style, so selecting
a style basemap always replaces the active basemaps (and clears any stacked raster
overlays). Use the `before_id` input to control where each raster basemap is
inserted relative to existing layers.

### Methods

- `setBasemap(id)` - Apply a basemap and remove the previous plugin-managed basemap
- `addBasemap(id)` - Add a raster basemap as an additional overlay (style basemaps replace instead)
- `removeBasemap(id)` - Remove a previously added managed raster basemap
- `toggleBasemap(id)` - Add the raster basemap if inactive, otherwise remove it
- `isBasemapActive(id)` - Whether the basemap is currently active
- `setMapTilerApiKey(apiKey)` - Set or update the MapTiler API key used by MapTiler styles
- `setAmazonCredentials(apiKey, awsRegion)` - Set or update Amazon Location credentials
- `setMapboxAccessToken(accessToken)` - Set or update the Mapbox access token
- `getActiveBasemap()` - Return the most recently selected basemap definition
- `getActiveBasemaps()` - Return all currently active basemap definitions
- `getBasemaps()` - Return the catalog
- `setBasemaps(basemaps)` - Replace the catalog
- `toggle()`, `expand()`, `collapse()` - Control panel visibility
- `getState()`, `setState(state)` - Read or update UI state
- `on(event, handler)`, `off(event, handler)` - Subscribe to events
- `getMap()`, `getContainer()` - Access MapLibre/control internals

The panel includes a `before_id` input for raster basemap insertion. Leave it empty or set it to
`none` to add the basemap above existing layers, or enter a MapLibre layer id to insert the basemap
before that layer.

### Events

- `basemapchange` (includes a `mode` of `'replace'` or `'add'`)
- `basemapremove`
- `error`
- `collapse`
- `expand`
- `statechange`

## Attribution

Built-in basemaps include attribution strings in their MapLibre source definitions. Consumers are responsible for confirming that selected providers and usage volumes match their project requirements.

## Development

```bash
npm install
npm run dev
npm test
npm run build
npm run build:examples
```

## Docker

```bash
docker build -t maplibre-gl-basemap-control .
docker run -p 8080:80 maplibre-gl-basemap-control
```

Open http://localhost:8080/maplibre-gl-basemap-control/ to view the examples.
