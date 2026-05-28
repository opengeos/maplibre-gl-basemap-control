import './lib/styles/basemap-control.css';

export { BasemapControl } from './lib/core/BasemapControl';
export {
  DEFAULT_BASEMAPS,
  DEFAULT_BASEMAP_PROVIDERS,
  combineProviders,
  createBasemapCatalog,
  filterBasemaps,
  getBasemapCategories,
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
  BasemapSourceType,
  RasterBasemapSource,
  StyleBasemapSource,
} from './lib/core/types';

export {
  clamp,
  formatNumericValue,
  generateId,
  debounce,
  throttle,
  classNames,
} from './lib/utils';
