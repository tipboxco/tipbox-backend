import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  Table,
  Select,
  Input,
  Button,
  Space,
  Empty,
  Alert,
  Modal,
  message as antdMessage,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { StarOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  fetchFeedHighlights,
  createFeedHighlight,
  deleteFeedHighlight,
} from '../../api/admin-content';
import type { AdminFeedHighlightListItem } from '../../types/admin';

const PAGE_SIZE = 20;

const REASONS = [
  { value: 'STAFF_PICK', label: 'Staff Pick' },
  { value: 'MOST_LIKED', label: 'Most Liked' },
  { value: 'BOOSTED', label: 'Boosted' },
];

function FeedHighlights() {
  const [rows, setRows] = useState<AdminFeedHighlightListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [reasonFilter, setReasonFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newPostId, setNewPostId] = useState('');
  const [newReason, setNewReason] = useState('STAFF_PICK');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchFeedHighlights({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        reason: reasonFilter || undefined,
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
  }, [pagination.offset, reasonFilter]);

  const handleAdd = async () => {
    if (!newPostId.trim()) {
      antdMessage.warning('Lütfen Post ID girin');
      return;
    }
    setActionLoading('add');
    try {
      await createFeedHighlight({
        postId: newPostId.trim(),
        reason: newReason,
      });
      setShowAdd(false);
      setNewPostId('');
      antdMessage.success('Highlight eklendi');
      load();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Highlight Kaldır',
      content: 'Bu highlight kaldırılsın mı?',
      okText: 'Kaldır',
      cancelText: 'İptal',
      okButtonProps: { danger: true },
      onOk: async () => {
        setActionLoading(id);
        try {
          await deleteFeedHighlight(id);
          antdMessage.success('Highlight kaldırıldı');
          load();
        } catch (e) {
          antdMessage.error(e instanceof Error ? e.message : 'Kaldırılamadı');
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const columns: ColumnsType<AdminFeedHighlightListItem> = [
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
      title: 'Sebep',
      dataIndex: 'reason',
      key: 'reason',
    },
    {
      title: 'Öne çıkarılma',
      dataIndex: 'highlightedAt',
      key: 'highlightedAt',
      render: (date) => new Date(date).toLocaleString('tr-TR'),
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
        title="Feed Highlights"
        description="Manage feed highlighted posts"
        icon={<StarOutlined />}
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
        title="Feed highlight listesi"
        extra={
          <Space>
            <Select
              value={reasonFilter}
              onChange={(value) => {
                setReasonFilter(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 140 }}
              placeholder="Tüm sebepler"
            >
              <Select.Option value="">Tüm sebepler</Select.Option>
              {REASONS.map((r) => (
                <Select.Option key={r.value} value={r.value}>
                  {r.label}
                </Select.Option>
              ))}
            </Select>
            <Button type="primary" onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? 'İptal' : 'Highlight ekle'}
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
              value={newReason}
              onChange={setNewReason}
              style={{ width: 140 }}
            >
              {REASONS.map((r) => (
                <Select.Option key={r.value} value={r.value}>
                  {r.label}
                </Select.Option>
              ))}
            </Select>
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
                description="Highlight yok. Filtreleri değiştirin veya yeni ekleyin."
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default FeedHighlights;
