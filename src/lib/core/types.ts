import type { Map } from 'maplibre-gl';

export type BasemapSourceType = 'raster' | 'vector-style' | 'style' | 'vector-overlay';

export type BasemapControlPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface BasemapProvider {
  id: string;
  name: string;
  category?: string;
  icon?: string;
}

export interface RasterBasemapSource {
  type: 'raster';
  tiles: string[];
  tileSize?: number;
  minzoom?: number;
  maxzoom?: number;
  scheme?: 'xyz' | 'tms';
  /**
   * When set, the tile URLs use a Google Map Tiles API session token (the
   * `{session}` placeholder). The control creates the session lazily via the
   * `createSession` endpoint using the configured `googleMapsApiKey`, caches it
   * until it expires, then substitutes the token into the tiles. Used by the
   * Google Traffic overlay, whose tiles have no static URL.
   */
  googleSession?: GoogleSessionConfig;
}

/**
 * Configuration for a Google Map Tiles API session. Mirrors the body of the
 * `createSession` request. A traffic overlay uses `mapType: 'roadmap'`,
 * `layerTypes: ['layerTraffic']`, and `overlay: true` so the tiles are a
 * transparent traffic layer that can stack on top of any basemap.
 */
export interface GoogleSessionConfig {
  mapType: 'roadmap' | 'satellite' | 'terrain';
  layerTypes?: string[];
  overlay?: boolean;
  language?: string;
  region?: string;
}

export interface StyleBasemapSource {
  type: 'style' | 'vector-style';
  url: string;
}

/**
 * A vector tile overlay rendered as a single MapLibre layer on top of the
 * active basemap. Used for traffic overlays that ship as a vector tileset
 * (e.g. Mapbox Traffic), where a transparent raster tile is not available and
 * the congestion is encoded as a feature property the layer paint reads.
 */
export interface VectorOverlayBasemapSource {
  type: 'vector-overlay';
  /** A `mapbox://` or TileJSON URL for the vector source. */
  url?: string;
  /** Explicit vector tile templates, used when `url` is omitted. */
  tiles?: string[];
  /** The source layer within the vector tiles to render. */
  sourceLayer: string;
  /** The kind of MapLibre layer used to render the overlay. Defaults to `line`. */
  layerType?: 'line' | 'fill' | 'circle';
  /** Paint properties applied to the rendered layer. */
  paint?: Record<string, unknown>;
  /** Layout properties applied to the rendered layer. */
  layout?: Record<string, unknown>;
  minzoom?: number;
  maxzoom?: number;
}

export interface BasemapDefinition {
  id: string;
  name: string;
  provider: string;
  type: BasemapSourceType;
  category?: string;
  description?: string;
  attribution?: string;
  source: RasterBasemapSource | StyleBasemapSource | VectorOverlayBasemapSource;
  view?: {
    center?: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
  };
  tags?: string[];
}

export interface BasemapControlOptions {
  collapsed?: boolean;
  position?: BasemapControlPosition;
  title?: string;
  panelWidth?: number;
  className?: string;
  mapTilerApiKey?: string;
  amazonApiKey?: string;
  awsRegion?: string;
  mapboxAccessToken?: string;
  /** TomTom API key, used by the TomTom Traffic Flow overlays. */
  tomtomApiKey?: string;
  /** HERE API key, used by the HERE Traffic Flow overlay. */
  hereApiKey?: string;
  /**
   * Google Maps Platform API key with the Map Tiles API enabled, used by the
   * Google Traffic overlay to create a tile session and authorize tiles.
   */
  googleMapsApiKey?: string;
  basemaps?: BasemapDefinition[];
  providers?: BasemapProvider[];
  includeDefaultBasemaps?: boolean;
  defaultBasemapId?: string;
  /**
   * When `true`, selecting a raster basemap adds it as an additional overlay
   * instead of replacing the active one, letting several raster basemaps stack
   * on the map. Clicking an already-active raster basemap removes it. Style
   * basemaps always replace the whole map style (they cannot stack). Defaults
   * to `false`, preserving the single-basemap replace behavior. The panel
   * exposes a toggle so users can switch this at runtime.
   */
  allowMultiple?: boolean;
  /**
   * Whether to show the in-panel toggle that lets users switch between adding
   * and replacing basemaps. Defaults to `true`.
   */
  showMultipleToggle?: boolean;
  /**
   * Whether the panel can be resized by dragging its bottom-left or
   * bottom-right corner. Defaults to `true`.
   */
  resizable?: boolean;
  /**
   * Called before a style basemap replaces one or more stacked raster
   * basemaps. A style basemap swaps the whole map style and so discards every
   * stacked raster overlay; this hook lets the host confirm that destructive
   * change first. Only invoked in `allowMultiple` mode when at least one raster
   * basemap is currently stacked. Return (or resolve to) `false` to cancel the
   * change and keep the current basemaps. When omitted, the style basemap
   * replaces the stack without prompting, preserving the previous behavior.
   */
  confirmStyleReplace?: (
    confirmation: StyleReplaceConfirmation,
  ) => boolean | Promise<boolean>;
}

