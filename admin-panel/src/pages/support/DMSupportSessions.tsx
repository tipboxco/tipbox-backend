import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Table, Space, Button, Empty, Alert, Popconfirm, message, Statistic } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { MessageOutlined, DeleteOutlined, DollarOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchDMSupportSessionsStats,
  fetchDMSupportSessions,
  deleteDMSupportSession,
  type DMSupportSessionStatsResponse,
  type DMSupportSessionListItem,
} from '../../api/admin-dm-support-sessions';

const PAGE_SIZE = 20;

function DMSupportSessions() {
  const [stats, setStats] = useState<DMSupportSessionStatsResponse | null>(null);
  const [sessions, setSessions] = useState<DMSupportSessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchDMSupportSessionsStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load statistics');
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadSessions = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDMSupportSessions({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setSessions(res.data ?? []);
      setTotal(res.pagination?.total ?? 0);
      setCurrentPage(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions(1);
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteDMSupportSession(id);
      message.success('Session deleted successfully');
      loadSessions(currentPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to delete session');
    }
  };

  const columns: ColumnsType<DMSupportSessionListItem> = [
    {
      title: 'Helper',
      key: 'helper',
      width: 200,
      ellipsis: true,
      render: (_, record) => (
        <Link to={`/users/${record.helperId}`}>
          {record.helperUsername || record.helperEmail || 'Unknown'}
        </Link>
      ),
    },
    {
      title: 'Tips Amount',
      dataIndex: 'tipsAmount',
      key: 'tipsAmount',
      width: 120,
      align: 'right',
      render: (amount) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>${amount.toFixed(2)}</span>,
    },
    {
      title: 'Feedbacks',
      dataIndex: 'feedbackCount',
      key: 'feedbackCount',
      width: 100,
      align: 'right',
    },
    {
      title: 'Participants',
      dataIndex: 'participantCount',
      key: 'participantCount',
      width: 120,
      align: 'right',
    },
    {
      title: 'Supported At',
      dataIndex: 'supportedAt',
      key: 'supportedAt',
      width: 150,
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Popconfirm title="Delete Session" description="Are you sure?" onConfirm={() => handleDelete(record.id)} okText="Delete" okType="danger">
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const statsData: StatItemData[] | undefined = stats
    ? [
        { label: 'Total Sessions', value: stats.totalSessions, icon: <MessageOutlined /> },
        { label: 'Total Tips', value: `$${stats.totalTipsAmount.toFixed(2)}`, icon: <DollarOutlined /> },
        { label: 'Avg Tips', value: `$${stats.avgTipsAmount.toFixed(2)}`, icon: <DollarOutlined /> },
      ]
    : undefined;

  return (
    <div>
      <PageHeader title="DM Support Sessions" description="Support chat analytics and helper tracking" icon={<MessageOutlined />} stats={statsData} statsLoading={loadingStats} />
      {error && <Alert message="Error" description={error} type="error" closable onClose={() => setError(null)} style={{ marginBottom: 24 }} />}

      {stats && stats.topHelpers.length > 0 && (
        <Card title="Top Helpers" style={{ marginBottom: 16 }} bordered>
          <Space size="large">
            {stats.topHelpers.slice(0, 3).map((helper, idx) => (
              <Statistic
                key={helper.helperId}
                title={`#${idx + 1} ${helper.username || 'Unknown'}`}
                value={helper.sessionCount}
                suffix="sessions"
                valueStyle={{ fontSize: 16 }}
              />
            ))}
          </Space>
        </Card>
      )}

      <Card bordered title="Support Sessions">
        <Table columns={columns} dataSource={sessions} rowKey="id" loading={loading} pagination={{ current: currentPage, pageSize: PAGE_SIZE, total, showSizeChanger: false, showTotal: (total) => `Total ${total} sessions`, onChange: loadSessions }} locale={{ emptyText: <Empty description="No sessions found" /> }} />
      </Card>
    </div>
  );
}

export default DMSupportSessions;
