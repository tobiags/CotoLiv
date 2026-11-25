import {useEffect, useState} from 'react';
import type {ComputedRouteData} from '../types/delivery';
import {loadGeography, type MapGeography} from '../utils/mapGeography';

export function useMapGeography(route: ComputedRouteData | null) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    route: ComputedRouteData | null;
    data: MapGeography | null;
    error: string | null;
  }>({route: null, data: null, error: null});
  useEffect(() => {
    if (!route) return;
    const controller = new AbortController();
    setState({route, data: null, error: null});
    loadGeography(route, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({route, data, error: null});
    }).catch(error => {
      if (!controller.signal.aborted) setState({route, data: null,
        error: error.name === 'TimeoutError' ? 'Le chargement a pris trop de temps. Réessayez.'
          : error.message || 'Données géographiques indisponibles.'});
    });
    return () => controller.abort();
  }, [route, attempt]);
  // A previous order's geometry must never appear under a new route.
  const current = state.route === route ? state : {data: null, error: null};
  return {...current, loading: Boolean(route && !current.data && !current.error),
    retry: () => setAttempt(n => n + 1)};
}
