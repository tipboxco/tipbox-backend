import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Table, Tag, Space, Select, Empty, Alert, Rate } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { RobotOutlined, EditOutlined, CheckCircleOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchAiExperienceSplitsStats,
  fetchAiExperienceSplits,
  type AiExperienceSplitStatsResponse,
  type AiExperienceSplitListItem,
} from '../../api/admin-ai-experience-splits';

const PAGE_SIZE = 20;

function AiExperienceSplits() {
  const [stats, setStats] = useState<AiExperienceSplitStatsResponse | null>(null);
  const [splits, setSplits] = useState<AiExperienceSplitListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEdited, setIsEdited] = useState<string>('');
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAiExperienceSplitsStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load statistics');
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadSplits = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAiExperienceSplits({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        isEdited: isEdited === 'true' ? true : isEdited === 'false' ? false : undefined,
      });
      setSplits(res.data ?? []);
      setTotal(res.pagination?.total ?? 0);
      setCurrentPage(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load AI splits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSplits(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdited]);

  const columns: ColumnsType<AiExperienceSplitListItem> = [
    {
      title: 'User',
      key: 'user',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <Link to={`/users/${record.userId}`}>
          {record.username || record.userEmail || 'Unknown'}
        </Link>
      ),
    },
    {
      title: 'Product',
      dataIndex: 'productName',
      key: 'productName',
      width: 150,
      ellipsis: true,
      render: (text) => text || '—',
    },
    {
      title: 'Price Rating',
      dataIndex: 'priceAndShoppingRating',
      key: 'priceAndShoppingRating',
      width: 130,
      render: (rating) => rating ? <Rate disabled value={rating} style={{ fontSize: 14 }} /> : '—',
    },
    {
      title: 'Product Rating',
      dataIndex: 'productAndUsageRating',
      key: 'productAndUsageRating',
      width: 130,
      render: (rating) => rating ? <Rate disabled value={rating} style={{ fontSize: 14 }} /> : '—',
    },
    {
      title: 'Status',
      dataIndex: 'isEdited',
      key: 'isEdited',
      width: 100,
      render: (edited) =>
        edited ? (
          <Tag icon={<EditOutlined />} color="warning">Edited</Tag>
        ) : (
          <Tag icon={<CheckCircleOutlined />} color="success">Original</Tag>
        ),
    },
    {
      title: 'Model',
      dataIndex: 'model',
      key: 'model',
      width: 150,
      ellipsis: true,
      render: (text) => <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{text}</span>,
    },
    {
      title: 'Tokens',
      dataIndex: 'tokensUsed',
      key: 'tokensUsed',
      width: 100,
      align: 'right',
      render: (tokens) => tokens ? tokens.toLocaleString() : '—',
    },
    {
      title: 'Time (ms)',
      dataIndex: 'processingTimeMs',
      key: 'processingTimeMs',
      width: 100,
      align: 'right',
      render: (ms) => ms ? ms.toLocaleString() : '—',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (date) => new Date(date).toLocaleDateString(),
    },
  ];

  const statsData: StatItemData[] | undefined = stats
    ? [
        { label: 'Total Splits', value: stats.total, icon: <RobotOutlined /> },
        { label: 'Edited', value: stats.edited, icon: <EditOutlined />, valueStyle: { color: '#faad14' } },
        { label: 'Avg Tokens', value: Math.round(stats.avgTokensUsed), icon: <RobotOutlined /> },
        { label: 'Avg Time (ms)', value: Math.round(stats.avgProcessingTimeMs), icon: <RobotOutlined /> },
      ]
    : undefined;

  return (
    <div>
      <PageHeader title="AI Experience Splits" description="AI content audit and quality metrics" icon={<RobotOutlined />} stats={statsData} statsLoading={loadingStats} />
      {error && <Alert message="Error" description={error} type="error" closable onClose={() => setError(null)} style={{ marginBottom: 24 }} />}
      <Card bordered title="AI Content Analysis" extra={
        <Select placeholder="Status" value={isEdited || undefined} onChange={setIsEdited} style={{ width: 150 }} allowClear>
          <Select.Option value="false">Original</Select.Option>
          <Select.Option value="true">Edited</Select.Option>
        </Select>
      }>
        <Table columns={columns} dataSource={splits} rowKey="id" loading={loading} pagination={{ current: currentPage, pageSize: PAGE_SIZE, total, showSizeChanger: false, showTotal: (total) => `Total ${total} splits`, onChange: loadSplits }} locale={{ emptyText: <Empty description="No AI splits found" /> }} />
      </Card>
    </div>
  );
}

export default AiExperienceSplits;
