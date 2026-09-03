# MapLibre GL Basemap Control

A MapLibre GL JS control for searching and switching public basemaps. It keeps the standard compact MapLibre control button, opens a floating searchable panel, and can be used from vanilla TypeScript or React.

[![npm version](https://img.shields.io/npm/v/maplibre-gl-basemap-control.svg)](https://www.npmjs.com/package/maplibre-gl-basemap-control)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Search-first basemap picker inspired by QuickMapServices
- Built-in catalog for common public basemaps, MapTiler styles, Amazon Location styles, Mapbox styles, Maptoolkit styles, Protomaps styles, and Stadia Maps basemaps
- Tianditu, Amap, and Tencent basemaps, served from inside mainland China
- Stackable traffic overlays for TomTom, HERE, Mapbox, and Google
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
and Navigation Night. Protomaps styles include Light, Dark, White, Black, Grayscale, and Contrast.

MapTiler, Amazon Location, and Protomaps styles require API keys. Mapbox styles require an access
token. Users can enter keys and tokens in the dedicated API keys view, opened from the key button in
the panel header, or you can provide them when creating the control. When a basemap is selected
before its key
is set, the control surfaces the error and the matching credential field inline, before any
destructive style change, so the missing key can be entered and the basemap retried with Enter.

```typescript
const control = new BasemapControl({
  defaultBasemapId: 'maptiler-streets',
  mapTilerApiKey: 'YOUR_MAPTILER_API_KEY',
  cartoApiKey: 'YOUR_CARTO_API_KEY',
  amazonApiKey: 'YOUR_AMAZON_LOCATION_API_KEY',
  awsRegion: 'us-east-1',
  mapboxAccessToken: 'YOUR_MAPBOX_ACCESS_TOKEN',
  protomapsApiKey: 'YOUR_PROTOMAPS_API_KEY',
  stadiaApiKey: 'YOUR_STADIA_MAPS_API_KEY',
  tiandituApiKey: 'YOUR_TIANDITU_API_KEY',
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

Protomaps style URLs follow this form:

```text
https://api.protomaps.com/styles/v5/{styleId}/en.json?key={api-key}
```

### Stadia Maps and Stamen

The catalog ships Stadia Maps' own styles (Alidade Smooth, Alidade Smooth Dark, Alidade Satellite,
Outdoors, OSM Bright) and the Stadia x Stamen classics (Toner, Toner Lite, Toner Background, Toner
Labels, Terrain, Terrain Background, Terrain Labels, Watercolor). Stadia has hosted the Stamen
tilesets since 2023.

These are raster tiles that take the key directly on each tile URL:

```text
https://tiles.stadiamaps.com/tiles/{slug}/{z}/{x}/{y}.png?api_key={api-key}
```

Alidade Satellite and Stamen Watercolor are served as `.jpg` instead. The `_labels` layers are
transparent overlays, so pair them with `allowMultiple: true` to stack them over a base layer.

> **Note.** Stadia also supports keyless access from allowlisted domains (localhost included), but
> this control always sends `api_key`, so a key is required here. Set `stadiaApiKey` or enter it in
> the panel's API keys view.

### China Basemaps

Most of the catalog is hosted outside mainland China with no presence inside it, so for users there
OpenStreetMap, OpenFreeMap, Protomaps, Carto, Google, and Mapbox range from slow to unreachable. The
catalog ships three providers that are served from inside China:

| Basemap id | Provider | Datum | Credential |
|------------|----------|-------|------------|
| `tianditu-vector`, `tianditu-imagery`, `tianditu-terrain` and their `-labels` overlays | Tianditu (天地图) | CGCS2000 | `tiandituApiKey` |
| `amap-street`, `amap-satellite`, `amap-labels` | Amap (高德地图) | GCJ-02 | none |
| `tencent-street`, `tencent-dark` | Tencent Maps (腾讯地图) | GCJ-02 | none |

They are searchable by their Chinese names as well as their English ones, so typing `天地图`, `高德`,
or `腾讯` into the panel's filter finds them.

> **The datum matters more than the speed.** Chinese law requires public map services to publish in
> GCJ-02, an offset datum that displaces features by roughly 100-700 m from WGS84. Neither this
> control nor MapLibre applies the shift, so WGS84 data laid over Amap or Tencent will visibly
> misalign. **Tianditu is the exception**: it publishes in CGCS2000, which is close enough to WGS84
> for web mapping, so ordinary data overlays correctly. Prefer Tianditu whenever you are also
> rendering your own data; reach for Amap or Tencent when the basemap is the whole point, or convert
> your data to GCJ-02 first.

Tianditu is China's official National Platform for Common Geospatial Information Services. Register
a free key at [console.tianditu.gov.cn](https://console.tianditu.gov.cn/api/key), then set
`tiandituApiKey` or enter it in the panel's API keys view. Its layers ride the `DataServer`
endpoint, the xyz-shaped form of its WMTS services:

```text
https://t{0-7}.tianditu.gov.cn/DataServer?T={layer}&x={x}&y={y}&l={z}&tk={api-key}
```

Tianditu splits every basemap from its labels, so the `-labels` overlays are separate transparent
layers. Pair them with `allowMultiple: true` to stack them over their base:

```typescript
const control = new BasemapControl({
  allowMultiple: true,
  tiandituApiKey: 'YOUR_TIANDITU_API_KEY',
  defaultBasemapId: 'tianditu-vector',
});
await control.addBasemap('tianditu-vector-labels');
```

The same applies to `amap-labels`, a transparent roads-and-labels overlay meant to sit on top of
`amap-satellite`. Note that `tianditu-terrain` and `tianditu-terrain-labels` are only published to
zoom 14, where the vector and imagery layers reach 18, and Amap serves a "no imagery" placeholder
rather than a 404 past zoom 18, so `amap-satellite` caps there and lets MapLibre overzoom.

> **Terms of use.** Tianditu's key-based access is the sanctioned route and the one to build on. The
> Amap and Tencent tile endpoints are widely used but are not documented public APIs, and carry the
> same caveat as the keyless Google tiles below: fine for development and demos, but the operators
> may rate-limit, change, or block them at any time. Obtain a commercial key from the provider before
> shipping either one.

### Traffic Overlays

The catalog ships real-time traffic overlays in the `Traffic` category. They are
stackable overlays rather than full basemaps, so enable `allowMultiple: true` (or
toggle "Add basemaps" in the panel) to lay them on top of any basemap. Click an
active traffic layer again to remove it.

| Basemap id | Provider | Credential |
|------------|----------|------------|
| `tomtom-traffic-flow-relative`, `tomtom-traffic-flow-absolute`, `tomtom-traffic-flow-relative-delay` | TomTom | `tomtomApiKey` |
| `here-traffic-flow` | HERE | `hereApiKey` |
| `mapbox-traffic` | Mapbox | `mapboxAccessToken` |
| `google-traffic` | Google | `googleMapsApiKey` |

```typescript
const control = new BasemapControl({
  allowMultiple: true,
  tomtomApiKey: 'YOUR_TOMTOM_API_KEY',
  hereApiKey: 'YOUR_HERE_API_KEY',
  mapboxAccessToken: 'YOUR_MAPBOX_ACCESS_TOKEN',
  googleMapsApiKey: 'YOUR_GOOGLE_MAPS_API_KEY',
});
```

The TomTom and HERE overlays are transparent raster flow tiles; Mapbox Traffic is
a vector overlay colored by congestion level. Google Traffic uses the
[Map Tiles API](https://developers.google.com/maps/documentation/tile/session_tokens):
the control creates a tile session (with `layerTypes: ['layerTraffic']`) using your
key, caches the session token until it expires, then loads the traffic tiles. The
key must have the Map Tiles API enabled.

> **Troubleshooting `API_KEY_SERVICE_BLOCKED`** ("Requests to this API tile method
> ...Bootstrap are blocked"): this is a key restriction, not project API
> enablement. Enabling the Map Tiles API on the project is not enough if the key
> itself has an API allow-list. In Cloud Console go to **APIs & Services →
> Credentials → your key → API restrictions** and either choose "Don't restrict
> key" or add **Map Tiles API** to the allowed list, then save (changes can take a
> few minutes to propagate). Make sure billing is enabled on the project too.

The same `googleMapsApiKey` also upgrades the base Google basemaps
(`google-maps`, `google-satellite`, `google-terrain`, `google-hybrid`). By
default these use the public keyless `mt1.google.com` xyz tiles, so they work out
of the box; when a key is set they load from the authorized Map Tiles API instead
(via a tile session, like Google Traffic).

In the catalog definition this is the split between `source.tiles` and
`source.sessionTiles`: `tiles` always holds the public keyless template, so
reading `source.tiles` without a key gives a directly usable URL, while
`sessionTiles` holds the Map Tiles API template (with its `{session}` and
`{api-key}` placeholders) that is only used once a key is configured. Basemaps
that cannot work keylessly, such as `google-traffic`, have no `sessionTiles` and
keep the session template in `tiles`.

> **Licensing caveat.** The keyless `mt1.google.com` tiles are Google Maps'
> internal endpoints. They are **not** covered by any public or open license, and
> accessing Google map content outside an official Google Maps Platform API
> violates the [Google Maps Platform Terms of Service](https://cloud.google.com/maps-platform/terms).
> They are convenient for local development and demos, but Google may rate-limit,
> change, or block them at any time. For production use, set a `googleMapsApiKey`
> so these basemaps use the authorized [Map Tiles API](https://developers.google.com/maps/documentation/tile)
> (which requires the Map Tiles API enabled and billing on your project).

## Maptoolkit Styles

The catalog ships the seven [Maptoolkit](https://www.maptoolkit.org) vector styles. They need no
API key and load straight from `https://styles.maptoolkit.org/{styleId}.json`:

| Basemap id | Style | Category |
|------------|-------|----------|
| `maptoolkit-summer` | `summer` | Outdoor |
| `maptoolkit-light` | `light` | Light |
| `maptoolkit-hiking` | `hiking` | Outdoor |
| `maptoolkit-cycling` | `cycling` | Cycling |
| `maptoolkit-winter` | `winter` | Outdoor |
| `maptoolkit-dark` | `dark` | Dark |
| `maptoolkit-street` | `street` | Street |

> **Attribution.** The Maptoolkit style JSONs carry no `attribution` on their sources, so the catalog
> supplies the required "© Maptoolkit © OSM" credit links. Maptoolkit additionally requires the
> Maptoolkit logo (at least 24px tall) to be visible and unobstructed on the map; add it to your own
> UI, since the control cannot render it for you.

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
| `cartoApiKey` | `string` | `undefined` | Initial CARTO API key for built-in CARTO raster basemaps |
| `amazonApiKey` | `string` | `undefined` | Initial Amazon Location API key for built-in Amazon styles |
| `awsRegion` | `string` | `'us-east-1'` | AWS region for built-in Amazon Location styles |
| `mapboxAccessToken` | `string` | `undefined` | Initial Mapbox access token for built-in Mapbox styles and the Mapbox Traffic overlay |
| `protomapsApiKey` | `string` | `undefined` | Initial Protomaps API key for built-in Protomaps styles |
| `stadiaApiKey` | `string` | `undefined` | Initial Stadia Maps API key for built-in Stadia and Stadia x Stamen basemaps |
| `tiandituApiKey` | `string` | `undefined` | Initial Tianditu API key (`tk`) for the built-in Tianditu basemaps |
| `tomtomApiKey` | `string` | `undefined` | Initial TomTom API key for the TomTom Traffic overlays |
| `hereApiKey` | `string` | `undefined` | Initial HERE API key for the HERE Traffic overlay |
| `googleMapsApiKey` | `string` | `undefined` | Initial Google Maps API key (Map Tiles API) for the Google Traffic overlay and the base Google Maps/Satellite/Terrain/Hybrid basemaps (which fall back to keyless tiles without a key) |
| `basemaps` | `BasemapDefinition[]` | `[]` | Custom basemaps to add or use |
| `providers` | `BasemapProvider[]` | `[]` | Custom provider labels |
| `includeDefaultBasemaps` | `boolean` | `true` | Include the built-in public catalog |
| `defaultBasemapId` | `string` | `undefined` | Basemap to apply after the control is added |
| `allowMultiple` | `boolean` | `false` | Stack raster basemaps instead of replacing the active one |
| `showMultipleToggle` | `boolean` | `true` | Show the in-panel toggle that switches between adding and replacing |
| `resizable` | `boolean` | `true` | Allow resizing the panel by dragging its bottom-left or bottom-right corner |
| `confirmStyleReplace` | `(confirmation) => boolean \| Promise<boolean>` | `undefined` | Confirm before a style basemap replaces stacked raster basemaps (only invoked in `allowMultiple` mode with at least one raster stacked); return `false` to cancel |

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

Because that swap is destructive in stack mode, you can pass `confirmStyleReplace`
to confirm before the stacked rasters are discarded. It is only invoked in
`allowMultiple` mode when at least one raster basemap is currently stacked, and
receives the `{ basemap, replacedBasemapIds }` it is about to replace. Return (or
resolve to) `false` to cancel and keep the current basemaps.

```typescript
const control = new BasemapControl({
  allowMultiple: true,
  confirmStyleReplace: ({ basemap, replacedBasemapIds }) =>
    window.confirm(
      `Switching to "${basemap.name}" will remove ${replacedBasemapIds.length} stacked basemap(s). Continue?`,
    ),
});
```

### Methods

- `setBasemap(id)` - Apply a basemap and remove the previous plugin-managed basemap
- `addBasemap(id)` - Add a raster basemap as an additional overlay (style basemaps replace instead)
- `removeBasemap(id)` - Remove a previously added managed raster basemap
- `toggleBasemap(id)` - Add the raster basemap if inactive, otherwise remove it
- `isBasemapActive(id)` - Whether the basemap is currently active
- `setMapTilerApiKey(apiKey)` - Set or update the MapTiler API key used by MapTiler styles
- `setCartoApiKey(apiKey)` - Set or update the CARTO API key used by CARTO raster basemaps
- `setAmazonCredentials(apiKey, awsRegion)` - Set or update Amazon Location credentials
- `setMapboxAccessToken(accessToken)` - Set or update the Mapbox access token
- `setProtomapsApiKey(apiKey)` - Set or update the Protomaps API key used by Protomaps styles
- `setStadiaApiKey(apiKey)` - Set or update the Stadia Maps API key used by Stadia basemaps
- `setTiandituApiKey(apiKey)` - Set or update the Tianditu API key used by Tianditu basemaps
- `setTomTomApiKey(apiKey)` - Set or update the TomTom API key used by TomTom Traffic overlays
- `setHereApiKey(apiKey)` - Set or update the HERE API key used by the HERE Traffic overlay
- `setGoogleMapsApiKey(apiKey)` - Set or update the Google Maps API key used by the Google Traffic overlay and the base Google basemaps
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
