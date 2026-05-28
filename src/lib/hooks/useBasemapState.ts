import { useCallback, useState } from 'react';
import type { BasemapControlState } from '../core/types';

const DEFAULT_STATE: BasemapControlState = {
  collapsed: true,
  panelWidth: 340,
  query: '',
  providerFilter: '',
  categoryFilter: '',
  beforeId: '',
  loading: false,
};

export function useBasemapState(initialState?: Partial<BasemapControlState>) {
  const [state, setState] = useState<BasemapControlState>({
    ...DEFAULT_STATE,
    ...initialState,
  });

  const setCollapsed = useCallback((collapsed: boolean) => {
    setState((prev) => ({ ...prev, collapsed }));
  }, []);

  const setPanelWidth = useCallback((panelWidth: number) => {
    setState((prev) => ({ ...prev, panelWidth }));
  }, []);

  const setActiveBasemapId = useCallback((activeBasemapId: string | undefined) => {
    setState((prev) => ({ ...prev, activeBasemapId }));
  }, []);

  const setQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, query }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...DEFAULT_STATE, ...initialState });
  }, [initialState]);

  const toggle = useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: !prev.collapsed }));
  }, []);

  return {
    state,
    setState,
    setCollapsed,
    setPanelWidth,
    setActiveBasemapId,
    setQuery,
    reset,
    toggle,
  };
}
