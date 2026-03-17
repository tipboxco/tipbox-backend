import { useState, useEffect, useCallback } from "react"
import { backendUrl } from "../../lib/config"

export type CategoryItem = {
  id: string
  name: string
  handle?: string
  parent_category_id?: string | null
}

// ─── Module-level cache ───
let _cache: CategoryItem[] | null = null
let _cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 dk

// Aynı anda birden fazla fetch tetiklenmesin
let _pendingFetch: Promise<CategoryItem[]> | null = null

async function fetchAllCategories(): Promise<CategoryItem[]> {
  const all: CategoryItem[] = []
  let offset = 0
  const limit = 500

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetch(
      `${backendUrl}/admin/product-categories?limit=${limit}&offset=${offset}&fields=id,name,handle,parent_category_id`,
      { credentials: "include" }
    )
    if (!res.ok) break

    const data = await res.json()
    const items: CategoryItem[] = data.product_categories || []
    all.push(...items)

    if (items.length < limit) break
    offset += limit
  }

  return all
}

/**
 * Module-level cache ile product categories döndürür.
 * İlk çağrıda fetch eder, sonrakiler cache'den okur (TTL: 5dk).
 * Aynı anda birden fazla fetch yapılmasını engeller.
 */
export function useCategoryCache() {
  const [categories, setCategories] = useState<CategoryItem[]>(_cache || [])
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    const now = Date.now()
    if (_cache && now - _cacheTime < CACHE_TTL) {
      setCategories(_cache)
      setLoading(false)
      return
    }

    // Deduplicated fetch
    if (!_pendingFetch) {
      _pendingFetch = fetchAllCategories().finally(() => {
        _pendingFetch = null
      })
    }

    _pendingFetch.then((items) => {
      _cache = items
      _cacheTime = Date.now()
      setCategories(items)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [])

  const invalidate = useCallback(() => {
    _cache = null
    _cacheTime = 0
  }, [])

  const refetch = useCallback(() => {
    _cache = null
    _cacheTime = 0
    setLoading(true)
    fetchAllCategories()
      .then((items) => {
        _cache = items
        _cacheTime = Date.now()
        setCategories(items)
      })
      .finally(() => setLoading(false))
  }, [])

  return { categories, loading, invalidate, refetch }
}
