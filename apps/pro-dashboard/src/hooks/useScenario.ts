import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_SCENARIO } from '../lib/defaults';
import { getSupabase } from '../lib/supabase';
import { PersistedScenario, ScenarioState } from '../lib/types';

const STORAGE_KEY = 'pro-dashboard-scenario-v2';

type PersistenceMode = 'supabase' | 'local';

export const useScenario = () => {
  const supabase = useMemo(() => getSupabase(), []);
  const [state, setState] = useState<ScenarioState>(DEFAULT_SCENARIO);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<PersistenceMode>('local');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        if (supabase) {
          const { data, error: supabaseError } = await supabase
            .from('scenarios')
            .select('id, updated_at, payload')
            .eq('slug', 'executive-pro')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (supabaseError) {
            throw supabaseError;
          }
          if (!cancelled && data?.payload) {
            setState({ ...DEFAULT_SCENARIO, ...(data.payload as ScenarioState) });
            setMode('supabase');
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Supabase unavailable, falling back to local storage', err);
        setError('Supabase connection unavailable, using local mode.');
      }
      try {
        const local = window.localStorage.getItem(STORAGE_KEY);
        if (local) {
          const parsed = JSON.parse(local) as ScenarioState;
          if (!cancelled) {
            setState({ ...DEFAULT_SCENARIO, ...parsed });
          }
        }
      } catch (localError) {
        console.warn('Unable to read scenario from local storage', localError);
        setError('Scenario storage is unavailable.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const persist = useCallback(
    async (next: ScenarioState) => {
      setState(next);
      setError(null);
      if (supabase) {
        try {
          const payload: PersistedScenario = { ...next };
          const { error: upsertError } = await supabase.from('scenarios').upsert(
            {
              slug: 'executive-pro',
              payload,
            },
            { onConflict: 'slug' },
          );
          if (upsertError) {
            throw upsertError;
          }
          setMode('supabase');
          return;
        } catch (supabaseError) {
          console.error('Failed to persist to Supabase, reverting to local', supabaseError);
          setError('Supabase write failed; retaining local copy.');
        }
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setMode('local');
      } catch (storageError) {
        console.error('Unable to persist scenario locally', storageError);
        setError('Unable to persist scenario locally.');
      }
    },
    [supabase],
  );

  return { state, setState: persist, loading, mode, error };
};
