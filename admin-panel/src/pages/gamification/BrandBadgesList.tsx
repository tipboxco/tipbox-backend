import { useState, useEffect } from 'react';
import { TagOutlined, TrophyOutlined, GiftOutlined } from '@ant-design/icons';
import BadgeListByType from './BadgeListByType';
import type { BadgeTypeSlug } from './BadgeListByType';
import type { StatItemData } from '../../components/StatItem';
import CreateBadgeModal from './CreateBadgeModal';
import { fetchBrandBadgesStats } from '../../api/admin-gamification';
import type { BrandBadgesStatsResponse } from '../../api/admin-gamification';

function BrandBadgesList() {
  const [createOpen, setCreateOpen] = useState(false);
  const [stats, setStats] = useState<BrandBadgesStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchBrandBadgesStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        console.error('Failed to load stats', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Badges',
          value: stats.totalBadges,
          icon: <TrophyOutlined />,
        },
        {
          label: 'Total Awarded',
          value: stats.totalAwarded,
          icon: <GiftOutlined />,
          valueColor: '#52c41a',
        },
      ]
    : undefined;

  return (
    <>
      <BadgeListByType
        badgeType={'BRAND' as BadgeTypeSlug}
        listPath="/gamification/brand-badges"
        title="Brand Badges"
        description="Brand badges list and management"
        icon={<TagOutlined />}
        onOpenCreate={() => setCreateOpen(true)}
        stats={statsData}
        statsLoading={loading}
      />
      {createOpen && (
        <CreateBadgeModal
          badgeType="BRAND"
          listPath="/gamification/brand-badges"
          onClose={() => setCreateOpen(false)}
          onSuccess={() => setCreateOpen(false)}
        />
      )}
    </>
  );
}

export default BrandBadgesList;
