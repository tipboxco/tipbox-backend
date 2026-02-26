import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Table, Space, Button, Input, Empty, Alert, Popconfirm, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FilterOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchUserFeedPreferencesStats,
  fetchUserFeedPreferences,
  deleteUserFeedPreference,
  type UserFeedPreferenceStatsResponse,
  type UserFeedPreferenceListItem,
} from '../../api/admin-user-feed-preferences';

const PAGE_SIZE = 20;

function UserFeedPreferences() {
  const [stats, setStats] = useState<UserFeedPreferenceStatsResponse | null>(null);
  const [preferences, setPreferences] = useState<UserFeedPreferenceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchUserFeedPreferencesStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load statistics');
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadPreferences = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUserFeedPreferences({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        search: search || undefined,
      });
      setPreferences(res.data ?? []);
      setTotal(res.pagination?.total ?? 0);
      setCurrentPage(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreferences(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleDelete = async (id: string) => {
    try {
      await deleteUserFeedPreference(id);
      message.success('Preference reset successfully');
      loadPreferences(currentPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to reset preference');
    }
  };

  const columns: ColumnsType<UserFeedPreferenceListItem> = [
    {
      title: 'User',
      key: 'user',
      width: 200,
      ellipsis: true,
      render: (_, record) => (
        <Link to={`/users/${record.userId}`}>
          {record.username || record.userEmail || 'Unknown'}
        </Link>
      ),
    },
    {
      title: 'Language',
      dataIndex: 'language',
      key: 'language',
      width: 100,
      render: (text) => text || '—',
    },
    {
      title: 'Preferred Categories',
      dataIndex: 'preferredCategories',
      key: 'preferredCategories',
      ellipsis: true,
      render: (text) => text || '—',
    },
    {
      title: 'Preferred Content Types',
      dataIndex: 'preferredContentTypes',
      key: 'preferredContentTypes',
      ellipsis: true,
      render: (text) => text || '—',
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 110,
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Popconfirm title="Reset Preferences" description="This will delete the user's feed preferences" onConfirm={() => handleDelete(record.id)} okText="Reset" okType="danger">
          <Button size="small" type="text" danger icon={<DeleteOutlined />} title="Reset preferences" />
        </Popconfirm>
      ),
    },
  ];

  const statsData: StatItemData[] | undefined = stats
    ? [
        { label: 'Total Preferences', value: stats.totalPreferences, icon: <FilterOutlined /> },
        { label: 'With Categories', value: stats.withCategories, icon: <FilterOutlined /> },
        { label: 'With Content Types', value: stats.withContentTypes, icon: <FilterOutlined /> },
      ]
    : undefined;

  return (
    <div>
      <PageHeader title="User Feed Preferences" description="View and manage user feed algorithm preferences" icon={<FilterOutlined />} stats={statsData} statsLoading={loadingStats} />
      {error && <Alert message="Error" description={error} type="error" closable onClose={() => setError(null)} style={{ marginBottom: 24 }} />}
      <Card bordered title="Feed Preferences" extra={<Input placeholder="Search users" value={search} onChange={(e) => setSearch(e.target.value)} prefix={<SearchOutlined />} style={{ width: 200 }} allowClear />}>
        <Table columns={columns} dataSource={preferences} rowKey="id" loading={loading} pagination={{ current: currentPage, pageSize: PAGE_SIZE, total, showSizeChanger: false, showTotal: (total) => `Total ${total} preferences`, onChange: loadPreferences }} locale={{ emptyText: <Empty description="No preferences found" /> }} />
      </Card>
    </div>
  );
}

export default UserFeedPreferences;
