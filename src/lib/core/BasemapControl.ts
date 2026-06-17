import type {
  IControl,
  LayerSpecification,
  Map as MapLibreMap,
  SourceSpecification,
  StyleSpecification,
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
  ManagedRasterBasemap,
} from './types';

const DEFAULT_OPTIONS: Required<
  Pick<
    BasemapControlOptions,
    | 'collapsed'
    | 'position'
    | 'title'
    | 'panelWidth'
    | 'className'
    | 'includeDefaultBasemaps'
    | 'allowMultiple'
    | 'showMultipleToggle'
    | 'resizable'
  >
> = {
  collapsed: true,
  position: 'top-right',
  title: 'Basemaps',
  panelWidth: 340,
  className: '',
  includeDefaultBasemaps: true,
  allowMultiple: false,
  showMultipleToggle: true,
  resizable: true,
};

const CONTROL_SOURCE_PREFIX = 'maplibre-basemap-control-source';
const CONTROL_LAYER_PREFIX = '';
const API_KEY_PLACEHOLDER = '{api-key}';
const MAPTILER_API_KEY_EXAMPLE = 'YOUR_MAPTILER_API_KEY';
const MAPTILER_API_KEY_QUERY = '?key';
const MAPTILER_API_KEY_EMPTY_QUERY = '?key=';
const AWS_REGION_PLACEHOLDER = '{aws-region}';
const MIN_PANEL_WIDTH = 240;
const MIN_PANEL_HEIGHT = 200;
const PANEL_VIEWPORT_MARGIN = 12;

interface ResizeAnchor {
  x: number;
  y: number;
  isLeft: boolean;
  isTop: boolean;
}

type EventHandlersMap = globalThis.Map<BasemapControlEvent, Set<BasemapControlEventHandler>>;
type SetStyleOptions = NonNullable<Parameters<MapLibreMap['setStyle']>[1]>;

export class BasemapControl implements IControl {
  private _map?: MapLibreMap;
  private _mapContainer?: HTMLElement;
  private _container?: HTMLElement;
  private _panel?: HTMLElement;
  private _content?: HTMLElement;
  private _options: Required<
    Pick<
      BasemapControlOptions,
      | 'collapsed'
      | 'position'
      | 'title'
      | 'panelWidth'
      | 'className'
      | 'includeDefaultBasemaps'
      | 'allowMultiple'
      | 'showMultipleToggle'
      | 'resizable'
    >
  > &
    Omit<
      BasemapControlOptions,
      | 'collapsed'
      | 'position'
      | 'title'
      | 'panelWidth'
      | 'className'
      | 'includeDefaultBasemaps'
      | 'allowMultiple'
      | 'showMultipleToggle'
      | 'resizable'
    >;
  private _state: BasemapControlState;
  private _basemaps: BasemapDefinition[];
  private _providers: BasemapProvider[];
  private _eventHandlers: EventHandlersMap = new globalThis.Map();
  // Active managed raster basemaps keyed by basemap id, in insertion order. In
  // single mode this holds at most one entry; in multiple mode it tracks every
  // stacked raster overlay so each can be added or removed independently.
  private _managedRasters: globalThis.Map<string, ManagedRasterBasemap> = new globalThis.Map();
  private _mapTilerApiKey = '';
  private _amazonApiKey = '';
  private _awsRegion = '';
  private _mapboxAccessToken = '';
  private _providerSettingsCollapsed = true;
  private _resizeHandler: (() => void) | null = null;
  private _mapResizeHandler: (() => void) | null = null;
  private _resizeAnchor: ResizeAnchor | null = null;
  private _resizeHandleEl: HTMLElement | null = null;

