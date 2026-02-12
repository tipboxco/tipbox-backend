import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Space,
  Button,
  Empty,
  Alert,
  Row,
  Select,
  message,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  TrophyOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchBrandLeaderboards,
  recalculateBrandLeaderboard,
  fetchBrands,
} from '../../api/admin-brands';
import type {
  AdminBrandLeaderboardListItem,
} from '../../api/admin-brands';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

type LeaderboardPeriod = 'WEEKLY' | 'MONTHLY';

function BrandLeaderboards() {
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [leaderboard, setLeaderboard] = useState<AdminBrandLeaderboardListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<string | undefined>(undefined);
  const [selectedPeriod, setSelectedPeriod] = useState<LeaderboardPeriod>('WEEKLY');
  const [error, setError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchBrands({});
        if (!cancelled && res.data) {
          setBrands(res.data.map(b => ({ id: b.id, name: b.name })));
        }
      } catch (e) {
        console.error('Failed to load brands:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadLeaderboard = async () => {
    if (!selectedBrandId) {
      setLeaderboard([]);
      return;
    }

    setLoadingList(true);
    try {
      const res = await fetchBrandLeaderboards({
        brandId: selectedBrandId,
        period: selectedPeriod,
      });
      setLeaderboard(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leaderboard');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrandId, selectedPeriod]);

  const handleRecalculate = async () => {
    if (!selectedBrandId) {
      message.warning('Please select a brand first');
      return;
    }

    setRecalculating(true);
    try {
      await recalculateBrandLeaderboard(selectedBrandId, selectedPeriod);
      message.success('Leaderboard recalculated successfully');
      loadLeaderboard();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to recalculate leaderboard');
    } finally {
      setRecalculating(false);
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <Tag color="gold">🥇 1st</Tag>;
      case 2:
        return <Tag color="silver">🥈 2nd</Tag>;
      case 3:
        return <Tag color="bronze">🥉 3rd</Tag>;
      default:
        return <Tag>{rank}</Tag>;
    }
  };

  const columns: ColumnsType<AdminBrandLeaderboardListItem> = [
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (rank) => getRankBadge(rank),
    },
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.userEmail ?? '—',
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (score) => score?.toFixed(2) ?? '0.00',
    },
    {
      title: 'Period',
      dataIndex: 'period',
      key: 'period',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      render: (period) => <Tag>{period}</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON_SINGLE,
      render: (_, record) => <ViewActionButton to={`/users/${record.userId}`} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Leaderboards"
        description="View brand engagement leaderboards"
        icon={<TrophyOutlined />}
      />

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <Space wrap>
              <Select
                placeholder="Select brand"
                value={selectedBrandId}
                onChange={setSelectedBrandId}
                style={{ width: 200 }}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={brands.map(b => ({ label: b.name, value: b.id }))}
              />
              <Select
                placeholder="Period"
                value={selectedPeriod}
                onChange={setSelectedPeriod}
                style={{ width: 150 }}
              >
                <Select.Option value="WEEKLY">Weekly</Select.Option>
                <Select.Option value="MONTHLY">Monthly</Select.Option>
              </Select>
            </Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRecalculate}
              loading={recalculating}
              disabled={!selectedBrandId}
            >
              Recalculate
            </Button>
          </Row>

          <Table
            columns={columns}
            dataSource={leaderboard}
            loading={loadingList}
            rowKey={(record) => `${record.brandId}-${record.userId}-${record.period}`}
            pagination={false}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: selectedBrandId ? (
                <Empty description="No leaderboard data found" />
              ) : (
                <Empty description="Select a brand to view leaderboard" />
              ),
            }}
          />
        </Space>
      </Card>
    </div>
  );
}

export default BrandLeaderboards;
