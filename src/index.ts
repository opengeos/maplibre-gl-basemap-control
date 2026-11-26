import './lib/styles/basemap-control.css';

export { BasemapControl } from './lib/core/BasemapControl';
export {
  BASEMAP_PANEL_CLASS,
  BASEMAP_PANEL_SELECTOR,
  BASEMAP_ROW_CLASS,
  BASEMAP_ROW_ID_ATTRIBUTE,
  BASEMAP_ROW_SELECTOR,
} from './lib/core/dom';
export {
  DEFAULT_BASEMAPS,
  DEFAULT_BASEMAP_PROVIDERS,
  combineProviders,
  createBasemapCatalog,
  filterBasemaps,
  getBasemapCategories,
  resolveBasemapProviders,
} from './lib/core/catalog';

export type {
  BasemapChangeEvent,
  BasemapControlEvent,
  BasemapControlEventHandler,
  BasemapControlEventPayload,
  BasemapControlOptions,
  BasemapControlPosition,
  BasemapControlState,
  BasemapDefinition,
  BasemapErrorEvent,
  BasemapProvider,
  BasemapRemoveEvent,
  BasemapSourceType,
  ManagedRasterBasemap,
  RasterBasemapSource,
  StyleBasemapSource,
  StyleReplaceConfirmation,
} from './lib/core/types';

export {
  clamp,
  formatNumericValue,
  generateId,
  debounce,
  throttle,
  classNames,
} from './lib/utils';