  constructor(options?: BasemapControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._mapTilerApiKey = options?.mapTilerApiKey ?? '';
    this._amazonApiKey = options?.amazonApiKey ?? '';
    this._awsRegion = options?.awsRegion ?? 'us-east-1';
    this._mapboxAccessToken = options?.mapboxAccessToken ?? '';
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
      activeBasemapIds: this._options.defaultBasemapId ? [this._options.defaultBasemapId] : [],
      allowMultiple: this._options.allowMultiple,
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
    window.removeEventListener('pointermove', this._onResizeMove);
    window.removeEventListener('pointerup', this._onResizeEnd);
    window.removeEventListener('pointercancel', this._onResizeEnd);
    this._resizeAnchor = null;
    this._resizeHandleEl = null;
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
    this._syncActiveBasemapState(newState);
    this._renderContent();
    this._emit({ type: 'statechange', state: this.getState() });
  }

  // Keeps `activeBasemapId` and `activeBasemapIds` consistent when a caller
  // updates only one of them through setState (the React wrapper and external
  // consumers commonly set just `activeBasemapId`).
  private _syncActiveBasemapState(applied: Partial<BasemapControlState>): void {
    const hasId = 'activeBasemapId' in applied;
    const hasIds = 'activeBasemapIds' in applied;
    if (hasId && !hasIds) {
      const id = this._state.activeBasemapId;
      this._state = { ...this._state, activeBasemapIds: id ? [id] : [] };
    } else if (hasIds && !hasId) {
      const ids = this._state.activeBasemapIds;
      this._state = { ...this._state, activeBasemapId: ids[ids.length - 1] };
    }
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
    const activeBasemapIds = this._state.activeBasemapIds.filter((id) =>
      this._basemaps.some((basemap) => basemap.id === id),
    );
    this._state = {
      ...this._state,
      activeBasemapIds,
      activeBasemapId:
        this._state.activeBasemapId && activeBasemapIds.includes(this._state.activeBasemapId)
          ? this._state.activeBasemapId
          : activeBasemapIds[activeBasemapIds.length - 1],
    };
    this._renderContent();
    this._emit({ type: 'statechange', state: this.getState() });
  }

  setMapTilerApiKey(apiKey: string): void {
    this._mapTilerApiKey = apiKey;
    this._state = { ...this._state, error: undefined };
    this._renderContent();
    this._emit({ type: 'statechange', state: this.getState() });
  }

  setAmazonCredentials(apiKey: string, awsRegion = this._awsRegion): void {
    this._amazonApiKey = apiKey;
    this._awsRegion = awsRegion;
    this._state = { ...this._state, error: undefined };
    this._renderContent();
    this._emit({ type: 'statechange', state: this.getState() });
  }

  setMapboxAccessToken(accessToken: string): void {
    this._mapboxAccessToken = accessToken;
    this._state = { ...this._state, error: undefined };
    this._renderContent();
    this._emit({ type: 'statechange', state: this.getState() });
  }

  getActiveBasemap(): BasemapDefinition | undefined {
    return this._basemaps.find((basemap) => basemap.id === this._state.activeBasemapId);
  }

  getActiveBasemaps(): BasemapDefinition[] {
    return this._state.activeBasemapIds
      .map((id) => this._basemaps.find((basemap) => basemap.id === id))
      .filter((basemap): basemap is BasemapDefinition => Boolean(basemap));
  }

  isBasemapActive(id: string): boolean {
    return this._state.activeBasemapIds.includes(id);
  }

  // Apply a basemap, replacing any previously active basemaps.
  async setBasemap(id: string): Promise<void> {
    return this._applyBasemapChange(id, 'replace');
  }

  // Add a raster basemap as an additional overlay without removing the active
  // ones. Style basemaps cannot stack, so they always replace the map style.
  async addBasemap(id: string): Promise<void> {
    return this._applyBasemapChange(id, 'add');
  }

  // Remove a previously added managed raster basemap from the map.
  async removeBasemap(id: string): Promise<void> {
    const basemap = this._basemaps.find((candidate) => candidate.id === id);
    if (!basemap) {
      const error = new Error(`Basemap "${id}" was not found.`);
      this._handleError(error);
      throw error;
    }
    if (!this._map) {
      const error = new Error('BasemapControl must be added to a map before removing a basemap.');
      this._handleError(error, basemap);
      throw error;
    }

    const managedRaster = this._removeManagedRaster(id);
    const activeBasemapIds = this._state.activeBasemapIds.filter((value) => value !== id);
    this._state = {
      ...this._state,
      activeBasemapIds,
      activeBasemapId: activeBasemapIds[activeBasemapIds.length - 1],
      error: undefined,
    };
    this._renderContent(true);
    this._emit({ type: 'basemapremove', state: this.getState(), basemap, managedRaster });
    this._emit({ type: 'statechange', state: this.getState() });
  }

