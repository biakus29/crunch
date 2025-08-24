// src/hooks/useMenuFilters.js
// Filtrage des items avec debounce et derivees mémoïsées
import { useEffect, useMemo, useState } from 'react';

export default function useMenuFilters(items = [], { initialQuery = '', delay = 250 } = {}) {
  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.toLowerCase()), delay);
    return () => clearTimeout(t);
  }, [query, delay]);

  const filtered = useMemo(() => {
    if (!debounced) return items;
    return items.filter((it) => {
      const name = it?.name?.toLowerCase?.() || '';
      const desc = it?.description?.toLowerCase?.() || '';
      return name.includes(debounced) || desc.includes(debounced);
    });
  }, [items, debounced]);

  return { query, setQuery, filtered };
}
