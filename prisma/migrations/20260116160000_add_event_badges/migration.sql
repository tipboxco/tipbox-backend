-- CreateTable
CREATE TABLE "event_badges" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "event_id" VARCHAR(26) NOT NULL,
    "badge_id" UUID NOT NULL,
    "requirement_type" VARCHAR(50) NOT NULL,
    "threshold" INTEGER NOT NULL,
    "display_order" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_badges_event_id_badge_id_key" ON "event_badges"("event_id", "badge_id");

-- CreateIndex
CREATE INDEX "event_badges_event_id_idx" ON "event_badges"("event_id");

-- CreateIndex
CREATE INDEX "event_badges_badge_id_idx" ON "event_badges"("badge_id");

-- AddForeignKey
ALTER TABLE "event_badges" ADD CONSTRAINT "event_badges_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "wishbox_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_badges" ADD CONSTRAINT "event_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing data: Aktif event'lere tüm EVENT badge'lerini ata
INSERT INTO event_badges (event_id, badge_id, requirement_type, threshold, display_order, enabled)
SELECT 
  e.id as event_id,
  b.id as badge_id,
  CASE 
    WHEN ag.requirement LIKE '%POSTS_COUNT%' THEN 'POSTS_COUNT'
    WHEN ag.requirement LIKE '%LIKES_RECEIVED%' THEN 'LIKES_RECEIVED'
    ELSE 'POSTS_COUNT'
  END as requirement_type,
  COALESCE((ag.requirement::json->>'threshold')::int, 1) as threshold,
  ROW_NUMBER() OVER (PARTITION BY e.id ORDER BY b.created_at) as display_order,
  true as enabled
FROM wishbox_events e
CROSS JOIN badges b
LEFT JOIN achievement_goals ag ON ag.reward_badge_id = b.id
WHERE b.type = 'EVENT'
  AND b.name LIKE '[Event]%'
  AND e.status = 'PUBLISHED'
  AND e.end_date > CURRENT_TIMESTAMP
ON CONFLICT (event_id, badge_id) DO NOTHING;
