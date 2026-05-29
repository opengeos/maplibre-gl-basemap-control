import type {
  IControl,
  LayerSpecification,
  Map as MapLibreMap,
  SourceSpecification,
} from 'maplibre-gl';
import {
  createBasemapCatalog,
  filterBasemaps,
  getBasemapCategories,
  resolveBasemapProviders,
} from './catalog';
import type {
  BasemapControlEvent,
  BasemapControlEventHandler,
  BasemapControlOptions,
  BasemapControlPosition,
  BasemapControlState,
  BasemapDefinition,
  BasemapProvider,
} from './types';

const DEFAULT_OPTIONS: Required<
  Pick<
    BasemapControlOptions,
    'collapsed' | 'position' | 'title' | 'panelWidth' | 'className' | 'includeDefaultBasemaps'
  >
> = {
  collapsed: true,
  position: 'top-right',
  title: 'Basemaps',
  panelWidth: 340,
  className: '',
  includeDefaultBasemaps: true,
};

const CONTROL_SOURCE_PREFIX = 'maplibre-basemap-control-source';
const CONTROL_LAYER_PREFIX = '';

type EventHandlersMap = globalThis.Map<BasemapControlEvent, Set<BasemapControlEventHandler>>;

export class BasemapControl implements IControl {
  private _map?: MapLibreMap;
  private _mapContainer?: HTMLElement;
  private _container?: HTMLElement;
  private _panel?: HTMLElement;
  private _content?: HTMLElement;
  private _options: Required<
    Pick<
      BasemapControlOptions,
      'collapsed' | 'position' | 'title' | 'panelWidth' | 'className' | 'includeDefaultBasemaps'
    >
  > &
    Omit<
      BasemapControlOptions,
      'collapsed' | 'position' | 'title' | 'panelWidth' | 'className' | 'includeDefaultBasemaps'
    >;
  private _state: BasemapControlState;
  private _basemaps: BasemapDefinition[];
  private _providers: BasemapProvider[];
  private _eventHandlers: EventHandlersMap = new globalThis.Map();
  private _managedSourceIds: string[] = [];
  private _managedLayerIds: string[] = [];
  private _resizeHandler: (() => void) | null = null;
  private _mapResizeHandler: (() => void) | null = null;
  private _clickOutsideHandler: ((e: MouseEvent) => void) | null = null;

  constructor(options?: BasemapControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._basemaps = createBasemapCatalog(
      options?.basemaps,
      this._options.includeDefaultBasemaps,
    );
    this._providers = resolveBasemapProviders(
      this._basemaps,
      options?.providers,
      this._options.includeDefaultBasemaps,
    );
    this._state = {
      collapsed: this._options.collapsed,
      panelWidth: this._options.panelWidth,
      activeBasemapId: this._options.defaultBasemapId,
      query: '',
      providerFilter: '',
      categoryFilter: '',
      beforeId: '',
      loading: false,
    };
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._mapContainer = map.getContainer();
    this._container = this._createContainer();
    this._panel = this._createPanel();
    this._mapContainer.appendChild(this._panel);
    this._setupEventListeners();

    if (!this._state.collapsed) {
      this._panel.classList.add('expanded');
      requestAnimationFrame(() => this._updatePanelPosition());
    }

    this._renderContent();

    if (this._state.activeBasemapId) {
      this._selectBasemap(this._state.activeBasemapId);
    }

    return this._container;
  }

  onRemove(): void {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this._mapResizeHandler && this._map) {
      this._map.off('resize', this._mapResizeHandler);
      this._mapResizeHandler = null;
    }
    if (this._clickOutsideHandler) {
      document.removeEventListener('click', this._clickOutsideHandler);
      this._clickOutsideHandler = null;
    }

    this._panel?.parentNode?.removeChild(this._panel);
    this._container?.parentNode?.removeChild(this._container);

