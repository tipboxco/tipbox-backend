INSERT INTO public.product_product_brand_brand (
    product_id, 
    brand_id, 
    id, 
    created_at, 
    updated_at, 
    deleted_at
)
SELECT 
    p.id AS product_id, 
    b.id AS brand_id, 
    'prod_br_' || gen_random_uuid() AS id,
    NOW() AS created_at, 
    NOW() AS updated_at, 
    NULL AS deleted_at
FROM 
    public.product p
JOIN 
    public.brand b ON (
        -- [SOL TARAF: ÜRÜN VERİSİ TEMİZLEME]
        TRIM(LOWER(
            REGEXP_REPLACE(
                normalize(
                    COALESCE(
                        p.metadata->>'brand', 
                        p.metadata->>'manufacturer', 
                        split_part(p.title, ' ', 1)
                    ), NFKC
                ), 
                '[^a-z0-9\+\-\s]', '', 'g' -- Sadece harf, rakam, +, - ve boşluk kalsın
            )
        )) 
        = 
        -- [SAĞ TARAF: MARKA TABLOSU TEMİZLEME]
        TRIM(LOWER(
            REGEXP_REPLACE(
                normalize(b.name, NFKC), 
                '[^a-z0-9\+\-\s]', '', 'g'
            )
        ))
    )
WHERE 
    p.deleted_at IS NULL 
    AND b.deleted_at IS NULL
    -- Sadece henüz markası atanmamış ürünleri işleme al
    AND NOT EXISTS (
        SELECT 1 FROM public.product_product_brand_brand link 
        WHERE link.product_id = p.id
    )
ON CONFLICT (product_id, brand_id) DO NOTHING;