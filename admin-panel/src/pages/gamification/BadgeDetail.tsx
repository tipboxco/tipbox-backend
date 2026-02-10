import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Tabs,
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Table,
  Spin,
  Empty,
  Modal,
  Image,
  message as antdMessage,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  LinkOutlined,
  ArrowUpOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import {
  fetchBadge,
  deleteBadge,
  fetchBadgeOwners,
} from '../../api/admin-badges-collections';
import type { AdminBadgeDetailResponse, AdminBadgeOwnerListItem } from '../../types/admin';
import { BADGE_COLOR_PRIMARY, BADGE_COLOR_SECONDARY } from '../../constants/badge-colors';
import EditBadgeModal from './modals/EditBadgeModal';

const { Text, Title, Paragraph } = Typography;

const OWNERS_PAGE_SIZE = 20;

function getListPathFromPathname(pathname: string, badgeType?: string): string {
  const collectionMatch = pathname.match(/\/gamification\/collections\/([^/]+)(?:\/badges\/?|$)/);
  if (collectionMatch) return `/gamification/collections/${collectionMatch[1]}`;
  if (pathname.includes('/event-badges')) return '/gamification/event-badges';
  if (pathname.includes('/brand-badges')) return '/gamification/brand-badges';
  if (pathname.includes('/cosmetic-badges')) return '/gamification/cosmetic-badges';
  if (badgeType === 'EVENT') return '/gamification/event-badges';
  if (badgeType === 'BRAND') return '/gamification/brand-badges';
  if (badgeType === 'COSMETIC') return '/gamification/cosmetic-badges';
  if (badgeType === 'COLLECTION') return '/gamification/collections';
  return '/gamification/event-badges';
}

