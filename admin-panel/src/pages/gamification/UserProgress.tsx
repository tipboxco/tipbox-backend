import { useState, useEffect } from 'react';
import { Card, Empty } from 'antd';
import { LineChartOutlined, UserOutlined, RiseOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import type { StatItemData } from '../../components/StatItem';
import { fetchUserProgressStats } from '../../api/admin-gamification';
import type { UserProgressStatsResponse } from '../../api/admin-gamification';

function UserProgress() {
  const [stats, setStats] = useState<UserProgressStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchUserProgressStats();
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
          label: 'Total Users',
          value: stats.totalUsers,
          icon: <UserOutlined />,
        },
        {
          label: 'Active Users',
          value: stats.activeUsers,
          icon: <RiseOutlined />,
          valueColor: '#52c41a',
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="User Progress"
        description="Track user achievement progress"
        icon={<LineChartOutlined />}
        stats={statsData}
        statsLoading={loading}
      />

      <Card bordered title="User Progress Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="User Progress management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default UserProgress;