export interface StyleReplaceConfirmation {
  /** The style basemap the user selected. */
  basemap: BasemapDefinition;
  /** Ids of the stacked raster basemaps that will be removed. */
  replacedBasemapIds: string[];
}

export interface BasemapControlState {
  collapsed: boolean;
  panelWidth: number;
  /**
   * The resized panel height in pixels. Undefined until the user resizes the
   * panel, leaving the height to fit the content.
   */
  panelHeight?: number;
  /**
   * Whether selecting a raster basemap adds it as an overlay (true) or replaces
   * the active basemap (false). Mirrors the in-panel toggle and the
   * `allowMultiple` option.
   */
  allowMultiple: boolean;
  /**
   * The most recently selected basemap. In multiple mode this is the last
   * basemap added (or the last remaining one after a removal).
   */
  activeBasemapId?: string;
  /**
   * Every currently active basemap id. In single mode this holds at most one
   * id; in multiple mode it lists all stacked raster basemaps. The control
   * highlights each id in this list.
   */
  activeBasemapIds: string[];
  query: string;
  providerFilter: string;
  categoryFilter: string;
  beforeId: string;
  loading: boolean;
  error?: string;
}

export interface ManagedRasterBasemap {
  sourceId: string;
  layerId: string;
  beforeId?: string;
}

export interface BasemapChangeEvent {
  type: 'basemapchange';
  state: BasemapControlState;
  basemap: BasemapDefinition;
  managedRaster?: ManagedRasterBasemap;
  /**
   * How the basemap was applied. `'replace'` swapped out any previously active
   * basemaps; `'add'` stacked this raster basemap on top of the existing ones
   * (only emitted when `allowMultiple` is enabled). Defaults to `'replace'`.
   */
  mode?: 'replace' | 'add';
}

export interface BasemapRemoveEvent {
  type: 'basemapremove';
  state: BasemapControlState;
  basemap: BasemapDefinition;
  managedRaster?: ManagedRasterBasemap;
}

export interface BasemapErrorEvent {
  type: 'error';
  state: BasemapControlState;
  error: Error;
  basemap?: BasemapDefinition;
}

export interface BasemapStateEvent {
  type: 'collapse' | 'expand' | 'statechange';
  state: BasemapControlState;
}

export type BasemapControlEvent =
  | BasemapStateEvent['type']
  | 'basemapchange'
  | 'basemapremove'
  | 'error';

export type BasemapControlEventPayload =
  | BasemapStateEvent
  | BasemapChangeEvent
  | BasemapRemoveEvent
  | BasemapErrorEvent;

export type BasemapControlEventHandler = (event: BasemapControlEventPayload) => void;

export interface BasemapControlReactProps extends BasemapControlOptions {
  map: Map;
  activeBasemapId?: string;
  onStateChange?: (state: BasemapControlState) => void;
  onBasemapChange?: (basemap: BasemapDefinition, state: BasemapControlState) => void;
  onBasemapRemove?: (basemap: BasemapDefinition, state: BasemapControlState) => void;
  onError?: (error: Error, state: BasemapControlState) => void;
}
