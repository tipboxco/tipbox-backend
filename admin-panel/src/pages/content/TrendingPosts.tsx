import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  Table,
  Select,
  Input,
  InputNumber,
  Button,
  Space,
  Empty,
  Alert,
  Modal,
  message as antdMessage,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { FireOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  fetchTrending,
  createTrending,
  deleteTrending,
} from '../../api/admin-content';
import type { AdminTrendingPostListItem } from '../../types/admin';

const PAGE_SIZE = 20;

function TrendingPosts() {
  const [rows, setRows] = useState<AdminTrendingPostListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [trendPeriod, setTrendPeriod] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newPostId, setNewPostId] = useState('');
  const [newPeriod, setNewPeriod] = useState('DAILY');
  const [newScore, setNewScore] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchTrending({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        trendPeriod: trendPeriod || undefined,
      });
      setRows(res.data ?? []);
      if (res.pagination) setPagination((p) => ({ ...p, ...res.pagination }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [pagination.offset, trendPeriod]);

  const handleAdd = async () => {
    if (!newPostId.trim()) {
      antdMessage.warning('Lütfen Post ID girin');
      return;
    }
    setActionLoading('add');
    try {
      await createTrending({
        postId: newPostId.trim(),
        trendPeriod: newPeriod,
        score: newScore ?? undefined,
      });
      setShowAdd(false);
      setNewPostId('');
      setNewScore(null);
      antdMessage.success('Trending\'e eklendi');
      load();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Trending\'den Kaldır',
      content: 'Trending\'den kaldırmak istediğinize emin misiniz?',
      okText: 'Kaldır',
      cancelText: 'İptal',
      okButtonProps: { danger: true },
      onOk: async () => {
        setActionLoading(id);
        try {
          await deleteTrending(id);
          antdMessage.success('Trending\'den kaldırıldı');
          load();
        } catch (e) {
          antdMessage.error(e instanceof Error ? e.message : 'Kaldırılamadı');
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const columns: ColumnsType<AdminTrendingPostListItem> = [
    {
      title: 'Post',
      key: 'post',
      render: (_, record) => (
        <Link to={`/content/posts/${record.postId}`}>
          <Button type="link" size="small" style={{ padding: 0 }}>
            {record.postTitle
              ? record.postTitle.length > 40
                ? record.postTitle.slice(0, 40) + '…'
                : record.postTitle
              : record.postId}
          </Button>
        </Link>
      ),
    },
    {
      title: 'Yazar',
      dataIndex: 'userDisplayName',
      key: 'userDisplayName',
      render: (text) => text ?? '—',
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      align: 'right',
      render: (score) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{score}</span>,
    },
    {
      title: 'Periyot',
      dataIndex: 'trendPeriod',
      key: 'trendPeriod',
    },
    {
      title: 'Hesaplanma',
      dataIndex: 'calculatedAt',
      key: 'calculatedAt',
      render: (date) => (date ? new Date(date).toLocaleString('tr-TR') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          danger
          size="small"
          loading={actionLoading === record.id}
          onClick={() => handleDelete(record.id)}
        >
          Kaldır
        </Button>
      ),
    },
  ];

  const handleTableChange = (pag: TablePaginationConfig) => {
    const newOffset = ((pag.current ?? 1) - 1) * PAGE_SIZE;
    setPagination((prev) => ({ ...prev, offset: newOffset }));
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div>
      <PageHeader
        title="Trending Posts"
        description="View and manage trending content"
        icon={<FireOutlined />}
      />

      {error && (
        <Alert
          message="Hata"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 24 }}
        />
      )}

      <Card
        bordered
        title="Trending listesi"
        extra={
          <Space>
            <Select
              value={trendPeriod}
              onChange={(value) => {
                setTrendPeriod(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 140 }}
              placeholder="Tüm periyotlar"
            >
              <Select.Option value="">Tüm periyotlar</Select.Option>
              <Select.Option value="DAILY">Günlük</Select.Option>
              <Select.Option value="WEEKLY">Haftalık</Select.Option>
            </Select>
            <Button type="primary" onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? 'İptal' : "Trending'e ekle"}
            </Button>
          </Space>
        }
      >
        {showAdd && (
          <Space style={{ marginBottom: 16, width: '100%' }}>
            <Input
              placeholder="Post ID"
              value={newPostId}
              onChange={(e) => setNewPostId(e.target.value)}
              style={{ width: 200 }}
            />
            <Select
              value={newPeriod}
              onChange={setNewPeriod}
              style={{ width: 120 }}
            >
              <Select.Option value="DAILY">DAILY</Select.Option>
              <Select.Option value="WEEKLY">WEEKLY</Select.Option>
            </Select>
            <InputNumber
              placeholder="Score (opsiyonel)"
              value={newScore}
              onChange={setNewScore}
              style={{ width: 150 }}
            />
            <Button
              type="primary"
              loading={actionLoading === 'add'}
              onClick={handleAdd}
            >
              Ekle
            </Button>
          </Space>
        )}

        <Table
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: PAGE_SIZE,
            total: pagination.total,
            showSizeChanger: false,
            showTotal: (total) => `Toplam ${total} kayıt`,
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Trending post yok. Filtreleri değiştirin veya yeni ekleyin."
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default TrendingPosts;
