export type BrandCategoryName = { name?: string | null } | null | undefined;

export type ProductLike = {
  id: string;
  name: string;
  brand?: BrandCategoryName;
  category?: BrandCategoryName;
};

export type PreferredPair = { brand: string; category: string };

export type PoolMode = 'intersection' | 'all';

export type Strategy = 'seed' | 'weighted-pair' | 'uniform-pair' | 'topk-pair' | 'round-robin-pair';

export function normalizeName(value?: string | null): string {
  return (value || '').toLowerCase().trim();
}

export function compactText(value: string, maxLen = 140): string {
  const cleaned = (value || '').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLen - 1))}…`;
}

export function buildNormalizedSet(values: string[]): Set<string> {
  return new Set(values.map(v => normalizeName(v)));
}

export function isPopularIntersectionProduct(
  product: { brand?: BrandCategoryName; category?: BrandCategoryName },
  normalizedPopularBrandNames: Set<string>,
  normalizedPopularCategoryNames: Set<string>,
): boolean {
  const brandName = normalizeName(product.brand?.name);
  const categoryName = normalizeName(product.category?.name);
  return Boolean(
    brandName && categoryName && normalizedPopularBrandNames.has(brandName) && normalizedPopularCategoryNames.has(categoryName),
  );
}

export function buildPairMap<T extends { brand?: BrandCategoryName; category?: BrandCategoryName }>(products: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const p of products) {
    const brand = normalizeName(p.brand?.name);
    const category = normalizeName(p.category?.name);
    if (!brand || !category) continue;
    const key = `${brand}||${category}`;
    const existing = map.get(key);
    if (existing) existing.push(p);
    else map.set(key, [p]);
  }
  return map;
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickWeightedKey(keysWithWeights: Array<{ key: string; weight: number }>): string | null {
  const total = keysWithWeights.reduce((sum, x) => sum + Math.max(0, x.weight), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const x of keysWithWeights) {
    const w = Math.max(0, x.weight);
    if (w === 0) continue;
    r -= w;
    if (r <= 0) return x.key;
  }
  return keysWithWeights[keysWithWeights.length - 1]?.key ?? null;
}

export function pickProductFromPairMap<T>(
  pairMap: Map<string, T[]>,
  fallback: T[],
  opts: {
    preferredPairs: PreferredPair[];
    preferredChance: number; // 0..1
    strategy: Exclude<Strategy, 'round-robin-pair'>;
    topk: number;
  },
): T {
  const preferredChance = clamp01(opts.preferredChance);

  // Preferred pair'i olasılıkla dene
  if (opts.preferredPairs.length > 0 && preferredChance > 0 && Math.random() < preferredChance) {
    for (const pair of opts.preferredPairs) {
      const key = `${normalizeName(pair.brand)}||${normalizeName(pair.category)}`;
      const items = pairMap.get(key);
      if (items && items.length > 0) return randomItem(items);
    }
  }

  if (pairMap.size === 0) return randomItem(fallback);

  const entries = Array.from(pairMap.entries()).filter(([, items]) => (items?.length || 0) > 0);
  if (entries.length === 0) return randomItem(fallback);

  let selectedKey: string | null = null;
  if (opts.strategy === 'seed') {
    // Seed'deki davranış: en dolu pair'a kilitlenir (analiz için kalsın)
    const sorted = entries.sort((a, b) => (b[1]?.length || 0) - (a[1]?.length || 0));
    selectedKey = sorted[0]?.[0] ?? null;
  } else if (opts.strategy === 'weighted-pair') {
    selectedKey = pickWeightedKey(entries.map(([key, items]) => ({ key, weight: items.length })));
  } else if (opts.strategy === 'uniform-pair') {
    selectedKey = randomItem(entries.map(([key]) => key));
  } else if (opts.strategy === 'topk-pair') {
    const k = Math.max(1, Math.floor(opts.topk || 5));
    const sorted = entries.sort((a, b) => (b[1]?.length || 0) - (a[1]?.length || 0)).slice(0, Math.min(k, entries.length));
    selectedKey = randomItem(sorted.map(([key]) => key));
  }

  const bucket = (selectedKey ? pairMap.get(selectedKey) : null) || null;
  if (bucket && bucket.length > 0) return randomItem(bucket);
  return randomItem(fallback);
}

export function createRoundRobinPairPicker<T extends { id: string }>(
  pairMap: Map<string, T[]>,
  fallback: T[],
  opts: { preferredPairs: PreferredPair[]; preferredChance: number; dedupe: boolean },
): () => T {
  const preferredChance = clamp01(opts.preferredChance);

  const buckets = new Map<string, T[]>();
  for (const [key, items] of pairMap.entries()) {
    if (!items || items.length === 0) continue;
    buckets.set(key, shuffleInPlace([...items]));
  }

  let keys = shuffleInPlace(Array.from(buckets.keys()));
  let idx = 0;
  const seen = new Set<string>();
  const fallbackArr = [...fallback];

  return () => {
    if (opts.preferredPairs.length > 0 && preferredChance > 0 && Math.random() < preferredChance) {
      for (const pair of opts.preferredPairs) {
        const key = `${normalizeName(pair.brand)}||${normalizeName(pair.category)}`;
        const bucket = buckets.get(key);
        if (bucket && bucket.length > 0) {
          const p = bucket[bucket.length - 1]!;
          if (opts.dedupe) bucket.pop();
          if (!opts.dedupe) return p;
          if (!seen.has(p.id)) {
            seen.add(p.id);
            return p;
          }
        }
      }
    }

    for (let guard = 0; guard < Math.max(1, keys.length * 3); guard++) {
      if (keys.length === 0) break;
      if (idx >= keys.length) idx = 0;
      const key = keys[idx]!;
      const bucket = buckets.get(key);

      if (!bucket || bucket.length === 0) {
        keys.splice(idx, 1);
        continue;
      }

      const p = bucket[bucket.length - 1]!;
      if (opts.dedupe) bucket.pop();
      idx += 1;

      if (!opts.dedupe) return p;
      if (!seen.has(p.id)) {
        seen.add(p.id);
        return p;
      }
    }

    const p = randomItem(fallbackArr);
    if (!opts.dedupe) return p;
    if (!seen.has(p.id)) {
      seen.add(p.id);
      return p;
    }
    return p;
  };
}

