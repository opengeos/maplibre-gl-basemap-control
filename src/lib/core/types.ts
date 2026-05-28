import type { Map } from 'maplibre-gl';

export type BasemapSourceType = 'raster' | 'vector-style' | 'style';

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
}

export interface StyleBasemapSource {
  type: 'style' | 'vector-style';
  url: string;
}

export interface BasemapDefinition {
  id: string;
  name: string;
  provider: string;
  type: BasemapSourceType;
  category?: string;
  description?: string;
  attribution?: string;
  source: RasterBasemapSource | StyleBasemapSource;
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
  basemaps?: BasemapDefinition[];
  providers?: BasemapProvider[];
  includeDefaultBasemaps?: boolean;
  defaultBasemapId?: string;
}

export interface BasemapControlState {
  collapsed: boolean;
  panelWidth: number;
  activeBasemapId?: string;
  query: string;
  providerFilter: string;
  categoryFilter: string;
  loading: boolean;
  error?: string;
}

export interface BasemapChangeEvent {
  type: 'basemapchange';
  state: BasemapControlState;
  basemap: BasemapDefinition;
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

export type BasemapControlEvent = BasemapStateEvent['type'] | 'basemapchange' | 'error';

export type BasemapControlEventPayload =
  | BasemapStateEvent
  | BasemapChangeEvent
  | BasemapErrorEvent;

export type BasemapControlEventHandler = (event: BasemapControlEventPayload) => void;

export interface BasemapControlReactProps extends BasemapControlOptions {
  map: Map;
  activeBasemapId?: string;
  onStateChange?: (state: BasemapControlState) => void;
  onBasemapChange?: (basemap: BasemapDefinition, state: BasemapControlState) => void;
  onError?: (error: Error, state: BasemapControlState) => void;
}
