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
  GoogleSessionConfig,
  ManagedRasterBasemap,
  VectorOverlayBasemapSource,
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

// Where users can obtain the credentials each provider requires. Surfaced as a
// "Get a ..." link beside a missing-credential error so the message points at a
// concrete next step instead of dead-ending.
const PROVIDER_CREDENTIAL_HELP: Record<string, { url: string; label: string }> = {
  amazon: {
    url: 'https://docs.aws.amazon.com/location/latest/developerguide/using-apikeys.html',
    label: 'Get an Amazon API key',
  },
  maptiler: {
    url: 'https://cloud.maptiler.com/account/keys/',
    label: 'Get a MapTiler API key',
  },
  mapbox: {
    url: 'https://docs.mapbox.com/help/getting-started/access-tokens/',
    label: 'Get a Mapbox access token',
  },
  protomaps: {
    url: 'https://protomaps.com/account',
    label: 'Get a Protomaps API key',
  },
  stadia: {
    url: 'https://client.stadiamaps.com/signup/',
    label: 'Get a Stadia Maps API key',
  },
  tianditu: {
    url: 'https://console.tianditu.gov.cn/api/key',
    label: 'Get a Tianditu API key',
  },
  tomtom: {
    url: 'https://developer.tomtom.com/how-to-get-tomtom-api-key',
    label: 'Get a TomTom API key',
  },
  here: {
    url: 'https://www.here.com/get-started/pricing',
    label: 'Get a HERE API key',
  },
  google: {
    url: 'https://developers.google.com/maps/documentation/tile/get-api-key',
    label: 'Get a Google Maps API key',
  },
};

// What to call each provider's credential in the "Enter a ... before applying
// this layer." message raised when a raster basemap's `{api-key}` cannot be
// substituted. Providers absent here fall back to a generic "API key".
const RASTER_KEY_LABELS: Record<string, string> = {
  google: 'Google Maps API key',
  here: 'HERE API key',
  stadia: 'Stadia Maps API key',
  tianditu: 'Tianditu API key',
  tomtom: 'TomTom API key',
};

// How long after a credentialed provider's style descriptor loads the control
// keeps watching for an unauthorized (401/403) tile request before considering
// the basemap healthy. The first tiles are fetched immediately once the style
// is live, so this only needs to cover that initial burst.
const STYLE_AUTH_GRACE_MS = 2500;

const MIN_PANEL_WIDTH = 240;
const MIN_PANEL_HEIGHT = 200;
const PANEL_VIEWPORT_MARGIN = 12;

// Thrown when a style basemap cannot be applied because the provider's
// credentials are missing. Carries the provider id so the panel can show the
// matching "Get a ..." link and reveal the provider settings input.
class MissingCredentialError extends Error {
  readonly provider: string;

  constructor(message: string, provider: string) {
    super(message);
    this.name = 'MissingCredentialError';
    this.provider = provider;
  }
}

// Thrown when a style basemap's descriptor request fails *after* it was applied
// (e.g. an invalid provider API key returns 401/403, or the host is
// unreachable). Carries the provider and the HTTP status, when known, so hosts
// can surface a precise message. Unlike MissingCredentialError this is reported
// asynchronously, once MapLibre reports the failed style request.
class BasemapLoadError extends Error {
  readonly provider: string;
  readonly status?: number;

  constructor(message: string, provider: string, status?: number) {
    super(message);
    this.name = 'BasemapLoadError';
    this.provider = provider;
    this.status = status;
  }
}

// MapLibre reports failed network requests (including a style descriptor that
// 401/403s) as `error` events whose `error` is an AJAXError carrying the
// request URL. Pull it out defensively so a style-load failure can be matched
// to the exact style URL the control applied.
function extractErrorUrl(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'url' in error) {
    const url = (error as { url?: unknown }).url;
    if (typeof url === 'string') return url;
  }
  return undefined;
}

function extractErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number' && status > 0) return status;
  }
  return undefined;
}

interface ResizeAnchor {
  x: number;
  y: number;
  isLeft: boolean;
  isTop: boolean;
}

type EventHandlersMap = globalThis.Map<BasemapControlEvent, Set<BasemapControlEventHandler>>;
type SetStyleOptions = NonNullable<Parameters<MapLibreMap['setStyle']>[1]>;