  // Add the basemap if it is not active, otherwise remove it.
  async toggleBasemap(id: string): Promise<void> {
    if (this.isBasemapActive(id)) {
      return this.removeBasemap(id);
    }
    return this.addBasemap(id);
  }

  private async _applyBasemapChange(id: string, mode: 'replace' | 'add'): Promise<void> {
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

    const isRaster = basemap.source.type === 'raster';
    // Style basemaps replace the entire map style and cannot be stacked.
    const effectiveMode: 'replace' | 'add' = isRaster ? mode : 'replace';

    this._state = { ...this._state, loading: true, error: undefined };
    this._renderContent(true);
    this._emit({ type: 'statechange', state: this.getState() });

    try {
      let managedRaster: ManagedRasterBasemap | undefined;
      if (isRaster) {
        await this._waitForStyleReady();
        if (effectiveMode === 'replace') {
          this._removeManagedBasemap();
        } else {
          // Re-selecting an already-managed raster re-adds it on top using the
          // current before_id, so drop the previous instance first.
          this._removeManagedRaster(basemap.id);
        }
        managedRaster = this._addRasterBasemap(basemap);
      } else {
        const styleUrl = this._resolveStyleUrl(basemap);
        const styleOptions = this._getStyleOptions(basemap);
        // A full style swap discards every managed raster overlay, so forget
        // the ones we were tracking.
        this._removeManagedBasemap();
        if (styleOptions) {
          this._map.setStyle(styleUrl, styleOptions);
        } else {
          this._map.setStyle(styleUrl);
        }
      }

      this._applyBasemapView(basemap);

      const activeBasemapIds =
        effectiveMode === 'add'
          ? [...this._state.activeBasemapIds.filter((value) => value !== basemap.id), basemap.id]
          : [basemap.id];

      this._state = {
        ...this._state,
        activeBasemapId: basemap.id,
        activeBasemapIds,
        loading: false,
        error: undefined,
      };
      this._renderContent(true);
      this._emit({
        type: 'basemapchange',
        state: this.getState(),
        basemap,
        managedRaster,
        mode: effectiveMode,
      });
      this._emit({ type: 'statechange', state: this.getState() });
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this._state = { ...this._state, loading: false, error: error.message };
      this._renderContent(true);
      this._handleError(error, basemap);
      throw error;
    }
  }

  // The public mutators rethrow after emitting the error event so callers that
  // await them can react. The panel's click handler uses this instead to avoid
  // unhandled promise rejections; the failure is still reported via `error`.
  // In multiple mode a raster basemap click toggles the overlay on or off.
  private _selectBasemap(id: string): void {
    const basemap = this._basemaps.find((candidate) => candidate.id === id);
    const isRaster = basemap?.source.type === 'raster';
    if (this._state.allowMultiple && isRaster) {
      this.toggleBasemap(id).catch(() => {});
      return;
    }
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
    panel.style.width = `${this._state.panelWidth}px`;
    if (this._state.panelHeight !== undefined) {
      panel.style.height = `${this._state.panelHeight}px`;
      panel.classList.add('is-resized');
    }

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

    if (this._options.resizable) {
      panel.appendChild(this._createResizeHandle('bottom-left'));
      panel.appendChild(this._createResizeHandle('bottom-right'));
    }

    return panel;
  }

  private _createResizeHandle(corner: 'bottom-left' | 'bottom-right'): HTMLElement {
    const handle = document.createElement('div');
    handle.className = `basemap-control-resize-handle basemap-control-resize-${corner}`;
    handle.setAttribute('aria-hidden', 'true');
    handle.addEventListener('pointerdown', (event) => this._startResize(event));
    return handle;
  }