    this._map = undefined;
    this._mapContainer = undefined;
    this._container = undefined;
    this._panel = undefined;
    this._content = undefined;
    this._eventHandlers.clear();
  }

  getState(): BasemapControlState {
    return { ...this._state };
  }

  setState(newState: Partial<BasemapControlState>): void {
    this._state = { ...this._state, ...newState };
    this._renderContent();
    this._emit({ type: 'statechange', state: this.getState() });
  }

  getBasemaps(): BasemapDefinition[] {
    return [...this._basemaps];
  }

  setBasemaps(basemaps: BasemapDefinition[]): void {
    this._basemaps = [...basemaps];
    this._providers = resolveBasemapProviders(
      this._basemaps,
      this._options.providers,
      this._options.includeDefaultBasemaps,
    );
    if (
      this._state.activeBasemapId &&
      !this._basemaps.some((basemap) => basemap.id === this._state.activeBasemapId)
    ) {
      this._state = { ...this._state, activeBasemapId: undefined };
    }
    this._renderContent();
    this._emit({ type: 'statechange', state: this.getState() });
  }

  getActiveBasemap(): BasemapDefinition | undefined {
    return this._basemaps.find((basemap) => basemap.id === this._state.activeBasemapId);
  }

  async setBasemap(id: string): Promise<void> {
    const basemap = this._basemaps.find((candidate) => candidate.id === id);
    if (!basemap) {
      const error = new Error(`Basemap "${id}" was not found.`);
      this._handleError(error);
      throw error;
    }
    if (!this._map) {
      const error = new Error('BasemapControl must be added to a map before setting a basemap.');
      this._handleError(error, basemap);
      throw error;
    }

    this._state = { ...this._state, loading: true, error: undefined };
    this._renderContent();
    this._emit({ type: 'statechange', state: this.getState() });

    try {
      if (basemap.source.type === 'raster') {
        await this._waitForStyleReady();
        this._removeManagedBasemap();
        this._addRasterBasemap(basemap);
      } else {
        this._removeManagedBasemap();
        this._map.setStyle(basemap.source.url);
      }

      this._applyBasemapView(basemap);

      this._state = {
        ...this._state,
        activeBasemapId: basemap.id,
        loading: false,
        error: undefined,
      };
      this._renderContent();
      this._emit({ type: 'basemapchange', state: this.getState(), basemap });
      this._emit({ type: 'statechange', state: this.getState() });
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this._state = { ...this._state, loading: false, error: error.message };
      this._renderContent();
      this._handleError(error, basemap);
      throw error;
    }
  }

  // setBasemap rethrows after emitting the error event so callers that await
  // it can react. Internal fire-and-forget callers use this instead to avoid
  // unhandled promise rejections; the failure is still reported via `error`.
  private _selectBasemap(id: string): void {
    this.setBasemap(id).catch(() => {});
  }

  toggle(): void {
    this._state = { ...this._state, collapsed: !this._state.collapsed };

    if (this._panel) {
      if (this._state.collapsed) {
        this._panel.classList.remove('expanded');
        this._emit({ type: 'collapse', state: this.getState() });
      } else {
        this._panel.classList.add('expanded');
        this._updatePanelPosition();
        this._emit({ type: 'expand', state: this.getState() });
      }
    }

    this._emit({ type: 'statechange', state: this.getState() });
  }

  expand(): void {
    if (this._state.collapsed) this.toggle();
  }

  collapse(): void {
    if (!this._state.collapsed) this.toggle();
  }

  on(event: BasemapControlEvent, handler: BasemapControlEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  off(event: BasemapControlEvent, handler: BasemapControlEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  getMap(): MapLibreMap | undefined {
    return this._map;
  }

  getContainer(): HTMLElement | undefined {
    return this._container;
  }

  private _emit(event: Parameters<BasemapControlEventHandler>[0]): void {
    this._eventHandlers.get(event.type)?.forEach((handler) => handler(event));
  }

  private _handleError(error: Error, basemap?: BasemapDefinition): void {
    this._emit({ type: 'error', state: this.getState(), error, basemap });
    this._emit({ type: 'statechange', state: this.getState() });
  }

  private _createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = `maplibregl-ctrl maplibregl-ctrl-group basemap-control${
      this._options.className ? ` ${this._options.className}` : ''
    }`;

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'basemap-control-toggle';
    toggleBtn.type = 'button';
    toggleBtn.title = this._options.title;
    toggleBtn.setAttribute('aria-label', this._options.title);
    toggleBtn.innerHTML = `
      <span class="basemap-control-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/>
          <path d="M9 3v15"/>
          <path d="M15 6v15"/>
        </svg>
      </span>
    `;
    toggleBtn.addEventListener('click', () => this.toggle());
    container.appendChild(toggleBtn);

    return container;
  }

  private _createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'basemap-control-panel';
    panel.style.width = `${this._options.panelWidth}px`;

    const header = document.createElement('div');
    header.className = 'basemap-control-header';

    const title = document.createElement('span');
    title.className = 'basemap-control-title';
    title.textContent = this._options.title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'basemap-control-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close basemap panel');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => this.collapse());

    header.appendChild(title);
    header.appendChild(closeBtn);

    this._content = document.createElement('div');
    this._content.className = 'basemap-control-content';

    panel.appendChild(header);
    panel.appendChild(this._content);

    return panel;
  }

  private _renderContent(): void {
    if (!this._content) return;

    const categories = getBasemapCategories(this._basemaps);
    const results = this._getFilteredBasemaps();

    this._content.replaceChildren(
      this._createSearchRow(),
      this._createFilterRow(this._providers, categories),
      this._createStatus(results.length),
      this._createResults(results),
    );
  }

  private _renderFilteredResults(): void {
    if (!this._content) return;

    const results = this._getFilteredBasemaps();
    this._content.querySelector('.basemap-control-status')?.replaceWith(
      this._createStatus(results.length),
    );
    this._content.querySelector('.basemap-control-results')?.replaceWith(
      this._createResults(results),
    );
  }

  private _getFilteredBasemaps(): BasemapDefinition[] {
    return filterBasemaps(this._basemaps, {
      query: this._state.query,
      provider: this._state.providerFilter,
      category: this._state.categoryFilter,
    });
  }

  private _createSearchRow(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'basemap-control-search-row';
    row.appendChild(this._createSearchInput());
    row.appendChild(this._createBeforeIdInput());
    return row;
  }

  private _createSearchInput(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'basemap-control-search';

    const input = document.createElement('input');
    input.className = 'basemap-control-input';
    input.type = 'search';
    input.placeholder = 'Search basemaps';
    input.value = this._state.query;
    input.setAttribute('aria-label', 'Search basemaps');
    input.addEventListener('input', () => {
      this._state = { ...this._state, query: input.value };
      this._renderFilteredResults();
      this._emit({ type: 'statechange', state: this.getState() });
    });

    wrapper.appendChild(input);
    return wrapper;
  }

  private _createBeforeIdInput(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'basemap-control-before-id';

    const input = document.createElement('input');
    input.className = 'basemap-control-input';
    input.type = 'text';
    input.placeholder = 'before_id: none';
    input.value = this._state.beforeId;
    input.setAttribute('aria-label', 'before_id');
    input.addEventListener('input', () => {
      this._state = { ...this._state, beforeId: input.value };
      this._emit({ type: 'statechange', state: this.getState() });
    });

    wrapper.appendChild(input);
    return wrapper;
  }

  private _createFilterRow(providers: BasemapProvider[], categories: string[]): HTMLElement {
    const row = document.createElement('div');
    row.className = 'basemap-control-filters';
    row.appendChild(
      this._createSelect(
        'Provider',
        this._state.providerFilter,
        providers.map((provider) => ({ value: provider.id, label: provider.name })),
        (value) => {
          this._state = { ...this._state, providerFilter: value };
          this._renderContent();
          this._emit({ type: 'statechange', state: this.getState() });
        },
      ),
    );
    row.appendChild(
      this._createSelect(
        'Category',
        this._state.categoryFilter,
        categories.map((category) => ({ value: category, label: category })),
        (value) => {
          this._state = { ...this._state, categoryFilter: value };
          this._renderContent();
          this._emit({ type: 'statechange', state: this.getState() });
        },
      ),
    );
    return row;
  }

  private _createSelect(
    label: string,
    value: string,
    options: Array<{ value: string; label: string }>,
    onChange: (value: string) => void,
  ): HTMLElement {
    const select = document.createElement('select');
    select.className = 'basemap-control-select';
    select.setAttribute('aria-label', label);

    const all = document.createElement('option');
    all.value = '';
    all.textContent = `All ${label.toLowerCase()}s`;
    select.appendChild(all);

    options.forEach((option) => {
      const element = document.createElement('option');
      element.value = option.value;
      element.textContent = option.label;
      select.appendChild(element);
    });

    select.value = value;
    select.addEventListener('change', () => onChange(select.value));
    return select;
  }

  private _createStatus(resultCount: number): HTMLElement {
    const status = document.createElement('div');
    status.className = 'basemap-control-status';
    if (this._state.loading) {
      status.textContent = 'Applying basemap...';
    } else if (this._state.error) {
      status.textContent = this._state.error;
      status.classList.add('is-error');
    } else {
      status.textContent = `${resultCount} basemap${resultCount === 1 ? '' : 's'}`;
    }
    return status;
  }

  private _createResults(results: BasemapDefinition[]): HTMLElement {
    const list = document.createElement('div');
    list.className = 'basemap-control-results';

    if (results.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'basemap-control-empty';
      empty.textContent = 'No basemaps match your search.';
      list.appendChild(empty);
      return list;
    }

    results.forEach((basemap) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'basemap-control-result';
      row.dataset.basemapId = basemap.id;
      if (basemap.id === this._state.activeBasemapId) {
        row.classList.add('is-active');
        row.setAttribute('aria-current', 'true');
      }
      row.disabled = this._state.loading;
      row.addEventListener('click', () => {
        this._selectBasemap(basemap.id);
      });

      const main = document.createElement('span');
      main.className = 'basemap-control-result-main';

      const name = document.createElement('span');
      name.className = 'basemap-control-result-name';
      name.textContent = basemap.name;

      const meta = document.createElement('span');
      meta.className = 'basemap-control-result-meta';
      meta.textContent = this._formatBasemapMeta(basemap);

      main.appendChild(name);
      main.appendChild(meta);

      const type = document.createElement('span');
      type.className = 'basemap-control-result-type';
      type.textContent = basemap.type === 'raster' ? 'Raster' : 'Style';

      row.appendChild(main);
      row.appendChild(type);

      if (basemap.attribution) {
        const attribution = document.createElement('span');
        attribution.className = 'basemap-control-result-attribution';
        attribution.textContent = this._stripHtml(basemap.attribution);
        row.appendChild(attribution);
      }

      list.appendChild(row);
    });

    return list;
  }

  private _formatBasemapMeta(basemap: BasemapDefinition): string {
    const provider = this._providers.find((candidate) => candidate.id === basemap.provider);
    return [provider?.name ?? basemap.provider, basemap.category].filter(Boolean).join(' / ');
  }

  private _stripHtml(value: string): string {
    const template = document.createElement('template');
    template.innerHTML = value;
    return template.content.textContent ?? value;
  }

  private _addRasterBasemap(basemap: BasemapDefinition): void {
    if (!this._map || basemap.source.type !== 'raster') return;

    const sourceId = `${CONTROL_SOURCE_PREFIX}-${basemap.id}`;
    const layerId = [CONTROL_LAYER_PREFIX, basemap.id].filter(Boolean).join('-');
    const source: SourceSpecification = {
      type: 'raster',
      tiles: basemap.source.tiles,
      tileSize: basemap.source.tileSize ?? 256,
      minzoom: basemap.source.minzoom,
      maxzoom: basemap.source.maxzoom,
      scheme: basemap.source.scheme,
      attribution: basemap.attribution,
    };
    const layer: LayerSpecification = {
      id: layerId,
      type: 'raster',
      source: sourceId,
    };

    this._map.addSource(sourceId, source);
    this._map.addLayer(layer, this._getBasemapInsertBeforeId());
    this._managedSourceIds = [sourceId];
    this._managedLayerIds = [layerId];
  }

  private _waitForStyleReady(): Promise<void> {
    if (!this._map) return Promise.resolve();
    if (typeof this._map.isStyleLoaded !== 'function' || this._map.isStyleLoaded()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const done = () => {
        this._map?.off('load', done);
        this._map?.off('style.load', done);
        resolve();
      };
      this._map?.once('load', done);
      this._map?.once('style.load', done);
    });
  }

  private _removeManagedBasemap(): void {
    if (!this._map) return;

    [...this._managedLayerIds].reverse().forEach((layerId) => {
      if (this._map?.getLayer(layerId)) {
        this._map.removeLayer(layerId);
      }
    });
    [...this._managedSourceIds].reverse().forEach((sourceId) => {
      if (this._map?.getSource(sourceId)) {
        this._map.removeSource(sourceId);
      }
    });
    this._managedLayerIds = [];
    this._managedSourceIds = [];
  }

  private _applyBasemapView(basemap: BasemapDefinition): void {
    if (!this._map || !basemap.view) return;

    this._map.jumpTo({
      center: basemap.view.center,
      zoom: basemap.view.zoom,
      bearing: basemap.view.bearing,
      pitch: basemap.view.pitch,
    });
  }

  private _getBasemapInsertBeforeId(): string | undefined {
    const beforeId = this._state.beforeId.trim();
    if (!beforeId || beforeId.toLowerCase() === 'none') return undefined;
    return beforeId;
  }

  private _setupEventListeners(): void {
    this._clickOutsideHandler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        this._container &&
        this._panel &&
        !this._container.contains(target) &&
        !this._panel.contains(target)
      ) {
        this.collapse();
      }
    };
    document.addEventListener('click', this._clickOutsideHandler);

    this._resizeHandler = () => {
      if (!this._state.collapsed) this._updatePanelPosition();
    };
    window.addEventListener('resize', this._resizeHandler);

    this._mapResizeHandler = () => {
      if (!this._state.collapsed) this._updatePanelPosition();
    };
    this._map?.on('resize', this._mapResizeHandler);
  }

  private _getControlPosition(): BasemapControlPosition {
    const parent = this._container?.parentElement;
    if (!parent) return this._options.position;

    if (parent.classList.contains('maplibregl-ctrl-top-left')) return 'top-left';
    if (parent.classList.contains('maplibregl-ctrl-top-right')) return 'top-right';
    if (parent.classList.contains('maplibregl-ctrl-bottom-left')) return 'bottom-left';
    if (parent.classList.contains('maplibregl-ctrl-bottom-right')) return 'bottom-right';

    return this._options.position;
  }

  private _updatePanelPosition(): void {
    if (!this._container || !this._panel || !this._mapContainer) return;

    const button = this._container.querySelector('.basemap-control-toggle');
    if (!button) return;

    const buttonRect = button.getBoundingClientRect();
    const mapRect = this._mapContainer.getBoundingClientRect();
    const position = this._getControlPosition();
    const buttonTop = buttonRect.top - mapRect.top;
    const buttonBottom = mapRect.bottom - buttonRect.bottom;
    const buttonLeft = buttonRect.left - mapRect.left;
    const buttonRight = mapRect.right - buttonRect.right;
    const panelGap = 5;

    this._panel.style.top = '';
    this._panel.style.bottom = '';
    this._panel.style.left = '';
    this._panel.style.right = '';

    switch (position) {
      case 'top-left':
        this._panel.style.top = `${buttonTop + buttonRect.height + panelGap}px`;
        this._panel.style.left = `${buttonLeft}px`;
        break;
      case 'top-right':
        this._panel.style.top = `${buttonTop + buttonRect.height + panelGap}px`;
        this._panel.style.right = `${buttonRight}px`;
        break;
      case 'bottom-left':
        this._panel.style.bottom = `${buttonBottom + buttonRect.height + panelGap}px`;
        this._panel.style.left = `${buttonLeft}px`;
        break;
      case 'bottom-right':
        this._panel.style.bottom = `${buttonBottom + buttonRect.height + panelGap}px`;
        this._panel.style.right = `${buttonRight}px`;
        break;
    }
  }
}
