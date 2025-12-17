-- Julia kullanıcısının TIPS gönderilerini çekme sorgusu
-- Kullanıcı ID: 99999999-9999-4999-9999-999999999999

-- 0. Post Media görsellerini çekme (basit sorgu)
SELECT * 
FROM post_media 
WHERE user_id = '99999999-9999-4999-9999-999999999999'
ORDER BY created_at DESC;

-- 1. Basit sorgu: Sadece TIPS post'ları
SELECT 
    cp.id,
    cp.title,
    cp.body,
    cp.type,
    cp.created_at,
    cp.updated_at,
    pt.tip_category,
    pt.is_verified
FROM content_posts cp
LEFT JOIN post_tips pt ON cp.id = pt.post_id
WHERE cp.user_id = '99999999-9999-4999-9999-9999-999999999999'
  AND cp.type = 'TIPS'
ORDER BY cp.created_at DESC;

-- 2. Detaylı sorgu: TIPS post'ları + görseller + tag'ler + ürün bilgisi
SELECT 
    cp.id AS post_id,
    cp.title,
    cp.body,
    cp.type,
    cp.created_at,
    cp.updated_at,
    -- Tip bilgisi
    pt.tip_category,
    pt.is_verified,
    -- Ürün bilgisi
    p.id AS product_id,
    p.name AS product_name,
    p.brand AS product_brand,
    -- Görseller
    pm.media_url,
    pm.order_index,
    -- Tag'ler (aggregate)
    STRING_AGG(DISTINCT cpt.tag, ', ') AS tags
FROM content_posts cp
LEFT JOIN post_tips pt ON cp.id = pt.post_id
LEFT JOIN products p ON cp.product_id = p.id
LEFT JOIN post_media pm ON cp.id = pm.post_id
LEFT JOIN content_post_tags cpt ON cp.id = cpt.post_id
WHERE cp.user_id = '99999999-9999-4999-9999-999999999999'
  AND cp.type = 'TIPS'
GROUP BY 
    cp.id,
    cp.title,
    cp.body,
    cp.type,
    cp.created_at,
    cp.updated_at,
    pt.tip_category,
    pt.is_verified,
    p.id,
    p.name,
    p.brand,
    pm.media_url,
    pm.order_index
ORDER BY cp.created_at DESC, pm.order_index ASC;

-- 3. Özet sorgu: TIPS post sayıları ve görsel durumu
SELECT 
    COUNT(*) AS total_tips_posts,
    COUNT(DISTINCT pm.id) AS posts_with_media,
    COUNT(*) - COUNT(DISTINCT CASE WHEN pm.id IS NOT NULL THEN cp.id END) AS posts_without_media,
    COUNT(DISTINCT pt.tip_category) AS unique_categories
FROM content_posts cp
LEFT JOIN post_tips pt ON cp.id = pt.post_id
LEFT JOIN post_media pm ON cp.id = pm.post_id
WHERE cp.user_id = '99999999-9999-4999-9999-999999999999'
  AND cp.type = 'TIPS';

-- 4. Görsel format kontrolü: Path vs URL
SELECT 
    cp.id AS post_id,
    cp.title,
    pm.media_url,
    CASE 
        WHEN pm.media_url LIKE 'http://%' OR pm.media_url LIKE 'https://%' THEN 'Tam URL (Eski Format)'
        WHEN pm.media_url LIKE 'posts/%' OR pm.media_url LIKE 'users/%' OR pm.media_url LIKE 'brands/%' THEN 'Path (Yeni Format)'
        ELSE 'Bilinmeyen Format'
    END AS format_type
FROM content_posts cp
INNER JOIN post_media pm ON cp.id = pm.post_id
WHERE cp.user_id = '99999999-9999-4999-9999-999999999999'
  AND cp.type = 'TIPS'
ORDER BY cp.created_at DESC;

-- 5. Tüm detaylar: Post, Tip, Media, Tags, Product (JSON formatında)
SELECT 
    cp.id AS post_id,
    cp.title,
    cp.body,
    cp.created_at,
    jsonb_build_object(
        'tip_category', pt.tip_category,
        'is_verified', pt.is_verified
    ) AS tip_info,
    jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'brand', p.brand
    ) AS product_info,
    jsonb_agg(
        DISTINCT jsonb_build_object(
            'media_url', pm.media_url,
            'order_index', pm.order_index
        )
        ORDER BY pm.order_index
    ) FILTER (WHERE pm.media_url IS NOT NULL) AS media,
    jsonb_agg(DISTINCT cpt.tag) FILTER (WHERE cpt.tag IS NOT NULL) AS tags
FROM content_posts cp
LEFT JOIN post_tips pt ON cp.id = pt.post_id
LEFT JOIN products p ON cp.product_id = p.id
LEFT JOIN post_media pm ON cp.id = pm.post_id
LEFT JOIN content_post_tags cpt ON cp.id = cpt.post_id
WHERE cp.user_id = '99999999-9999-4999-9999-999999999999'
  AND cp.type = 'TIPS'
GROUP BY 
    cp.id,
    cp.title,
    cp.body,
    cp.created_at,
    pt.tip_category,
    pt.is_verified,
    p.id,
    p.name,
    p.brand
ORDER BY cp.created_at DESC;