  private _renderContent(preserveResultsScroll = false): void {
    if (!this._content) return;

    const categories = getBasemapCategories(this._basemaps);
    const results = this._getFilteredBasemaps();
    const previousResultsScrollTop = preserveResultsScroll
      ? this._content.querySelector('.basemap-control-results')?.scrollTop
      : undefined;

    this._content.replaceChildren(
      this._createSearchRow(),
      ...(this._options.showMultipleToggle ? [this._createMultipleToggleRow()] : []),
      ...(this._hasProviderSettings() ? [this._createProviderSettingsSection()] : []),
      this._createFilterRow(this._providers, categories),
      this._createStatus(results.length),
      this._createResults(results),
    );

    if (previousResultsScrollTop !== undefined) {
      const resultsElement = this._content.querySelector('.basemap-control-results');
      if (resultsElement) resultsElement.scrollTop = previousResultsScrollTop;
    }
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

  private _createMultipleToggleRow(): HTMLElement {
    const label = document.createElement('label');
    label.className = 'basemap-control-multiple-toggle';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'basemap-control-multiple-checkbox';
    checkbox.checked = this._state.allowMultiple;
    checkbox.setAttribute('aria-label', 'Add basemaps instead of replacing');
    checkbox.addEventListener('change', () => {
      this._state = { ...this._state, allowMultiple: checkbox.checked };
      this._emit({ type: 'statechange', state: this.getState() });
    });

    const text = document.createElement('span');
    text.className = 'basemap-control-multiple-toggle-text';
    text.textContent = 'Add basemaps (stack instead of replace)';

    label.appendChild(checkbox);
    label.appendChild(text);
    return label;
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

  private _createProviderSettingsSection(): HTMLElement {
    const details = document.createElement('details');
    details.className = 'basemap-control-provider-settings';
    details.open = !this._providerSettingsCollapsed;
    details.addEventListener('toggle', () => {
      this._providerSettingsCollapsed = !details.open;
    });

    const summary = document.createElement('summary');
    summary.className = 'basemap-control-provider-settings-summary';
    summary.textContent = 'Provider settings';
    details.appendChild(summary);

    const fields = document.createElement('div');
    fields.className = 'basemap-control-provider-settings-fields';

    if (this._hasMapTilerBasemaps()) {
      fields.appendChild(
        this._createProviderSettingsInput({
          className: 'basemap-control-maptiler-key',
          type: 'password',
          placeholder: 'MapTiler API key',
          ariaLabel: 'MapTiler API key',
          value: this._mapTilerApiKey,
          onInput: (value) => {
            this._mapTilerApiKey = value;
          },
        }),
      );
    }

    if (this._hasMapboxBasemaps()) {
      fields.appendChild(
        this._createProviderSettingsInput({
          className: 'basemap-control-mapbox-token',
          type: 'password',
          placeholder: 'Mapbox access token',
          ariaLabel: 'Mapbox access token',
          value: this._mapboxAccessToken,
          onInput: (value) => {
            this._mapboxAccessToken = value;
          },
        }),
      );
    }

    if (this._hasAmazonBasemaps()) {
      fields.appendChild(
        this._createProviderSettingsInput({
          className: 'basemap-control-amazon-key',
          type: 'password',
          placeholder: 'Amazon API key',
          ariaLabel: 'Amazon API key',
          value: this._amazonApiKey,
          onInput: (value) => {
            this._amazonApiKey = value;
          },
        }),
      );
      fields.appendChild(
        this._createProviderSettingsInput({
          className: 'basemap-control-aws-region',
          type: 'text',
          placeholder: 'AWS region',
          ariaLabel: 'AWS region',
          value: this._awsRegion,
          onInput: (value) => {
            this._awsRegion = value;
          },
        }),
      );
    }

    details.appendChild(fields);
    return details;
  }

  private _createProviderSettingsInput({
    className,
    type,
    placeholder,
    ariaLabel,
    value,
    onInput,
  }: {
    className: string;
    type: string;
    placeholder: string;
    ariaLabel: string;
    value: string;
    onInput: (value: string) => void;
  }): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = className;

    const input = document.createElement('input');
    input.className = 'basemap-control-input';
    input.type = type;
    input.placeholder = placeholder;
    input.value = value;
    input.name = ariaLabel.toLowerCase().replace(/\s+/g, '-');
    input.autocomplete = 'new-password';
    input.autocapitalize = 'none';
    input.spellcheck = false;
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('aria-label', ariaLabel);
    input.addEventListener('input', () => {
      onInput(input.value);
      this._state = { ...this._state, error: undefined };
      this._renderFilteredResults();
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
      if (this._state.activeBasemapIds.includes(basemap.id)) {
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

  private _hasMapTilerBasemaps(): boolean {
    return this._basemaps.some((basemap) => basemap.provider === 'maptiler');
  }

  private _hasAmazonBasemaps(): boolean {
    return this._basemaps.some((basemap) => basemap.provider === 'amazon');
  }

  private _hasMapboxBasemaps(): boolean {
    return this._basemaps.some((basemap) => basemap.provider === 'mapbox');
  }

  private _hasProviderSettings(): boolean {
    return this._hasMapTilerBasemaps() || this._hasAmazonBasemaps() || this._hasMapboxBasemaps();
  }

  private _resolveStyleUrl(basemap: BasemapDefinition): string {
    if (basemap.source.type === 'raster') {
      throw new Error(`Basemap "${basemap.id}" is not a style basemap.`);
    }

    const url = basemap.source.url;
    if (basemap.provider === 'amazon') {
      return this._resolveAmazonStyleUrl(url);
    }

    if (basemap.provider === 'maptiler') {
      return this._resolveMapTilerStyleUrl(url);
    }

    if (basemap.provider === 'mapbox') {
      return this._resolveMapboxStyleUrl(url);
    }

    return url;
  }

  private _getStyleOptions(basemap: BasemapDefinition): SetStyleOptions | undefined {
    if (basemap.provider === 'mapbox') {
      return {
        validate: false,
        transformStyle: (_previousStyle, nextStyle) =>
          this._transformMapboxStyle(nextStyle, this._mapboxAccessToken.trim()),
      };
    }
    return undefined;
  }

  private _transformMapboxStyle(style: StyleSpecification, accessToken: string): StyleSpecification {
    const encodedAccessToken = encodeURIComponent(accessToken);
    const sources = Object.fromEntries(
      Object.entries(style.sources).map(([id, source]) => {
        if ('url' in source && typeof source.url === 'string') {
          return [id, { ...source, url: this._resolveMapboxInternalUrl(source.url, encodedAccessToken) }];
        }
        return [id, source];
      }),
    );

    return {
      ...style,
      glyphs:
        typeof style.glyphs === 'string'
          ? this._resolveMapboxInternalUrl(style.glyphs, encodedAccessToken)
          : style.glyphs,
      sprite: this._resolveMapboxSprite(style.sprite, encodedAccessToken),
      projection: { type: 'mercator' },
      sources,
    };
  }

  private _resolveMapboxSprite(
    sprite: StyleSpecification['sprite'],
    encodedAccessToken: string,
  ): StyleSpecification['sprite'] {
    if (typeof sprite === 'string') {
      return this._resolveMapboxInternalUrl(sprite, encodedAccessToken);
    }

    if (Array.isArray(sprite)) {
      return sprite.map((item) => ({
        ...item,
        url: this._resolveMapboxInternalUrl(item.url, encodedAccessToken),
      }));
    }

    return sprite;
  }

  private _resolveMapboxInternalUrl(url: string, encodedAccessToken: string): string {
    if (url.startsWith('mapbox://sprites/')) {
      const [, owner, styleId] = /^mapbox:\/\/sprites\/([^/]+)\/(.+)$/.exec(url) ?? [];
      if (owner && styleId) {
        return `https://api.mapbox.com/styles/v1/${owner}/${styleId}/sprite?access_token=${encodedAccessToken}`;
      }
    }

    if (url.startsWith('mapbox://fonts/')) {
      const [, owner, fontPath] = /^mapbox:\/\/fonts\/([^/]+)\/(.+)$/.exec(url) ?? [];
      if (owner && fontPath) {
        return `https://api.mapbox.com/fonts/v1/${owner}/${fontPath}?access_token=${encodedAccessToken}`;
      }
    }

    if (url.startsWith('mapbox://')) {
      const tileset = url.replace(/^mapbox:\/\//, '');
      return `https://api.mapbox.com/v4/${tileset}.json?secure&access_token=${encodedAccessToken}`;
    }

    return url;
  }

  private _resolveMapTilerStyleUrl(url: string): string {
    const needsMapTilerKey =
      url.includes(API_KEY_PLACEHOLDER) ||
      url.includes(MAPTILER_API_KEY_EXAMPLE) ||
      url.endsWith(MAPTILER_API_KEY_QUERY) ||
      url.endsWith(MAPTILER_API_KEY_EMPTY_QUERY);

    if (!needsMapTilerKey) return url;

    const apiKey = this._mapTilerApiKey.trim();
    if (!apiKey) {
      throw new Error('Enter a MapTiler API key before applying this basemap.');
    }

    const encodedApiKey = encodeURIComponent(apiKey);
    if (url.endsWith(MAPTILER_API_KEY_QUERY)) {
      return `${url}=${encodedApiKey}`;
    }
    if (url.endsWith(MAPTILER_API_KEY_EMPTY_QUERY)) {
      return `${url}${encodedApiKey}`;
    }

    return url
      .split(API_KEY_PLACEHOLDER)
      .join(encodedApiKey)
      .split(MAPTILER_API_KEY_EXAMPLE)
      .join(encodedApiKey);
  }

  private _resolveAmazonStyleUrl(url: string): string {
    const apiKey = this._amazonApiKey.trim();
    const awsRegion = this._awsRegion.trim();

    if (url.includes(API_KEY_PLACEHOLDER) && !apiKey) {
      throw new Error('Enter an Amazon API key before applying this basemap.');
    }
    if (url.includes(AWS_REGION_PLACEHOLDER) && !awsRegion) {
      throw new Error('Enter an AWS region before applying this basemap.');
    }

    return url
      .split(AWS_REGION_PLACEHOLDER)
      .join(awsRegion)
      .split(API_KEY_PLACEHOLDER)
      .join(encodeURIComponent(apiKey));
  }

  private _resolveMapboxStyleUrl(url: string): string {
    const accessToken = this._mapboxAccessToken.trim();

    if (url.includes(API_KEY_PLACEHOLDER) && !accessToken) {
      throw new Error('Enter a Mapbox access token before applying this basemap.');
    }
    if (this._isUrlLikeCredential(accessToken)) {
      throw new Error('Enter a valid Mapbox access token, not a URL.');
    }

    return url.split(API_KEY_PLACEHOLDER).join(encodeURIComponent(accessToken));
  }

  private _isUrlLikeCredential(value: string): boolean {
    return /^https?:\/\//i.test(value);
  }

  private _addRasterBasemap(basemap: BasemapDefinition): ManagedRasterBasemap | undefined {
    if (!this._map || basemap.source.type !== 'raster') return undefined;

    const sourceId = `${CONTROL_SOURCE_PREFIX}-${basemap.id}`;
    const layerId = [CONTROL_LAYER_PREFIX, basemap.id].filter(Boolean).join('-');
    const beforeId = this._getBasemapInsertBeforeId();
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
    this._map.addLayer(layer, beforeId);
    const managed: ManagedRasterBasemap = { sourceId, layerId, beforeId };
    this._managedRasters.set(basemap.id, managed);

    return managed;
  }

  private _waitForStyleReady(): Promise<void> {
    if (!this._map) return Promise.resolve();
    if (typeof this._map.isStyleLoaded !== 'function' || this._map.isStyleLoaded()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const done = () => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        this._map?.off('load', done);
        this._map?.off('style.load', done);
        resolve();
      };
      // Fall back after a short wait so a missed `load`/`style.load` event
      // (e.g. when basemaps are switched faster than styles settle) can never
      // leave the control stuck in its loading state with a wait cursor.
      timer = setTimeout(done, 1500);
      this._map?.once('load', done);
      this._map?.once('style.load', done);
    });
  }

  // Remove every managed raster basemap from the map.
  private _removeManagedBasemap(): void {
    if (!this._map) return;
    for (const id of [...this._managedRasters.keys()]) {
      this._removeManagedRaster(id);
    }
  }

  // Remove a single managed raster basemap by its basemap id, returning the
  // managed source/layer record that was removed (if any).
  private _removeManagedRaster(id: string): ManagedRasterBasemap | undefined {
    const managed = this._managedRasters.get(id);
    if (!managed) return undefined;

    if (this._map?.getLayer(managed.layerId)) {
      this._map.removeLayer(managed.layerId);
    }
    if (this._map?.getSource(managed.sourceId)) {
      this._map.removeSource(managed.sourceId);
    }
    this._managedRasters.delete(id);
    return managed;
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

  // Begin a panel resize from a bottom corner. The panel stays pinned to its
  // toggle button, so resizing is measured from the button-anchored corner:
  // dragging either bottom handle grows or shrinks the panel away from it.
  private _startResize(event: PointerEvent): void {
    if (!this._panel) return;
    event.preventDefault();
    event.stopPropagation();

    const position = this._getControlPosition();
    const isLeft = position === 'top-left' || position === 'bottom-left';
    const isTop = position === 'top-left' || position === 'top-right';
    const rect = this._panel.getBoundingClientRect();
    this._resizeAnchor = {
      x: isLeft ? rect.left : rect.right,
      y: isTop ? rect.top : rect.bottom,
      isLeft,
      isTop,
    };

    // Listen on the window so the drag keeps tracking even when the pointer
    // moves off the small handle; pointer capture is a best-effort nicety.
    const handle = event.currentTarget as HTMLElement;
    this._resizeHandleEl = handle;
    handle.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', this._onResizeMove);
    window.addEventListener('pointerup', this._onResizeEnd);
    window.addEventListener('pointercancel', this._onResizeEnd);
  }

  private _onResizeMove = (event: PointerEvent): void => {
    if (!this._panel || !this._resizeAnchor) return;
    const { x, y, isLeft, isTop } = this._resizeAnchor;
    const bounds = this._getResizeBounds();
    const rawWidth = isLeft ? event.clientX - x : x - event.clientX;
    const rawHeight = isTop ? event.clientY - y : y - event.clientY;
    const width = this._clampSize(rawWidth, MIN_PANEL_WIDTH, bounds.maxWidth);
    const height = this._clampSize(rawHeight, MIN_PANEL_HEIGHT, bounds.maxHeight);

    this._panel.style.width = `${width}px`;
    this._panel.style.height = `${height}px`;
    this._panel.classList.add('is-resized');
    this._state = { ...this._state, panelWidth: width, panelHeight: height };
    this._updatePanelPosition();
  };

  private _onResizeEnd = (event: PointerEvent): void => {
    window.removeEventListener('pointermove', this._onResizeMove);
    window.removeEventListener('pointerup', this._onResizeEnd);
    window.removeEventListener('pointercancel', this._onResizeEnd);
    this._resizeHandleEl?.releasePointerCapture?.(event.pointerId);
    this._resizeHandleEl = null;
    if (!this._resizeAnchor) return;
    this._resizeAnchor = null;
    this._emit({ type: 'statechange', state: this.getState() });
  };

  private _getResizeBounds(): { maxWidth: number; maxHeight: number } {
    const mapRect = this._mapContainer?.getBoundingClientRect();
    const availableWidth = (mapRect?.width ?? window.innerWidth) - PANEL_VIEWPORT_MARGIN * 2;
    const availableHeight = (mapRect?.height ?? window.innerHeight) - PANEL_VIEWPORT_MARGIN * 2;
    return {
      maxWidth: Math.max(MIN_PANEL_WIDTH, availableWidth),
      maxHeight: Math.max(MIN_PANEL_HEIGHT, availableHeight),
    };
  }

  private _clampSize(value: number, min: number, max: number): number {
    return Math.round(Math.min(Math.max(value, min), max));
  }
}