function BadgeDetail() {
  const { id, badgeId } = useParams<{ id?: string; badgeId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const badgeIdToFetch = badgeId ?? id;
  const [badge, setBadge] = useState<AdminBadgeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBadge = useCallback(async () => {
    if (!badgeIdToFetch) return;
    try {
      const res = await fetchBadge(badgeIdToFetch);
      if (res.data) setBadge(res.data);
      else setError('Badge not found');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [badgeIdToFetch]);

  useEffect(() => {
    loadBadge();
  }, [loadBadge]);

  const listPath = getListPathFromPathname(location.pathname, badge?.type);

  if (!badgeIdToFetch) {
    return (
      <div>
        <Link to={listPath}>
          <Button icon={<ArrowLeftOutlined />}>Back to list</Button>
        </Link>
        <Text>Invalid badge ID</Text>
      </div>
    );
  }

  if (loading || !badge) {
    return (
      <div>
        <Link to={listPath}>
          <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>
            Back to list
          </Button>
        </Link>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : (
          <Text type="danger">{error}</Text>
        )}
      </div>
    );
  }

  const backPath = getListPathFromPathname(location.pathname, badge.type);

  const tabItems = [
    {
      key: 'summary',
      label: 'Summary',
      children: <BadgeSummaryTab badge={badge} onUpdated={loadBadge} onDeleted={() => navigate(backPath)} />,
    },
    {
      key: 'owners',
      label: 'Owners',
      children: <BadgeOwnersTab badgeId={badgeIdToFetch!} />,
    },
  ];

  return (
    <div>
      <Link to={backPath}>
        <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>
          Back to list
        </Button>
      </Link>

      <Card bordered style={{ marginBottom: 16 }}>
        <Space size="large">
          {badge.imageUrl && (
            <Image
              src={badge.imageUrl}
              alt={badge.name}
              width={100}
              height={100}
              style={{ objectFit: 'cover', borderRadius: 8 }}
              preview={false}
            />
          )}
          <div>
            <Title level={2} style={{ marginBottom: 8 }}>
              {badge.name}
            </Title>
            <Space size="small" wrap>
              <Text type="secondary">ID: {badge.id}</Text>
              <Tag color={BADGE_COLOR_PRIMARY}>{badge.type}</Tag>
              <Tag color={BADGE_COLOR_SECONDARY}>{badge.rarity}</Tag>
            </Space>
          </div>
        </Space>
      </Card>

      <Tabs items={tabItems} />
    </div>
  );
}

function BadgeSummaryTab({
  badge,
  onUpdated,
  onDeleted,
}: {
  badge: AdminBadgeDetailResponse;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [editModalOpen, setEditModalOpen] = useState(false);

  const handleDelete = () => {
    Modal.confirm({
      title: 'Delete Badge',
      content: 'This badge will be deleted. Are you sure?',
      okText: 'Yes, delete',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteBadge(badge.id);
          antdMessage.success('Badge deleted');
          onDeleted();
        } catch (e) {
          antdMessage.error(e instanceof Error ? e.message : 'Failed to delete');
        }
      },
    });
  };

  return (
    <Card bordered>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {badge.imageUrl && (
          <Image
            src={badge.imageUrl}
            alt={badge.name}
            style={{ maxWidth: 300, borderRadius: 8 }}
          />
        )}

        <div>
          <Title level={3}>{badge.name}</Title>
          <Space wrap>
            <Tag color={BADGE_COLOR_PRIMARY}>{badge.type}</Tag>
            <Tag color={BADGE_COLOR_SECONDARY}>{badge.rarity}</Tag>
            {badge.categoryName && <Tag color={BADGE_COLOR_PRIMARY}>{badge.categoryName}</Tag>}
            {badge.collectionId && (
              <Link to={`/gamification/collections/${badge.collectionId}`}>
                <Tag icon={<LinkOutlined />} color={BADGE_COLOR_PRIMARY}>
                  {badge.collectionName ?? 'Collection'}
                </Tag>
              </Link>
            )}
          </Space>
        </div>

        {(badge.boostMultiplier != null || badge.rewardMultiplier != null) && (
          <Space size="large">
            {badge.boostMultiplier != null && (
              <Space>
                <ArrowUpOutlined />
                <Text strong>Boost:</Text>
                <Text>{badge.boostMultiplier}×</Text>
              </Space>
            )}
            {badge.rewardMultiplier != null && (
              <Space>
                <GiftOutlined />
                <Text strong>Reward:</Text>
                <Text>{badge.rewardMultiplier}×</Text>
              </Space>
            )}
          </Space>
        )}

        {badge.description && <Paragraph>{badge.description}</Paragraph>}

        {badge.createdAt && (
          <Space>
            <CalendarOutlined />
            <Text type="secondary">{new Date(badge.createdAt).toLocaleString('en-US')}</Text>
          </Space>
        )}
      </Space>

      <Space style={{ marginTop: 24 }}>
        <Button type="primary" onClick={() => setEditModalOpen(true)}>
          Edit
        </Button>
        <Button danger onClick={handleDelete}>
          Delete
        </Button>
      </Space>

      {editModalOpen && (
        <EditBadgeModal
          open={editModalOpen}
          badgeId={badge.id}
          onClose={() => setEditModalOpen(false)}
          onSuccess={() => {
            onUpdated();
            setEditModalOpen(false);
          }}
        />
      )}
    </Card>
  );
}

function BadgeOwnersTab({ badgeId }: { badgeId: string }) {
  const [owners, setOwners] = useState<AdminBadgeOwnerListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: OWNERS_PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetchBadgeOwners(badgeId, {
        limit: OWNERS_PAGE_SIZE,
        offset: pagination.offset,
      });
      setOwners(res.data ?? []);
      if (res.pagination) setPagination((prev) => ({ ...prev, ...res.pagination }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [badgeId, pagination.offset]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ColumnsType<AdminBadgeOwnerListItem> = [
    {
      title: 'User',
      key: 'user',
      render: (_, record) => (
        <Link
          to={`/users/${record.userId}`}
          style={{ color: 'var(--tipbox-badge-outline)', textDecoration: 'underline' }}
        >
          {record.userDisplayName ?? record.userId}
        </Link>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'userEmail',
      key: 'email',
      render: (email) => email ?? '—',
    },
    {
      title: 'Claimed',
      dataIndex: 'claimed',
      key: 'claimed',
      render: (claimed) => (claimed ? 'Yes' : 'No'),
    },
    {
      title: 'Claimed at',
      dataIndex: 'claimedAt',
      key: 'claimedAt',
      render: (date) => (date ? new Date(date).toLocaleString('en-US') : '—'),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => (date ? new Date(date).toLocaleString('en-US') : '—'),
    },
  ];

  const handleTableChange = (pag: TablePaginationConfig) => {
    const newOffset = ((pag.current ?? 1) - 1) * OWNERS_PAGE_SIZE;
    setPagination((prev) => ({ ...prev, offset: newOffset }));
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <Card bordered title="Users who own this badge">
      <Table
        columns={columns}
        dataSource={owners}
        rowKey="id"
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize: OWNERS_PAGE_SIZE,
          total: pagination.total,
          showSizeChanger: false,
          showTotal: (total) => `Total ${total} owners`,
        }}
        onChange={handleTableChange}
        locale={{
          emptyText: (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No users own this badge yet" />
          ),
        }}
      />
    </Card>
  );
}

export default BadgeDetail;
