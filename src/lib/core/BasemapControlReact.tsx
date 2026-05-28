import { useEffect, useMemo, useRef } from 'react';
import { BasemapControl } from './BasemapControl';
import type { BasemapControlReactProps } from './types';

export function BasemapControlReact({
  map,
  onStateChange,
  onBasemapChange,
  onError,
  activeBasemapId,
  ...options
}: BasemapControlReactProps): null {
  const controlRef = useRef<BasemapControl | null>(null);
  const basemapKey = useMemo(
    () => options.basemaps?.map((basemap) => basemap.id).join('|') ?? '',
    [options.basemaps],
  );

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
  }, [map, basemapKey]);

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

    void control.setBasemap(activeBasemapId);
  }, [activeBasemapId]);

  return null;
}
