import './lib/styles/basemap-control.css';

export { BasemapControl } from './lib/core/BasemapControl';
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
