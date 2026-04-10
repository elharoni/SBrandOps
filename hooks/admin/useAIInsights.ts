// hooks/admin/useAIInsights.ts
import { useState, useEffect } from 'react';
import { AIInsight } from '../../types';
import { getAIInsights } from '../../services/adminService';

// A simple hook to simulate React Query's behavior for this specific case
export const useAIInsights = () => {
  const [data, setData] = useState<AIInsight[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setIsLoading(true);
        const insights = await getAIInsights();
        setData(insights);
      } catch (e) {
        setError(e as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsights();
  }, []);

  return { data, isLoading, error };
};
