/**
 * Shared hook for property scores list.
 * Use in both React (web) and React Native screens so data logic stays in one place.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/api';

const DEFAULT_ORDER = '-created_date';

export function usePropertyScores(options = {}) {
  const { order = DEFAULT_ORDER } = options;
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.entities.PropertyScore.list(order);
      setScores(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e);
      setScores([]);
    } finally {
      setLoading(false);
    }
  }, [order]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deleteScore = useCallback(async (id) => {
    await api.entities.PropertyScore.delete(id);
    setScores((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { scores, loading, error, refresh, deleteScore };
}
