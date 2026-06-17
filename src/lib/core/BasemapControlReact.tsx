import { useEffect, useMemo, useRef } from 'react';
import { BasemapControl } from './BasemapControl';
import { createBasemapCatalog } from './catalog';
import type { BasemapControlReactProps } from './types';

export function BasemapControlReact({
  map,
  onStateChange,
  onBasemapChange,
  onBasemapRemove,
  onError,
  activeBasemapId,
  ...options
}: BasemapControlReactProps): null {
  const controlRef = useRef<BasemapControl | null>(null);
  const basemapKey = useMemo(
    () => options.basemaps?.map((basemap) => basemap.id).join('|') ?? '',
    [options.basemaps],
  );
  const didInitCatalog = useRef(false);

  useEffect(() => {
    const control = new BasemapControl({
      ...options,
      defaultBasemapId: activeBasemapId ?? options.defaultBasemapId,
    });
    controlRef.current = control;

    if (onStateChange) {
      control.on('statechange', (event) => onStateChange(event.state));
    }
    if (onBasemapChange) {
      control.on('basemapchange', (event) => {
        if (event.type === 'basemapchange') {
          onBasemapChange(event.basemap, event.state);
        }
      });
    }
    if (onBasemapRemove) {
      control.on('basemapremove', (event) => {
        if (event.type === 'basemapremove') {
          onBasemapRemove(event.basemap, event.state);
        }
      });
    }
    if (onError) {
      control.on('error', (event) => {
        if (event.type === 'error') {
          onError(event.error, event.state);
        }
      });
    }

    map.addControl(control, options.position ?? 'top-right');

    return () => {
      if (map.hasControl(control)) {
        map.removeControl(control);
      }
      controlRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const control = controlRef.current;
    if (!control) return;
    // Skip the first run: the control was just built with this catalog.
    // Updating in place (instead of recreating the control) avoids tearing
    // down and re-adding the managed basemap layer on catalog changes.
    if (!didInitCatalog.current) {
      didInitCatalog.current = true;
      return;
    }
    control.setBasemaps(createBasemapCatalog(options.basemaps, options.includeDefaultBasemaps));
  }, [basemapKey]);

  useEffect(() => {
    const control = controlRef.current;
    if (!control || options.collapsed === undefined) return;

    const currentState = control.getState();
    if (options.collapsed === currentState.collapsed) return;

    if (options.collapsed) {
      control.collapse();
    } else {
      control.expand();
    }
  }, [options.collapsed]);

  useEffect(() => {
    const control = controlRef.current;
    if (!control || !activeBasemapId) return;
    if (control.getState().activeBasemapId === activeBasemapId) return;

    // Failures are surfaced through the control's error event (onError);
    // swallow the rejection so it does not become an unhandled rejection.
    control.setBasemap(activeBasemapId).catch(() => {});
  }, [activeBasemapId]);

  return null;
}
