import { useState, useEffect } from 'react';
import { BgColorsOutlined, TrophyOutlined, StarOutlined } from '@ant-design/icons';
import BadgeListByType from './BadgeListByType';
import type { BadgeTypeSlug } from './BadgeListByType';
import type { StatItemData } from '../../components/StatItem';
import CreateBadgeModal from './CreateBadgeModal';
import { fetchCosmeticBadgesStats } from '../../api/admin-gamification';
import type { CosmeticBadgesStatsResponse } from '../../api/admin-gamification';

function CosmeticBadgesList() {
  const [createOpen, setCreateOpen] = useState(false);
  const [stats, setStats] = useState<CosmeticBadgesStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchCosmeticBadgesStats();
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
          label: 'Total Owned',
          value: stats.totalOwned,
          icon: <StarOutlined />,
          valueColor: '#52c41a',
        },
      ]
    : undefined;

  return (
    <>
      <BadgeListByType
        badgeType={'COSMETIC' as BadgeTypeSlug}
        listPath="/gamification/cosmetic-badges"
        title="Cosmetic Badges"
        description="Cosmetic badges list and management"
        icon={<BgColorsOutlined />}
        onOpenCreate={() => setCreateOpen(true)}
        stats={statsData}
        statsLoading={loading}
      />
      {createOpen && (
        <CreateBadgeModal
          badgeType="COSMETIC"
          listPath="/gamification/cosmetic-badges"
          onClose={() => setCreateOpen(false)}
          onSuccess={() => setCreateOpen(false)}
        />
      )}
    </>
  );
}

export default CosmeticBadgesList;
