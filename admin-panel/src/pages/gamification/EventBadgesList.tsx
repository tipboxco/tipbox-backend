import { useState, useEffect } from 'react';
import { TrophyOutlined, GiftOutlined } from '@ant-design/icons';
import BadgeListByType from './BadgeListByType';
import type { BadgeTypeSlug } from './BadgeListByType';
import type { StatItemData } from '../../components/StatItem';
import CreateBadgeModal from './CreateBadgeModal';
import { fetchEventBadgesStats } from '../../api/admin-gamification';
import type { EventBadgesStatsResponse } from '../../api/admin-gamification';

function EventBadgesList() {
  const [createOpen, setCreateOpen] = useState(false);
  const [stats, setStats] = useState<EventBadgesStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchEventBadgesStats();
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
        badgeType={'EVENT' as BadgeTypeSlug}
        listPath="/gamification/event-badges"
        title="Event Badges"
        description="Event / community badges list and management"
        icon={<TrophyOutlined />}
        onOpenCreate={() => setCreateOpen(true)}
        stats={statsData}
        statsLoading={loading}
      />
      {createOpen && (
        <CreateBadgeModal
          badgeType="EVENT"
          listPath="/gamification/event-badges"
          onClose={() => setCreateOpen(false)}
          onSuccess={() => setCreateOpen(false)}
        />
      )}
    </>
  );
}

export default EventBadgesList;
