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
  Row,
  Col,
  message as antdMessage,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  LinkOutlined,
  ArrowUpOutlined,
  GiftOutlined,
  TrophyOutlined,
  UserOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import {
  fetchBadge,
  deleteBadge,
  fetchBadgeOwners,
  uploadBadgeImage,
} from '../../api/admin-badges-collections';
import type { AdminBadgeDetailResponse, AdminBadgeOwnerListItem } from '../../types/admin';
import { BADGE_COLOR_PRIMARY, BADGE_COLOR_SECONDARY } from '../../constants/badge-colors';
import EditBadgeModal from './modals/EditBadgeModal';
import PageHeader from '../../components/PageHeader';
import type { StatItemData } from '../../components/StatItem';
import EditableFormSection from '../../components/form/EditableFormSection';
import IdDisplay from '../../components/IdDisplay';
import type { FieldConfig } from '../../components/form/types';

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
  const [activeTab, setActiveTab] = useState('summary');
  const [ownersCount, setOwnersCount] = useState(0);

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

  const loadOwnersCount = useCallback(async () => {
    if (!badgeIdToFetch) return;
    try {
      const res = await fetchBadgeOwners(badgeIdToFetch, { limit: 1, offset: 0 });
      if (res.pagination?.total !== undefined) {
        setOwnersCount(res.pagination.total);
      }
    } catch (e) {
      console.error('Failed to load owners count:', e);
    }
  }, [badgeIdToFetch]);

  useEffect(() => {
    loadBadge();
    loadOwnersCount();
  }, [loadBadge, loadOwnersCount]);

  const listPath = getListPathFromPathname(location.pathname, badge?.type);

  if (!badgeIdToFetch) {
    return (
      <div>
        <PageHeader
          title="Error"
          description="Invalid badge ID"
          icon={<TrophyOutlined />}
          backTo={listPath}
          backLabel="Back to list"
        />
      </div>
    );
  }

  if (loading || !badge) {
    return (
      <div>
        <PageHeader
          title={loading ? 'Loading...' : 'Error'}
          description={loading ? undefined : error ?? 'Badge not found'}
          icon={<TrophyOutlined />}
          backTo={listPath}
          backLabel="Back to list"
        />
        {loading && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        )}
      </div>
    );
  }

  const backPath = getListPathFromPathname(location.pathname, badge.type);

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
          navigate(backPath);
        } catch (e) {
          antdMessage.error(e instanceof Error ? e.message : 'Failed to delete');
        }
      },
    });
  };

  const tabItems = [
    {
      key: 'summary',
      label: 'Summary',
      children: <BadgeSummaryTab badge={badge} onUpdated={loadBadge} />,
    },
    {
      key: 'owners',
      label: 'Owners',
      children: <BadgeOwnersTab badgeId={badgeIdToFetch!} />,
    },
  ];

  // Prepare stats data
  const statsData: StatItemData[] = [
    {
      label: 'Rarity',
      value: badge.rarity,
      icon: <GiftOutlined />,
      valueColor: badge.rarity === 'EPIC' ? '#722ed1' : badge.rarity === 'RARE' ? '#1890ff' : undefined,
    },
  ];

  if (badge.collectionName) {
    statsData.push({
      label: 'Collection',
      value: badge.collectionName,
      icon: <FolderOpenOutlined />,
    });
  }

  statsData.push({
    label: 'Owners',
    value: ownersCount,
    icon: <UserOutlined />,
  });

  // Build description with category
  let description = '';
  if (badge.categoryName) {
    description = badge.categoryName;
  }

  return (
    <div>
      <PageHeader
        title={badge.name}
        description={description}
        icon={<TrophyOutlined />}
        backTo={backPath}
        backLabel="Back to list"
        stats={statsData}
        statsLoading={loading}
      />

      <div style={{ marginBottom: 16, marginTop: -8 }}>
        <IdDisplay id={badge.id} variant="inline" label="Badge ID:" />
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        tabBarExtraContent={
          <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
            Delete Badge
          </Button>
        }
      />
    </div>
  );
}

function BadgeSummaryTab({
  badge,
  onUpdated,
}: {
  badge: AdminBadgeDetailResponse;
  onUpdated: () => void;
}) {

  const handleUpdateBadge = async (values: Record<string, unknown>) => {
    try {
      const { updateBadge } = await import('../../api/admin-badges-collections');
      await updateBadge(badge.id, {
        name: values.name as string,
        description: (values.description as string) || null,
        imageUrl: (values.imageUrl as string) || null,
      });
      antdMessage.success('Badge updated successfully');
      await onUpdated();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to update');
    }
  };

  // Field configuration for editable form
  // Logical order: Basic info → Classification → Associations → Visual → Description → Multipliers → Metadata
  const badgeFields: FieldConfig[] = [
    // 1. Basic Information
    {
      name: 'name',
      label: 'Badge Name',
      type: 'text',
      required: true,
      maxLength: 500,
    },
    {
      name: 'type',
      label: 'Type',
      type: 'text',
      editable: false,
    },
    {
      name: 'rarity',
      label: 'Rarity',
      type: 'text',
      editable: false,
    },
    {
      name: 'categoryName',
      label: 'Category',
      type: 'text',
      editable: false,
      render: () => badge.categoryName ?? '—',
    },

    // 2. Associations
    {
      name: 'collectionName',
      label: 'Collection',
      type: 'text',
      editable: false,
      render: () =>
        badge.collectionId ? (
          <Link to={`/gamification/collections/${badge.collectionId}`}>{badge.collectionName}</Link>
        ) : (
          '—'
        ),
    },

    // 3. Visual
    {
      name: 'imageUrl',
      label: 'Badge Image',
      type: 'upload',
      uploadConfig: {
        accept: 'image/jpeg,image/jpg,image/png,image/gif,image/webp',
        maxSize: 5 * 1024 * 1024,
        onUpload: async (file: File) => {
          const response = await uploadBadgeImage(file);
          if (!response.data?.url) throw new Error('Upload failed');
          return response.data.url;
        },
      },
    },

    // 4. Description
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      rows: 3,
      maxLength: 2000,
    },

    // 5. Metadata (Read-only)
    {
      name: 'createdAt',
      label: 'Created',
      type: 'text',
      editable: false,
      render: (v) => new Date(v as string).toLocaleString('en-US'),
    },
    {
      name: 'updatedAt',
      label: 'Updated',
      type: 'text',
      editable: false,
      render: (v) => (v ? new Date(v as string).toLocaleString('en-US') : '—'),
    },
  ];

  return (
    <div>
      <Row gutter={16}>
        {badge.imageUrl && (
          <Col xs={24} lg={8}>
            <Card bordered style={{ marginBottom: 16 }}>
              <Image
                src={badge.imageUrl}
                alt={badge.name}
                style={{ width: '100%', borderRadius: 8 }}
                preview
              />
            </Card>
          </Col>
        )}
        <Col xs={24} lg={badge.imageUrl ? 16 : 24}>
          <EditableFormSection
            title="BADGE METADATA"
            data={badge}
            fields={badgeFields}
            onSave={handleUpdateBadge}
            bordered
            columns={2}
          />
        </Col>
      </Row>
    </div>
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