// The shape of a single provider credential input, shared by the centralized
// settings view and the inline field shown beside a missing-credential error.
interface ProviderInputConfig {
  className: string;
  type: string;
  placeholder: string;
  ariaLabel: string;
  value: string;
  onInput: (value: string) => void;
}

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
  private _protomapsApiKey = '';
  private _stadiaApiKey = '';
  private _tiandituApiKey = '';
  private _tomtomApiKey = '';
  private _hereApiKey = '';
  private _googleMapsApiKey = '';
  // Cached Google Map Tiles API session tokens keyed by their session config, so
  // a traffic overlay reuses a token until it expires instead of creating a new
  // session on every add. Keyed by the serialized config + API key.
  private _googleSessions: globalThis.Map<string, { token: string; expiry: number }> =
    new globalThis.Map();
  // Which sub-view the panel content shows: the basemap list, or the dedicated
  // API-keys settings view opened from the header key button (#837).
  private _activeView: 'basemaps' | 'settings' = 'basemaps';
  private _settingsButton?: HTMLButtonElement;
  // Provider of the most recent missing-credential error, used to pick the
  // matching help link and the inline credential field beside the error. Kept
  // in sync with `_state.error` (both are cleared together) so it is never
  // stale when consulted.
  private _missingCredentialProvider?: keyof typeof PROVIDER_CREDENTIAL_HELP;
  // The basemap whose application last failed for a missing credential, so the
  // inline credential field's Enter key can re-attempt it (#837).
  private _lastFailedBasemapId?: string;
  // The id of a just-applied basemap that is showing its keyless public tiles
  // because no API key is set (currently the Google Maps/Satellite/Terrain/
  // Hybrid basemaps). The panel offers an optional inline key input that
  // upgrades it to the authorized tiles; leaving it blank keeps the fallback.
  private _optionalKeyBasemapId?: string;
  // Detaches the listeners watching the in-flight style load (see
  // _watchStyleLoad). Set while a style swap is settling, cleared once it
  // succeeds, fails, or is superseded by a newer swap.
  private _cancelStyleWatch?: () => void;
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
    this._protomapsApiKey = options?.protomapsApiKey ?? '';
    this._stadiaApiKey = options?.stadiaApiKey ?? '';
    this._tiandituApiKey = options?.tiandituApiKey ?? '';
    this._tomtomApiKey = options?.tomtomApiKey ?? '';
    this._hereApiKey = options?.hereApiKey ?? '';
    this._googleMapsApiKey = options?.googleMapsApiKey ?? '';
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
      // Apply the configured default basemap. This always sets it (rather than
      // routing through the panel's toggle handler) so multiple mode does not
      // immediately toggle the pre-seeded default basemap back off.
      this.setBasemap(this._state.activeBasemapId).catch(() => {});
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
    // Detach any in-flight style-load watcher before the map reference is
    // dropped so its listeners cannot fire after removal.
    this._cancelStyleWatch?.();
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
    this._clearError();
    this._renderContent();
    this._emit({ type: 'statechange', state: this.getState() });
  }

  setAmazonCredentials(apiKey: string, awsRegion = this._awsRegion): void {
    this._amazonApiKey = apiKey;
    this._awsRegion = awsRegion;
    this._clearError();
    this._renderContent();
    this._emit({ type: 'statechange', state: this.getState() });
  }

  setMapboxAccessToken(accessToken: string): void {
    this._mapboxAccessToken = accessToken;
    this._clearError();
    this._renderContent();
    this._emit({ type: 'statechange', state: this.getState() });
  }

  setProtomapsApiKey(apiKey: string): void {
    this._protomapsApiKey = apiKey;
    this._clearError();
    this._renderContent();
    this._emit({ type: 'statechange', state: this.getState() });
  }

  setStadiaApiKey(apiKey: string): void {
    this._stadiaApiKey = apiKey;
    this._clearError();
    this._renderContent();
    this._emit({ type: 'statechange', state: this.getState() });
  }

  setTiandituApiKey(apiKey: string): void {
    this._tiandituApiKey = apiKey;
    this._clearError();
    this._renderContent();
    this._emit({ type: 'statechange', state: this.getState() });
  }

  setTomTomApiKey(apiKey: string): void {
    this._tomtomApiKey = apiKey;
    this._clearError();
    this._renderContent();
    this._emit({ type: 'statechange', state: this.getState() });
  }

  setHereApiKey(apiKey: string): void {
    this._hereApiKey = apiKey;
    this._clearError();
    this._renderContent();
    this._emit({ type: 'statechange', state: this.getState() });
  }

  setGoogleMapsApiKey(apiKey: string): void {
    this._googleMapsApiKey = apiKey;
    // A new key invalidates any session tokens minted with the previous one.
    this._googleSessions.clear();
    this._clearError();
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

    // Raster and vector overlays stack on top of the active basemap; style
    // basemaps replace the entire map style and cannot be stacked.
    const isOverlay =
      basemap.source.type === 'raster' || basemap.source.type === 'vector-overlay';
    const effectiveMode: 'replace' | 'add' = isOverlay ? mode : 'replace';

    // Validate provider credentials for a style basemap up-front, before the
    // destructive confirm prompt below. A style swap discards stacked rasters,
    // so a missing key must surface the inline credential field instead of
    // asking the user to approve clearing their basemap stack only to then hit
    // a hard "enter an API key" error (#837). Overlays stack non-destructively
    // and resolve their credentials lazily, so they are not pre-checked here.
    if (!isOverlay) {
      try {
        this._resolveStyleUrl(basemap);
      } catch (cause) {
        if (cause instanceof MissingCredentialError) {
          this._enterCredentialError(cause, basemap);
          throw cause;
        }
        // Non-credential resolution errors fall through to the apply path
        // below, which reports them with full loading/error handling.
      }
    }

    // A style basemap swaps the whole map style, discarding every stacked
    // raster overlay. In stack mode that is a destructive, easy-to-trigger
    // surprise, so give the host a chance to confirm before the rasters are
    // lost. Skipped in single mode, where replacing the one active basemap is
    // expected, and when no host confirm hook is provided.
    if (
      !isOverlay &&
      this._state.allowMultiple &&
      this._managedRasters.size > 0 &&
      this._options.confirmStyleReplace
    ) {
      const replacedBasemapIds = [...this._managedRasters.keys()];
      let confirmed = false;
      try {
        confirmed = await this._options.confirmStyleReplace({ basemap, replacedBasemapIds });
      } catch {
        confirmed = false;
      }
      if (!confirmed) return;
    }

    this._state = { ...this._state, loading: true, error: undefined };
    this._renderContent(true);
    this._emit({ type: 'statechange', state: this.getState() });

    // The basemap that was active before this swap, captured before the state
    // update below so a failed style load can roll back to it.
    const previousActiveBasemapId = this._state.activeBasemapId;

    try {
      let managedRaster: ManagedRasterBasemap | undefined;
      let resolvedStyleUrl: string | undefined;
      if (isOverlay) {
        await this._waitForStyleReady();
        if (effectiveMode === 'replace') {
          this._removeManagedBasemap();
        } else {
          // Re-selecting an already-managed overlay re-adds it on top using the
          // current before_id, so drop the previous instance first.
          this._removeManagedRaster(basemap.id);
        }
        managedRaster = await this._addOverlay(basemap);
      } else {
        const styleUrl = this._resolveStyleUrl(basemap);
        resolvedStyleUrl = styleUrl;
        const styleOptions = this._getStyleOptions(basemap);
        // A full style swap discards every managed raster overlay, so forget
        // the ones we were tracking.
        this._removeManagedBasemap();
        if (styleOptions) {
          this._map.setStyle(styleUrl, styleOptions);
        } else {
          this._map.setStyle(styleUrl);
        }
        // setStyle fetches the descriptor asynchronously. If that request fails
        // (e.g. an invalid provider API key returns 401/403) MapLibre is left
        // without a style and the map goes blank. Watch the load so the
        // previous basemap is restored and the failure reported, instead of
        // silently clearing the map.
        this._watchStyleLoad(styleUrl, basemap, previousActiveBasemapId);
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
      // Offer the optional key input when this basemap fell back to its keyless
      // public tiles (no API key configured); clear it otherwise so the prompt
      // does not linger on a keyed or non-fallback basemap.
      this._optionalKeyBasemapId = this._basemapUsesKeylessFallback(basemap)
        ? basemap.id
        : undefined;
      this._renderContent(true);
      this._emit({
        type: 'basemapchange',
        state: this.getState(),
        basemap,
        managedRaster,
        resolvedStyleUrl,
        mode: effectiveMode,
      });
      this._emit({ type: 'statechange', state: this.getState() });
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      if (error instanceof MissingCredentialError) {
        // Surface the inline credential field beside the error so a missing
        // key has an obvious next step instead of dead-ending (#837).
        this._enterCredentialError(error, basemap);
      } else {
        this._state = { ...this._state, loading: false, error: error.message };
        this._missingCredentialProvider = undefined;
        this._renderContent(true);
        this._handleError(error, basemap);
      }
      throw error;
    }
  }

  // Watches the asynchronous style load that `setStyle` kicked off for a style
  // basemap, and rolls back to the previous basemap (reporting the failure
  // through the `error` event) when the new style cannot actually render. Two
  // failure modes are caught so a broken provider basemap never leaves a blank
  // map:
  //
  //   1. The style *document* request fails outright (matched by URL), e.g. an
  //      unreachable host or a descriptor that 404s. Detected whether or not
  //      `style.load` ever fires.
  //   2. The descriptor loads but the provider rejects the credentials when the
  //      first tiles are fetched (401/403). Amazon Location, for instance,
  //      serves the style JSON publicly but 403s every tile for a bad API key,
  //      so the descriptor "loads" while the map stays empty. This is only
  //      treated as fatal for credentialed providers, and only briefly after
  //      the descriptor loads, so an isolated transient tile error on a healthy
  //      basemap is ignored.
  private _watchStyleLoad(
    styleUrl: string,
    basemap: BasemapDefinition,
    previousActiveBasemapId: string | undefined,
  ): void {
    const map = this._map;
    if (!map) return;

    // Supersede any still-pending watcher from a faster previous switch so its
    // listeners cannot fire against this newer style.
    this._cancelStyleWatch?.();

    const isCredentialed = basemap.provider in PROVIDER_CREDENTIAL_HELP;
    let settled = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      if (graceTimer !== undefined) clearTimeout(graceTimer);
      map.off('style.load', onLoad);
      map.off('error', onError);
      if (this._cancelStyleWatch === cleanup) this._cancelStyleWatch = undefined;
    };

    const fail = (cause: unknown) => {
      cleanup();
      this._handleStyleLoadFailure(basemap, previousActiveBasemapId, cause);
    };

    const onLoad = () => {
      // The descriptor loaded. For a keyless style that is success. For a
      // credentialed provider keep listening briefly so the first unauthorized
      // tile request (which only happens once the style is live) can still roll
      // back a credential-rejected basemap.
      if (!isCredentialed) {
        cleanup();
      } else if (graceTimer === undefined) {
        graceTimer = setTimeout(cleanup, STYLE_AUTH_GRACE_MS);
      }
    };

    const onError = (event: { error?: unknown }) => {
      const error = event?.error;
      // The style document itself failed to load.
      if (extractErrorUrl(error) === styleUrl) {
        fail(error);
        return;
      }
      // A provider rejecting the just-applied style's resources (401/403) means
      // the basemap cannot render; the URL match above already handled a failed
      // descriptor, so this catches unauthorized tiles/sprites/glyphs.
      if (isCredentialed) {
        const status = extractErrorStatus(error);
        if (status === 401 || status === 403) fail(error);
      }
    };

    this._cancelStyleWatch = cleanup;
    map.once('style.load', onLoad);
    map.on('error', onError);
  }

  // Rolls back a failed style swap: restores the previously active basemap (when
  // it is a style basemap the control owns), then reports the failure inline and
  // through the `error` event. When the failing provider needs an API key, the
  // inline credential field is revealed so the user can correct the key and
  // retry without losing their map.
  private _handleStyleLoadFailure(
    failedBasemap: BasemapDefinition,
    previousActiveBasemapId: string | undefined,
    cause: unknown,
  ): void {
    this._restorePreviousBasemap(previousActiveBasemapId, failedBasemap.id);

    const status = extractErrorStatus(cause);
    const credentialProvider =
      failedBasemap.provider in PROVIDER_CREDENTIAL_HELP
        ? (failedBasemap.provider as keyof typeof PROVIDER_CREDENTIAL_HELP)
        : undefined;
    const hint = credentialProvider
      ? ' Check the API key and try again.'
      : ' Check your connection and try again.';
    const error = new BasemapLoadError(
      `Could not load the "${failedBasemap.name}" basemap${status ? ` (HTTP ${status})` : ''}.${hint}`,
      failedBasemap.provider,
      status,
    );

    this._state = { ...this._state, loading: false, error: error.message };
    this._missingCredentialProvider = credentialProvider;
    // Only offer an inline retry for a credentialed provider, where re-entering
    // the key and pressing Enter can reasonably succeed.
    this._lastFailedBasemapId = credentialProvider ? failedBasemap.id : undefined;
    this._activeView = 'basemaps';
    this._renderContent(true);
    this._handleError(error, failedBasemap);
  }

  // Reapplies the previously active style basemap after a failed swap. Only a
  // control-owned style/vector-style basemap can be reapplied; when the previous
  // basemap is unknown, a raster overlay, or a style the host owns, the panel
  // state is pointed back at it (so the failed basemap is not highlighted) and
  // the host is left to restore its own style from the emitted `error` event.
  private _restorePreviousBasemap(
    previousActiveBasemapId: string | undefined,
    failedBasemapId: string,
  ): void {
    const map = this._map;
    const previous =
      previousActiveBasemapId && previousActiveBasemapId !== failedBasemapId
        ? this._basemaps.find((candidate) => candidate.id === previousActiveBasemapId)
        : undefined;

    const pointStateAtPrevious = () => {
      this._state = {
        ...this._state,
        activeBasemapId: previousActiveBasemapId,
        activeBasemapIds: previousActiveBasemapId ? [previousActiveBasemapId] : [],
      };
    };

    if (
      !map ||
      !previous ||
      (previous.source.type !== 'style' && previous.source.type !== 'vector-style')
    ) {
      pointStateAtPrevious();
      return;
    }

    try {
      const styleUrl = this._resolveStyleUrl(previous);
      const styleOptions = this._getStyleOptions(previous);
      this._removeManagedBasemap();
      if (styleOptions) {
        map.setStyle(styleUrl, styleOptions);
      } else {
        map.setStyle(styleUrl);
      }
      this._state = {
        ...this._state,
        activeBasemapId: previous.id,
        activeBasemapIds: [previous.id],
      };
      this._emit({
        type: 'basemapchange',
        state: this.getState(),
        basemap: previous,
        resolvedStyleUrl: styleUrl,
        restored: true,
        mode: 'replace',
      });
    } catch {
      // If even the restore fails (e.g. the previous basemap now needs a key),
      // leave the panel pointing at the previous id rather than the broken one.
      pointStateAtPrevious();
    }
  }

  // The public mutators rethrow after emitting the error event so callers that
  // await them can react. The panel's click handler uses this instead to avoid
  // unhandled promise rejections; the failure is still reported via `error`.
  // In multiple mode a raster basemap click toggles the overlay on or off.
  private _selectBasemap(id: string): void {
    const basemap = this._basemaps.find((candidate) => candidate.id === id);
    const isOverlay =
      basemap?.source.type === 'raster' || basemap?.source.type === 'vector-overlay';
    if (this._state.allowMultiple && isOverlay) {
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

  // Clears the current error and its associated missing-credential provider so
  // the inline credential field and help link disappear together.
  private _clearError(): void {
    if (
      this._state.error === undefined &&
      this._missingCredentialProvider === undefined &&
      this._lastFailedBasemapId === undefined
    ) {
      return;
    }
    this._state = { ...this._state, error: undefined };
    this._missingCredentialProvider = undefined;
    this._lastFailedBasemapId = undefined;
  }

  // Records a missing-credential failure: stores the error, remembers the
  // provider (for the help link and inline field) and the basemap to retry, and
  // surfaces the basemaps view so the inline credential field beside the error
  // is visible (#837).
  private _enterCredentialError(error: MissingCredentialError, basemap: BasemapDefinition): void {
    this._state = { ...this._state, loading: false, error: error.message };
    this._missingCredentialProvider = error.provider as keyof typeof PROVIDER_CREDENTIAL_HELP;
    this._lastFailedBasemapId = basemap.id;
    this._activeView = 'basemaps';
    this._renderContent(true);
    this._handleError(error, basemap);
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

    // Key button: opens the dedicated API-keys settings view. Only meaningful
    // when at least one catalog basemap needs a provider credential, so its
    // visibility is reconciled in `_renderContent`.
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'basemap-control-settings-toggle';
    settingsBtn.type = 'button';
    settingsBtn.setAttribute('aria-label', 'API keys');
    settingsBtn.title = 'API keys';
    settingsBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>
      </svg>
    `;
    settingsBtn.addEventListener('click', () => this._toggleSettingsView());
    this._settingsButton = settingsBtn;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'basemap-control-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close basemap panel');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => this.collapse());

    header.appendChild(title);
    header.appendChild(settingsBtn);
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

    this._reconcileSettingsButton();

    // The settings view replaces the whole content area; never show it when the
    // catalog has no keyed providers (the button is hidden in that case too).
    if (this._activeView === 'settings' && this._hasProviderSettings()) {
      this._content.replaceChildren(this._createSettingsView());
      return;
    }

    const categories = getBasemapCategories(this._basemaps);
    const results = this._getFilteredBasemaps();
    const previousResultsScrollTop = preserveResultsScroll
      ? this._content.querySelector('.basemap-control-results')?.scrollTop
      : undefined;

    this._content.replaceChildren(
      this._createSearchRow(),
      ...(this._options.showMultipleToggle ? [this._createMultipleToggleRow()] : []),
      this._createFilterRow(this._providers, categories),
      this._createStatus(results.length),
      this._createResults(results),
    );

    if (previousResultsScrollTop !== undefined) {
      const resultsElement = this._content.querySelector('.basemap-control-results');
      if (resultsElement) resultsElement.scrollTop = previousResultsScrollTop;
    }
  }

  // Show the key button only when the catalog actually needs a provider
  // credential, and reflect whether the settings view is currently open.
  private _reconcileSettingsButton(): void {
    if (!this._settingsButton) return;
    const hasSettings = this._hasProviderSettings();
    this._settingsButton.hidden = !hasSettings;
    this._settingsButton.classList.toggle(
      'is-active',
      hasSettings && this._activeView === 'settings',
    );
  }

  private _toggleSettingsView(): void {
    if (!this._hasProviderSettings()) return;
    this._activeView = this._activeView === 'settings' ? 'basemaps' : 'settings';
    this._renderContent();
    this._emit({ type: 'statechange', state: this.getState() });
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
      // Browsing for an alternative basemap dismisses a stale credential error
      // so it stops obscuring the list (#837). Re-render fully (not just the
      // results) so the error banner is removed.
      const hadError = this._state.error !== undefined;
      this._state = { ...this._state, query: input.value };
      this._clearError();
      if (hadError) {
        this._renderContent();
        input.focus();
        const end = input.value.length;
        input.setSelectionRange?.(end, end);
      } else {
        this._renderFilteredResults();
      }
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

  // The ordered set of provider credential fields, gated by whether the catalog
  // actually contains basemaps for each provider. A single source of truth for
  // both the centralized settings view and the inline field shown beside a
  // missing-credential error, so the two never drift (#837).
  private _providerFieldDefs(): Array<{
    provider: keyof typeof PROVIDER_CREDENTIAL_HELP;
    label: string;
    has: boolean;
    fields: ProviderInputConfig[];
  }> {
    return [
      {
        provider: 'maptiler',
        label: 'MapTiler',
        has: this._hasMapTilerBasemaps(),
        fields: [
          {
            className: 'basemap-control-maptiler-key',
            type: 'password',
            placeholder: 'MapTiler API key',
            ariaLabel: 'MapTiler API key',
            value: this._mapTilerApiKey,
            onInput: (value) => {
              this._mapTilerApiKey = value;
            },
          },
        ],
      },
      {
        provider: 'mapbox',
        label: 'Mapbox',
        has: this._hasMapboxBasemaps(),
        fields: [
          {
            className: 'basemap-control-mapbox-token',
            type: 'password',
            placeholder: 'Mapbox access token',
            ariaLabel: 'Mapbox access token',
            value: this._mapboxAccessToken,
            onInput: (value) => {
              this._mapboxAccessToken = value;
            },
          },
        ],
      },
      {
        provider: 'protomaps',
        label: 'Protomaps',
        has: this._hasProtomapsBasemaps(),
        fields: [
          {
            className: 'basemap-control-protomaps-key',
            type: 'password',
            placeholder: 'Protomaps API key',
            ariaLabel: 'Protomaps API key',
            value: this._protomapsApiKey,
            onInput: (value) => {
              this._protomapsApiKey = value;
            },
          },
        ],
      },
      {
        provider: 'stadia',
        label: 'Stadia Maps',
        has: this._hasStadiaBasemaps(),
        fields: [
          {
            className: 'basemap-control-stadia-key',
            type: 'password',
            placeholder: 'Stadia Maps API key',
            ariaLabel: 'Stadia Maps API key',
            value: this._stadiaApiKey,
            onInput: (value) => {
              this._stadiaApiKey = value;
            },
          },
        ],
      },
      {
        provider: 'tianditu',
        label: 'Tianditu',
        has: this._hasTiandituBasemaps(),
        fields: [
          {
            className: 'basemap-control-tianditu-key',
            type: 'password',
            placeholder: 'Tianditu API key',
            ariaLabel: 'Tianditu API key',
            value: this._tiandituApiKey,
            onInput: (value) => {
              this._tiandituApiKey = value;
            },
          },
        ],
      },
      {
        provider: 'tomtom',
        label: 'TomTom',
        has: this._hasTomTomBasemaps(),
        fields: [
          {
            className: 'basemap-control-tomtom-key',
            type: 'password',
            placeholder: 'TomTom API key',
            ariaLabel: 'TomTom API key',
            value: this._tomtomApiKey,
            onInput: (value) => {
              this._tomtomApiKey = value;
            },
          },
        ],
      },
      {
        provider: 'here',
        label: 'HERE',
        has: this._hasHereBasemaps(),
        fields: [
          {
            className: 'basemap-control-here-key',
            type: 'password',
            placeholder: 'HERE API key',
            ariaLabel: 'HERE API key',
            value: this._hereApiKey,
            onInput: (value) => {
              this._hereApiKey = value;
            },
          },
        ],
      },
      {
        provider: 'google',
        label: 'Google',
        has: this._hasGoogleApiKeyBasemaps(),
        fields: [
          {
            className: 'basemap-control-google-key',
            type: 'password',
            placeholder: 'Google Maps API key',
            ariaLabel: 'Google Maps API key',
            value: this._googleMapsApiKey,
            onInput: (value) => {
              this._googleMapsApiKey = value;
              // Changing the key invalidates cached session tokens.
              this._googleSessions.clear();
            },
          },
        ],
      },
      {
        provider: 'amazon',
        label: 'Amazon',
        has: this._hasAmazonBasemaps(),
        fields: [
          {
            className: 'basemap-control-amazon-key',
            type: 'password',
            placeholder: 'Amazon API key',
            ariaLabel: 'Amazon API key',
            value: this._amazonApiKey,
            onInput: (value) => {
              this._amazonApiKey = value;
            },
          },
          {
            className: 'basemap-control-aws-region',
            type: 'text',
            placeholder: 'AWS region',
            ariaLabel: 'AWS region',
            value: this._awsRegion,
            onInput: (value) => {
              this._awsRegion = value;
            },
          },
        ],
      },
    ];
  }

  // The dedicated API-keys view, opened from the header key button. It collects
  // every provider credential in one place, separate from the basemap list, so
  // the list itself stays free of input clutter (#837, Bug 5).
  private _createSettingsView(): HTMLElement {
    const view = document.createElement('div');
    view.className = 'basemap-control-settings-view';

    const head = document.createElement('div');
    head.className = 'basemap-control-settings-head';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'basemap-control-settings-back';
    back.setAttribute('aria-label', 'Back to basemaps');
    back.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m15 18-6-6 6-6"/>
      </svg>
      <span>Basemaps</span>
    `;
    back.addEventListener('click', () => this._toggleSettingsView());

    const heading = document.createElement('span');
    heading.className = 'basemap-control-settings-heading';
    heading.textContent = 'API keys';

    head.appendChild(back);
    head.appendChild(heading);
    view.appendChild(head);

    const intro = document.createElement('p');
    intro.className = 'basemap-control-settings-intro';
    intro.textContent = 'Add the credentials each provider requires to use its basemaps.';
    view.appendChild(intro);

    const fields = document.createElement('div');
    fields.className = 'basemap-control-provider-settings-fields';
    for (const def of this._providerFieldDefs()) {
      if (def.has) fields.appendChild(this._createProviderFieldGroup(def));
    }
    view.appendChild(fields);

    return view;
  }

  private _createProviderFieldGroup(def: {
    provider: keyof typeof PROVIDER_CREDENTIAL_HELP;
    label: string;
    fields: ProviderInputConfig[];
  }): HTMLElement {
    const group = document.createElement('div');
    group.className = `basemap-control-provider-group basemap-control-provider-group-${def.provider}`;

    const label = document.createElement('span');
    label.className = 'basemap-control-provider-group-label';
    label.textContent = def.label;
    group.appendChild(label);

    for (const field of def.fields) {
      group.appendChild(this._createProviderSettingsInput(field));
    }
    return group;
  }

  // Renders the credential field(s) for the provider of the active
  // missing-credential error, inline beside the error message. Only that one
  // provider is shown, so the user is not asked to wade through every other
  // provider's inputs (#837, Bug 3). Returns null when no such error is active.
  private _createInlineCredentialFields(): HTMLElement | null {
    if (!this._state.error || !this._missingCredentialProvider) return null;
    const def = this._providerFieldDefs().find(
      (candidate) => candidate.provider === this._missingCredentialProvider && candidate.has,
    );
    if (!def) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'basemap-control-status-fields';
    for (const field of def.fields) {
      wrapper.appendChild(
        this._createProviderSettingsInput({
          ...field,
          // Keep the error (and this field) on screen while the user types, and
          // let Enter re-attempt the basemap that failed, so the field is not
          // yanked out from under the cursor on the first keystroke.
          rerenderOnInput: false,
          clearErrorOnInput: false,
          onEnter: () => this._retryLastFailedBasemap(),
        }),
      );
    }
    return wrapper;
  }

  private _retryLastFailedBasemap(): void {
    if (this._lastFailedBasemapId) this._selectBasemap(this._lastFailedBasemapId);
  }

  // Renders the optional API key input shown after a basemap falls back to its
  // keyless public tiles, so the user can enter a key to upgrade to the
  // authorized provider tiles (or leave it blank to keep the public ones).
  // Returns null unless such a basemap is the active selection and still keyless.
  private _createOptionalKeyPrompt(): HTMLElement | null {
    const id = this._optionalKeyBasemapId;
    if (!id) return null;
    const basemap = this._basemaps.find((candidate) => candidate.id === id);
    if (
      !basemap ||
      !this._state.activeBasemapIds.includes(id) ||
      !this._basemapUsesKeylessFallback(basemap)
    ) {
      return null;
    }

    const def = this._providerFieldDefs().find(
      (candidate) => candidate.provider === basemap.provider && candidate.has,
    );
    if (!def) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'basemap-control-optional-key';

    const message = document.createElement('span');
    message.className = 'basemap-control-optional-key-message';
    message.textContent = `Enter a ${def.fields[0].placeholder} to load the official ${def.label} tiles.`;

    const help = PROVIDER_CREDENTIAL_HELP[def.provider];
    if (help) {
      message.appendChild(document.createTextNode(' '));
      const link = document.createElement('a');
      link.className = 'basemap-control-status-link';
      link.href = help.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = help.label;
      message.appendChild(link);
    }
    wrapper.appendChild(message);

    const fields = document.createElement('div');
    fields.className = 'basemap-control-status-fields';
    for (const field of def.fields) {
      fields.appendChild(
        this._createProviderSettingsInput({
          ...field,
          // Keep the field on screen while typing; Enter re-applies the basemap
          // so the freshly entered key takes effect immediately.
          rerenderOnInput: false,
          clearErrorOnInput: false,
          onEnter: () => this._reapplyBasemap(id),
        }),
      );
    }
    wrapper.appendChild(fields);
    return wrapper;
  }

  private _createProviderSettingsInput({
    className,
    type,
    placeholder,
    ariaLabel,
    value,
    onInput,
    rerenderOnInput = true,
    clearErrorOnInput = true,
    onEnter,
  }: ProviderInputConfig & {
    rerenderOnInput?: boolean;
    clearErrorOnInput?: boolean;
    onEnter?: () => void;
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
      if (clearErrorOnInput) this._clearError();
      if (rerenderOnInput) this._renderFilteredResults();
      this._emit({ type: 'statechange', state: this.getState() });
    });
    if (onEnter) {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onEnter();
        }
      });
    }

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
          // Filtering to browse other basemaps clears a stale error (#837).
          this._clearError();
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
          this._clearError();
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
      status.classList.add('is-error');
      const message = document.createElement('span');
      message.className = 'basemap-control-status-message';
      message.textContent = this._state.error;
      status.appendChild(message);

      // A missing-credential error is otherwise a dead end: append a link to
      // where the credential is issued and point at the Provider settings
      // inputs (which the error also auto-expands).
      const help = this._credentialHelpForError(this._missingCredentialProvider);
      if (help) {
        const actions = document.createElement('span');
        actions.className = 'basemap-control-status-actions';

        const link = document.createElement('a');
        link.className = 'basemap-control-status-link';
        link.href = help.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = help.label;
        actions.appendChild(link);

        const hint = document.createElement('span');
        hint.className = 'basemap-control-status-hint';
        hint.textContent = ', then enter it below and press Enter.';
        actions.appendChild(hint);

        status.appendChild(actions);
      }

      // Show only the failing provider's credential field, right beside the
      // error, so the fix is one input away instead of buried among every
      // provider's settings (#837).
      const inlineFields = this._createInlineCredentialFields();
      if (inlineFields) status.appendChild(inlineFields);
    } else {
      const count = document.createElement('span');
      count.className = 'basemap-control-status-message';
      count.textContent = `${resultCount} basemap${resultCount === 1 ? '' : 's'}`;
      status.appendChild(count);

      // After a basemap falls back to keyless public tiles, offer an optional
      // key input right here so upgrading to the authorized tiles is one field
      // away, without hunting for the provider settings view.
      const optionalKey = this._createOptionalKeyPrompt();
      if (optionalKey) {
        status.classList.add('has-optional-key');
        status.appendChild(optionalKey);
      }
    }
    return status;
  }

  // Resolves the help link for a missing-credential provider, so the status can
  // offer a concrete next step. Returns undefined when there is no such error.
  private _credentialHelpForError(
    provider?: keyof typeof PROVIDER_CREDENTIAL_HELP,
  ): { url: string; label: string } | undefined {
    return provider ? PROVIDER_CREDENTIAL_HELP[provider] : undefined;
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
      type.textContent =
        basemap.type === 'raster'
          ? 'Raster'
          : basemap.type === 'vector-overlay'
            ? 'Overlay'
            : 'Style';

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

  private _hasProtomapsBasemaps(): boolean {
    return this._basemaps.some((basemap) => basemap.provider === 'protomaps');
  }

  private _hasStadiaBasemaps(): boolean {
    return this._basemaps.some((basemap) => basemap.provider === 'stadia');
  }

  private _hasTiandituBasemaps(): boolean {
    return this._basemaps.some((basemap) => basemap.provider === 'tianditu');
  }

  private _hasTomTomBasemaps(): boolean {
    return this._basemaps.some((basemap) => basemap.provider === 'tomtom');
  }

  private _hasHereBasemaps(): boolean {
    return this._basemaps.some((basemap) => basemap.provider === 'here');
  }

  // True when a Google basemap can use a Map Tiles API key. Session-based Google
  // layers (Google Traffic, plus the base Maps/Satellite/Terrain/Hybrid layers
  // that upgrade to the authorized Map Tiles API when a key is present) and any
  // api-key based Google tiles reveal the key input.
  private _hasGoogleApiKeyBasemaps(): boolean {
    return this._basemaps.some(
      (basemap) =>
        basemap.provider === 'google' &&
        basemap.source.type === 'raster' &&
        (Boolean(basemap.source.googleSession) ||
          basemap.source.tiles.some((tile) => tile.includes(API_KEY_PLACEHOLDER))),
    );
  }

  private _hasProviderSettings(): boolean {
    return (
      this._hasMapTilerBasemaps() ||
      this._hasAmazonBasemaps() ||
      this._hasMapboxBasemaps() ||
      this._hasProtomapsBasemaps() ||
      this._hasStadiaBasemaps() ||
      this._hasTiandituBasemaps() ||
      this._hasTomTomBasemaps() ||
      this._hasHereBasemaps() ||
      this._hasGoogleApiKeyBasemaps()
    );
  }

  private _resolveStyleUrl(basemap: BasemapDefinition): string {
    if (basemap.source.type !== 'style' && basemap.source.type !== 'vector-style') {
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

    if (basemap.provider === 'protomaps') {
      return this._resolveProtomapsStyleUrl(url);
    }

    return url;
  }

  private _resolveProtomapsStyleUrl(url: string): string {
    if (!url.includes(API_KEY_PLACEHOLDER)) return url;

    const apiKey = this._protomapsApiKey.trim();
    if (!apiKey) {
      throw new MissingCredentialError(
        'Enter a Protomaps API key before applying this basemap.',
        'protomaps',
      );
    }

    return url.split(API_KEY_PLACEHOLDER).join(encodeURIComponent(apiKey));
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
      throw new MissingCredentialError(
        'Enter a MapTiler API key before applying this basemap.',
        'maptiler',
      );
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
      throw new MissingCredentialError(
        'Enter an Amazon API key before applying this basemap.',
        'amazon',
      );
    }
    if (url.includes(AWS_REGION_PLACEHOLDER) && !awsRegion) {
      throw new MissingCredentialError(
        'Enter an AWS region before applying this basemap.',
        'amazon',
      );
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
      throw new MissingCredentialError(
        'Enter a Mapbox access token before applying this basemap.',
        'mapbox',
      );
    }
    if (this._isUrlLikeCredential(accessToken)) {
      throw new MissingCredentialError(
        'Enter a valid Mapbox access token, not a URL.',
        'mapbox',
      );
    }

    return url.split(API_KEY_PLACEHOLDER).join(encodeURIComponent(accessToken));
  }

  private _isUrlLikeCredential(value: string): boolean {
    return /^https?:\/\//i.test(value);
  }

  // Add a stackable overlay (raster tiles or a vector overlay) to the map,
  // resolving any provider credentials first.
  private async _addOverlay(
    basemap: BasemapDefinition,
  ): Promise<ManagedRasterBasemap | undefined> {
    if (basemap.source.type === 'vector-overlay') {
      return this._addVectorOverlay(basemap, basemap.source);
    }
    return this._addRasterBasemap(basemap);
  }

  private async _addRasterBasemap(
    basemap: BasemapDefinition,
  ): Promise<ManagedRasterBasemap | undefined> {
    if (!this._map || basemap.source.type !== 'raster') return undefined;

    const tiles = await this._resolveRasterTiles(basemap);

    const sourceId = `${CONTROL_SOURCE_PREFIX}-${basemap.id}`;
    const layerId = [CONTROL_LAYER_PREFIX, basemap.id].filter(Boolean).join('-');
    const beforeId = this._getBasemapInsertBeforeId();
    const source: SourceSpecification = {
      type: 'raster',
      tiles,
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

  private _addVectorOverlay(
    basemap: BasemapDefinition,
    overlay: VectorOverlayBasemapSource,
  ): ManagedRasterBasemap | undefined {
    if (!this._map) return undefined;

    const sourceId = `${CONTROL_SOURCE_PREFIX}-${basemap.id}`;
    const layerId = [CONTROL_LAYER_PREFIX, basemap.id].filter(Boolean).join('-');
    const beforeId = this._getBasemapInsertBeforeId();

    const source = {
      type: 'vector',
      ...this._resolveVectorOverlaySource(basemap, overlay),
      minzoom: overlay.minzoom,
      maxzoom: overlay.maxzoom,
      attribution: basemap.attribution,
    } as SourceSpecification;

    const layer = {
      id: layerId,
      type: overlay.layerType ?? 'line',
      source: sourceId,
      'source-layer': overlay.sourceLayer,
      ...(overlay.layout ? { layout: overlay.layout } : {}),
      ...(overlay.paint ? { paint: overlay.paint } : {}),
    } as LayerSpecification;

    this._map.addSource(sourceId, source);
    this._map.addLayer(layer, beforeId);
    const managed: ManagedRasterBasemap = { sourceId, layerId, beforeId };
    this._managedRasters.set(basemap.id, managed);

    return managed;
  }

  // Resolves the `{url}` or `{tiles}` of a vector overlay, substituting provider
  // credentials. Mapbox vector overlays are pointed at the v4 TileJSON endpoint
  // with the access token, reusing the same resolver as Mapbox style sources.
  private _resolveVectorOverlaySource(
    basemap: BasemapDefinition,
    overlay: VectorOverlayBasemapSource,
  ): { url: string } | { tiles: string[] } {
    if (basemap.provider === 'mapbox') {
      const accessToken = this._mapboxAccessToken.trim();
      if (!accessToken) {
        throw new MissingCredentialError(
          'Enter a Mapbox access token before applying this overlay.',
          'mapbox',
        );
      }
      if (this._isUrlLikeCredential(accessToken)) {
        throw new MissingCredentialError(
          'Enter a valid Mapbox access token, not a URL.',
          'mapbox',
        );
      }
      const encoded = encodeURIComponent(accessToken);
      if (overlay.url) {
        return { url: this._resolveMapboxInternalUrl(overlay.url, encoded) };
      }
    }

    if (overlay.url) return { url: overlay.url };
    if (overlay.tiles) return { tiles: overlay.tiles };
    throw new Error(`Vector overlay "${basemap.id}" has no url or tiles.`);
  }

  // Resolves the tile templates of a raster basemap, substituting provider
  // credentials (and, for Google, a Map Tiles API session token). Throws a
  // MissingCredentialError when a required key is absent so the panel can
  // surface a "Get a ..." link and reveal the credential inputs.
  private async _resolveRasterTiles(basemap: BasemapDefinition): Promise<string[]> {
    if (basemap.source.type !== 'raster') return [];
    const { tiles, googleSession, sessionTiles } = basemap.source;

    if (googleSession) {
      // `tiles` holds the public keyless templates for the base Maps/Satellite/
      // Terrain/Hybrid layers, so with no Google Maps API key they are used
      // as-is and nothing touches the Map Tiles API. With a key they upgrade to
      // `sessionTiles`. Sources that cannot work keylessly (e.g. Google Traffic)
      // have no `sessionTiles` and keep the session template in `tiles`; those
      // still go through the session resolver, which surfaces the missing
      // credential error when no key is set.
      const templates = sessionTiles?.length ? sessionTiles : tiles;
      if (this._googleMapsApiKey.trim() || !sessionTiles?.length) {
        return this._resolveGoogleSessionTiles(templates, googleSession);
      }
      return tiles;
    }

    if (!tiles.some((tile) => tile.includes(API_KEY_PLACEHOLDER))) {
      return tiles;
    }

    const apiKey = this._rasterApiKeyFor(basemap.provider);
    if (!apiKey) {
      throw this._missingRasterKeyError(basemap.provider);
    }
    const encoded = encodeURIComponent(apiKey);
    return tiles.map((tile) => tile.split(API_KEY_PLACEHOLDER).join(encoded));
  }

  private _rasterApiKeyFor(provider: string): string {
    if (provider === 'tomtom') return this._tomtomApiKey.trim();
    if (provider === 'here') return this._hereApiKey.trim();
    if (provider === 'stadia') return this._stadiaApiKey.trim();
    if (provider === 'tianditu') return this._tiandituApiKey.trim();
    if (provider === 'google') return this._googleMapsApiKey.trim();
    return '';
  }

  // True when a basemap is (or would be) served from its public keyless `tiles`
  // because its provider API key is not set. Drives the optional key prompt:
  // these basemaps work without a key but can upgrade to the authorized
  // provider tiles (`sessionTiles`) once one is entered.
  private _basemapUsesKeylessFallback(basemap: BasemapDefinition): boolean {
    return (
      basemap.source.type === 'raster' &&
      Boolean(basemap.source.googleSession) &&
      (basemap.source.sessionTiles?.length ?? 0) > 0 &&
      !this._rasterApiKeyFor(basemap.provider)
    );
  }

  // Re-applies an already-active basemap so a newly entered key takes effect.
  // Unlike `_selectBasemap`, this never toggles the basemap off in multiple
  // mode: a stacked raster is re-added on top (replacing its prior instance),
  // and a single-mode basemap is simply re-set.
  private _reapplyBasemap(id: string): void {
    const basemap = this._basemaps.find((candidate) => candidate.id === id);
    const isOverlay =
      basemap?.source.type === 'raster' || basemap?.source.type === 'vector-overlay';
    if (this._state.allowMultiple && isOverlay) {
      this.addBasemap(id).catch(() => {});
    } else {
      this.setBasemap(id).catch(() => {});
    }
  }

  private _missingRasterKeyError(provider: string): MissingCredentialError {
    const label = RASTER_KEY_LABELS[provider] ?? 'API key';
    const helpProvider = (
      provider in PROVIDER_CREDENTIAL_HELP ? provider : 'maptiler'
    ) as keyof typeof PROVIDER_CREDENTIAL_HELP;
    return new MissingCredentialError(`Enter a ${label} before applying this layer.`, helpProvider);
  }

  // Resolves Google tile templates by minting (or reusing) a Map Tiles API
  // session token, then substituting both `{session}` and `{api-key}`.
  private async _resolveGoogleSessionTiles(
    tiles: string[],
    config: GoogleSessionConfig,
  ): Promise<string[]> {
    const apiKey = this._googleMapsApiKey.trim();
    if (!apiKey) {
      throw new MissingCredentialError(
        'Enter a Google Maps API key before applying this layer.',
        'google',
      );
    }

    const token = await this._getGoogleSessionToken(apiKey, config);
    const encodedKey = encodeURIComponent(apiKey);
    const encodedSession = encodeURIComponent(token);
    return tiles.map((tile) =>
      tile.split('{session}').join(encodedSession).split(API_KEY_PLACEHOLDER).join(encodedKey),
    );
  }

  private async _getGoogleSessionToken(
    apiKey: string,
    config: GoogleSessionConfig,
  ): Promise<string> {
    const cacheKey = `${apiKey}:${JSON.stringify(config)}`;
    const cached = this._googleSessions.get(cacheKey);
    // Treat the token as expired a minute early to avoid a tile request racing
    // the expiry boundary.
    if (cached && cached.expiry - 60_000 > Date.now()) {
      return cached.token;
    }

    const response = await fetch(
      `https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapType: config.mapType,
          language: config.language ?? 'en-US',
          region: config.region ?? 'US',
          layerTypes: config.layerTypes,
          overlay: config.overlay,
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new MissingCredentialError(
        `Google could not create a tile session (HTTP ${response.status}). ${this._summarizeGoogleError(
          detail,
        )}`.trim(),
        'google',
      );
    }

    const data = (await response.json()) as { session?: string; expiry?: string };
    if (!data.session) {
      throw new MissingCredentialError(
        'Google did not return a tile session token. Check that the Map Tiles API is enabled for your key.',
        'google',
      );
    }

    // `expiry` is a Unix timestamp in seconds (as a string); fall back to a
    // conservative 1-hour lifetime if it is missing or unparsable.
    const expirySeconds = data.expiry ? Number(data.expiry) : NaN;
    const expiry = Number.isFinite(expirySeconds)
      ? expirySeconds * 1000
      : Date.now() + 60 * 60 * 1000;
    this._googleSessions.set(cacheKey, { token: data.session, expiry });
    return data.session;
  }

  private _summarizeGoogleError(detail: string): string {
    if (!detail) return '';
    try {
      const parsed = JSON.parse(detail) as { error?: { message?: string } };
      return parsed.error?.message ?? '';
    } catch {
      return detail.slice(0, 200);
    }
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
