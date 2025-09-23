import { useCallback, useEffect, useRef, useState } from "react";

const cache = new Map();

export default function useSWR(key, fetcher, options = {}) {
  const { revalidateOnFocus = false } = options;
  const cacheKey = key ? JSON.stringify(key) : null;
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const [data, setData] = useState(() => {
    if (!cacheKey) return undefined;
    return cache.get(cacheKey);
  });
  const [error, setError] = useState(undefined);
  const [isValidating, setIsValidating] = useState(Boolean(key));

  const fetchData = useCallback(async () => {
    if (!cacheKey) return undefined;
    setIsValidating(true);
    try {
      const result = await fetcherRef.current(key);
      cache.set(cacheKey, result);
      setData(result);
      setError(undefined);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsValidating(false);
    }
  }, [cacheKey, key]);

  useEffect(() => {
    if (!cacheKey) {
      setData(undefined);
      setError(undefined);
      setIsValidating(false);
      return undefined;
    }

    let cancelled = false;

    const run = async () => {
      const cached = cache.get(cacheKey);
      if (cached !== undefined) {
        setData(cached);
        setIsValidating(false);
        return;
      }

      setIsValidating(true);
      try {
        const result = await fetcherRef.current(key);
        if (cancelled) return;
        cache.set(cacheKey, result);
        setData(result);
        setError(undefined);
      } catch (err) {
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setIsValidating(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, key]);

  useEffect(() => {
    if (!revalidateOnFocus || typeof window === "undefined") {
      return undefined;
    }

    const onFocus = () => {
      if (cacheKey) {
        fetchData();
      }
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [cacheKey, fetchData, revalidateOnFocus]);

  const mutate = useCallback(
    async (value, shouldRevalidate = true) => {
      if (!cacheKey) return undefined;

      if (typeof value !== "undefined") {
        const resolved =
          typeof value === "function" ? value(cache.get(cacheKey)) : value;
        const finalValue = resolved instanceof Promise ? await resolved : resolved;
        cache.set(cacheKey, finalValue);
        setData(finalValue);
        setError(undefined);
        if (!shouldRevalidate) {
          return finalValue;
        }
      }

      return fetchData();
    },
    [cacheKey, fetchData]
  );

  return {
    data,
    error,
    isLoading: Boolean(cacheKey) && !data && !error && isValidating,
    isValidating,
    mutate,
  };
}

