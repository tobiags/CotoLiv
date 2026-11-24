import {useCallback, useEffect, useRef, useState} from 'react';
import {useMapsLibrary} from '@vis.gl/react-google-maps';
import {isGmpQuotaError} from '../utils/routeTracking';

export interface UseAutocompleteSuggestionsReturn {
  suggestions: google.maps.places.AutocompleteSuggestion[];
  isLoading: boolean;
  error: string | null;
  resetSession: () => void;
}

/**
 * Modern Places API (New) autocomplete hook using AutocompleteSuggestion and
 * AutocompleteSessionToken, scoped to Benin (Cotonou).
 */
export function useAutocompleteSuggestions(
  inputString: string
): UseAutocompleteSuggestionsReturn {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!placesLib) return;

    const trimmed = inputString.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      const {AutocompleteSessionToken, AutocompleteSuggestion} = placesLib;

      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new AutocompleteSessionToken();
      }

      const request: google.maps.places.AutocompleteRequest = {
        input: trimmed,
        sessionToken: sessionTokenRef.current,
        includedRegionCodes: ['bj'],
        language: 'fr',
        region: 'BJ',
      };

      setIsLoading(true);
      setError(null);

      AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
        .then((res) => {
          if (cancelled) return;
          setSuggestions(res?.suggestions ?? []);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          console.error('AutocompleteSuggestion error:', err);
          if (isGmpQuotaError(err)) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
          setSuggestions([]);
          setError('Suggestions indisponibles pour le moment.');
          setIsLoading(false);
        });
    }, 240);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [placesLib, inputString]);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    setSuggestions([]);
  }, []);

  return {suggestions, isLoading, error, resetSession};
}
