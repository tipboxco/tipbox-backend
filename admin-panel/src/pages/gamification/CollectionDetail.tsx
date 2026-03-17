import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Tabs,
  Table,
  Button,
  Space,
  Spin,
  Empty,
  Modal,
  Row,
  Col,
  Typography,
  Image,
  Avatar,
  Progress,
  Tag,
  Switch,
  Tooltip,
  Badge as AntBadge,
  theme,
  message as antdMessage,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  TrophyOutlined,
  FolderOpenOutlined,
  CheckCircleOutlined,
  UserOutlined,
  HolderOutlined,
  SaveOutlined,
  EyeInvisibleOutlined,
  MenuOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import EditableFormSection from '../../components/form/EditableFormSection';
import type { FieldConfig } from '../../components/form/types';
import type { StatItemData } from '../../components/StatItem';
import {
  fetchCollection,
  deleteCollection,
  fetchCollectionBadges,
  removeCollectionBadge,
  updateCollection,
  updateBadge,
  bulkReorderBadges,
  fetchCollectionCategories,
  uploadMedia,
  uploadHighlightsImage,
  fetchCollectionUserProgress,
  type AdminCollectionCategoryMain,
  type AdminCollectionUserProgressItem,
  type AdminCollectionUserProgressBadge,
} from '../../api/admin-badges-collections';
import type {
  AdminCollectionDetailResponse,
  AdminCollectionBadgeListItem,
} from '../../types/admin';
import AddBadgeToCollectionModal from './modals/AddBadgeToCollectionModal';

const { Text } = Typography;

function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<AdminCollectionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [addBadgeModalOpen, setAddBadgeModalOpen] = useState(false);
  const [badgesRefreshKey, setBadgesRefreshKey] = useState(0);

  const loadCollection = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetchCollection(id);
      if (res.data) setCollection(res.data);
      else setError('Collection not found');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCollection();
  }, [loadCollection]);

  if (!id) {
    return (
      <div>
        <PageHeader
          title="Error"
          description="Invalid collection ID"
          icon={<FolderOpenOutlined />}
          backTo="/gamification/collections"
          backLabel="Back to list"
        />
      </div>
    );
  }

  if (loading || !collection) {
    return (
      <div>
        <PageHeader
          title={loading ? 'Loading...' : 'Error'}
          description={loading ? undefined : error ?? 'Collection not found'}
          icon={<FolderOpenOutlined />}
          backTo="/gamification/collections"
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

  const tabItems = [
    {
      key: 'summary',
      label: 'Summary',
      children: (
        <CollectionSummaryTab
          collection={collection}
          onUpdated={loadCollection}
          onDeleted={() => navigate('/gamification/collections')}
        />
      ),
    },
    {
      key: 'badges',
      label: "Badges",
      children: (
        <CollectionBadgesTab
          collectionId={id}
          collectionName={collection.name}
          onUpdated={loadCollection}
          refreshKey={badgesRefreshKey}
        />
      ),
    },
    {
      key: 'user-progress',
      label: 'User Progress',
      children: <CollectionUserProgressTab collectionId={id} />,
    },
  ];

  const statsData: StatItemData[] = [
    {
      label: 'Badge count',
      value: collection.badgesCount,
      icon: <TrophyOutlined />,
    },
  ];

  return (
    <div>
      <PageHeader
        title={collection.name}
        description={collection.categoryName ?? collection.categoryId ?? 'Custom'}
        icon={<FolderOpenOutlined />}
        backTo="/gamification/collections"
        backLabel="Back to list"
        stats={statsData}
        statsLoading={loading}
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        tabBarExtraContent={
          activeTab === 'badges' ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddBadgeModalOpen(true)}
            >
              Add Badge
            </Button>
          ) : null
        }
      />

      {addBadgeModalOpen && id && (
        <AddBadgeToCollectionModal
          open={addBadgeModalOpen}
          collectionId={id}
          collectionCategoryId={collection.categoryId ?? null}
          onClose={() => setAddBadgeModalOpen(false)}
          onSuccess={() => {
            loadCollection();
            setBadgesRefreshKey((prev) => prev + 1);
            setActiveTab('badges');
            setAddBadgeModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CollectionSummaryTab({
  collection,
  onUpdated,
  onDeleted,
}: {
  collection: AdminCollectionDetailResponse;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [categories, setCategories] = useState<AdminCollectionCategoryMain[]>([]);

  // Load categories on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchCollectionCategories();
        if (!cancelled && res.data) {
          setCategories(res.data);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = () => {
    Modal.confirm({
      title: 'Delete Collection',
      content: 'This collection will be deleted. Badges in it will be removed from the collection. Are you sure?',
      okText: 'Yes, delete',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteCollection(collection.id);
          antdMessage.success('Collection deleted');
          onDeleted();
        } catch (e) {
          antdMessage.error(e instanceof Error ? e.message : 'Failed to delete');
        }
      },
    });
  };

  const handleUpdateCollection = async (values: Record<string, unknown>) => {
    try {
      // Convert __CUSTOM__ to null (no category)
      let categoryId = (values.categoryId as string) || null;
      if (categoryId === '__CUSTOM__') {
        categoryId = null;
      }

      await updateCollection(collection.id, {
        name: values.name as string,
        owner: (values.owner as string) || null,
        focusSector: (values.focusSector as string) || null,
        targetGroup: (values.targetGroup as string) || null,
        shortDescription: (values.shortDescription as string) || null,
        longDescription: (values.longDescription as string) || null,
        unlockCondition: (values.unlockCondition as string) || null,
        completionBonus: (values.completionBonus as string) || null,
        categoryId: categoryId,
        bannerUrl: (values.bannerUrl as string) || null,
        highlightsImage: (values.highlightsImage as string) || null,
      });
      antdMessage.success('Collection updated successfully');
      await onUpdated();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to update');
    }
  };

  // Prepare category options (flat list with Custom first)
  const categoryOptions = [
    { label: 'Custom', value: '__CUSTOM__' },
    ...categories.flatMap((main) => [
      { label: main.name, value: main.id },
      ...main.children.map((sub) => ({ label: `  ├─ ${sub.name}`, value: sub.id })),
    ]),
  ];

  // Transform collection data: null categoryId → __CUSTOM__
  const collectionData = useMemo(() => ({
    ...collection,
    categoryId: collection.categoryId ?? '__CUSTOM__',
  }), [collection]);

  // Field configuration for editable form
  // Optimized layout: short fields in 2 columns, long fields span full width
  // Logical order: Basic info → Classification → Descriptions → Images → Rewards → Metadata
  const collectionFields: FieldConfig[] = [
    // 1. Basic Information
    {
      name: 'name',
      label: 'Collection Name',
      type: 'text',
      required: true,
      maxLength: 500,
      span: 2, // Full width for important field
    },
    {
      name: 'categoryId',
      label: 'Category',
      type: 'select',
      options: categoryOptions,
      render: () => collection.categoryName ?? collection.categoryId ?? 'Custom'
    },
    {
      name: 'owner',
      label: 'Owner',
      type: 'text',
      maxLength: 200
    },

    // 2. Classification & Targeting
    {
      name: 'focusSector',
      label: 'Focus Sector',
      type: 'text',
      maxLength: 200,
      placeholder: 'e.g., Electronics, Beauty, Gaming'
    },
    {
      name: 'targetGroup',
      label: 'Target Group',
      type: 'text',
      maxLength: 200,
      placeholder: 'e.g., Beginners, Professionals'
    },

    // 3. Descriptions
    {
      name: 'shortDescription',
      label: 'Short Description',
      type: 'textarea',
      rows: 2,
      maxLength: 2000,
      span: 2,
      placeholder: 'Brief summary of this collection'
    },
    {
      name: 'longDescription',
      label: 'Long Description',
      type: 'textarea',
      rows: 3,
      maxLength: 5000,
      span: 2,
      placeholder: 'Detailed description of this collection'
    },

    // 4. Cover Image
    {
      name: 'bannerUrl',
      label: 'Cover Image',
      type: 'upload',
      span: 2,
      uploadConfig: {
        accept: 'image/jpeg,image/jpg,image/png,image/gif,image/webp',
        maxSize: 5 * 1024 * 1024,
        onUpload: async (file: File) => {
          const response = await uploadMedia(file);
          if (!response.data?.url) throw new Error('Upload failed');
          return response.data.url;
        },
      },
    },

    // 4b. Highlights Image
    {
      name: 'highlightsImage',
      label: 'Highlights Image',
      type: 'upload',
      span: 2,
      uploadConfig: {
        accept: 'image/jpeg,image/jpg,image/png,image/gif,image/webp',
        maxSize: 5 * 1024 * 1024,
        onUpload: async (file: File) => {
          const response = await uploadHighlightsImage(file);
          if (!response.data?.url) throw new Error('Upload failed');
          return response.data.url;
        },
      },
    },

    // 5. Rewards & Conditions
    {
      name: 'unlockCondition',
      label: 'Unlock Condition',
      type: 'text',
      maxLength: 500,
      placeholder: 'Requirement to unlock this collection'
    },
    {
      name: 'completionBonus',
      label: 'Completion Reward',
      type: 'text',
      maxLength: 500,
      placeholder: 'Reward for completing this collection'
    },

    // 6. Metadata (Read-only)
    {
      name: 'createdAt',
      label: 'Created',
      type: 'text',
      editable: false,
      render: (v) => new Date(v as string).toLocaleString('en-US')
    },
    {
      name: 'updatedAt',
      label: 'Updated',
      type: 'text',
      editable: false,
      render: (v) => new Date(v as string).toLocaleString('en-US')
    },
  ];

  return (
    <div>
      <Row gutter={16}>
        {collection.bannerUrl && (
          <Col xs={24} lg={8}>
            <Card bordered style={{ marginBottom: 16 }}>
              <Image
                src={collection.bannerUrl}
                alt={collection.name}
                style={{ width: '100%', borderRadius: 8 }}
                preview
              />
            </Card>
          </Col>
        )}
        <Col xs={24} lg={collection.bannerUrl ? 16 : 24}>
          <EditableFormSection
            title="COLLECTION METADATA"
            data={collectionData}
            fields={collectionFields}
            onSave={handleUpdateCollection}
            bordered
            columns={2}
          />

          <Card bordered style={{ marginTop: 16 }}>
            <Space>
              <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
                Delete Collection
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

/* ========== Badge Card with Order Arrows ========== */

function BadgeCard({
  badge,
  index,
  total,
  collectionId,
  onRemove,
  onStatusChange,
  onMoveUp,
  onMoveDown,
  removing,
  statusChanging,
}: {
  badge: AdminCollectionBadgeListItem;
  index: number;
  total: number;
  collectionId: string;
  onRemove: (id: string) => void;
  onStatusChange: (id: string, status: 'ACTIVE' | 'INACTIVE') => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  removing: string | null;
  statusChanging: string | null;
}) {
  const { token } = theme.useToken();
  const isInactive = badge.status === 'INACTIVE';

  return (
    <Col xs={24} sm={12} md={8} lg={6}>
      <AntBadge.Ribbon
        text={isInactive ? 'Inactive' : 'Active'}
        color={isInactive ? 'default' : 'green'}
      >
        <Card
          bordered
          hoverable
          style={{
            opacity: isInactive ? 0.55 : 1,
            transition: 'opacity 0.3s ease',
          }}
          cover={
            <div style={{ position: 'relative' }}>
              {badge.imageUrl ? (
                <Image
                  src={badge.imageUrl}
                  alt={badge.name}
                  style={{
                    height: 150,
                    objectFit: 'cover',
                    filter: isInactive ? 'grayscale(70%)' : 'none',
                    transition: 'filter 0.3s ease',
                  }}
                  preview={false}
                />
              ) : (
                <div
                  style={{
                    height: 150,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: token.colorBgElevated,
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <TrophyOutlined style={{ fontSize: 55, color: token.colorTextQuaternary }} />
                </div>
              )}
              {/* Order badge + arrow controls */}
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <div
                  style={{
                    background: 'rgba(0,0,0,0.6)',
                    borderRadius: 6,
                    padding: '2px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <MenuOutlined style={{ color: '#fff', fontSize: 12 }} />
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>
                    #{index + 1}
                  </span>
                </div>
                <Button
                  size="small"
                  type="text"
                  icon={<ArrowUpOutlined style={{ color: '#fff', fontSize: 12 }} />}
                  disabled={index === 0}
                  onClick={() => onMoveUp(index)}
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    borderRadius: 6,
                    minWidth: 24,
                    height: 24,
                    padding: 0,
                    border: 'none',
                  }}
                />
                <Button
                  size="small"
                  type="text"
                  icon={<ArrowDownOutlined style={{ color: '#fff', fontSize: 12 }} />}
                  disabled={index === total - 1}
                  onClick={() => onMoveDown(index)}
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    borderRadius: 6,
                    minWidth: 24,
                    height: 24,
                    padding: 0,
                    border: 'none',
                  }}
                />
              </div>
            </div>
          }
          actions={[
            <Tooltip key="status" title={isInactive ? 'Activate badge' : 'Deactivate badge'}>
              <Switch
                size="small"
                checked={!isInactive}
                loading={statusChanging === badge.id}
                onChange={(checked) => onStatusChange(badge.id, checked ? 'ACTIVE' : 'INACTIVE')}
              />
            </Tooltip>,
            <Link
              key="view"
              to={`/gamification/collections/${collectionId}/badges/${badge.id}`}
            >
              <Button type="link" size="small" icon={<EditOutlined />}>
                Detail
              </Button>
            </Link>,
            <Button
              key="remove"
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={removing === badge.id}
              onClick={() => onRemove(badge.id)}
            >
              Remove
            </Button>,
          ]}
        >
          <Card.Meta
            title={
              <Link to={`/gamification/collections/${collectionId}/badges/${badge.id}`}>
                <Space size={4}>
                  {isInactive && (
                    <EyeInvisibleOutlined style={{ color: token.colorTextTertiary, fontSize: 14 }} />
                  )}
                  {badge.name}
                </Space>
              </Link>
            }
            description={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {badge.description && (
                  <Text
                    type="secondary"
                    ellipsis={{ tooltip: badge.description }}
                    style={{ fontSize: 13 }}
                  >
                    {badge.description}
                  </Text>
                )}
                <Space wrap size={4}>
                  <Tag
                    color={
                      badge.rarity === 'EPIC'
                        ? 'purple'
                        : badge.rarity === 'RARE'
                          ? 'blue'
                          : 'default'
                    }
                    style={{ margin: 0, fontSize: 11 }}
                  >
                    {badge.rarity}
                  </Tag>
                  {badge.categoryName && (
                    <Tag style={{ margin: 0, fontSize: 11 }}>{badge.categoryName}</Tag>
                  )}
                </Space>
              </div>
            }
          />
        </Card>
      </AntBadge.Ribbon>
    </Col>
  );
}

function CollectionBadgesTab({
  collectionId,
  collectionName,
  onUpdated,
  refreshKey,
}: {
  collectionId: string;
  collectionName: string;
  onUpdated: () => void;
  refreshKey?: number;
}) {
  const { token } = theme.useToken();
  const [badges, setBadges] = useState<AdminCollectionBadgeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [statusChanging, setStatusChanging] = useState<string | null>(null);
  const [orderChanged, setOrderChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const originalOrderRef = useRef<string[]>([]);

  const loadBadges = useCallback(async () => {
    try {
      const res = await fetchCollectionBadges(collectionId);
      const data = res.data ?? [];
      setBadges(data);
      originalOrderRef.current = data.map((b) => b.id);
      setOrderChanged(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    loadBadges();
  }, [loadBadges, refreshKey]);

  const moveBadge = (fromIndex: number, toIndex: number) => {
    setBadges((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      const newIds = updated.map((b) => b.id);
      setOrderChanged(JSON.stringify(newIds) !== JSON.stringify(originalOrderRef.current));
      return updated;
    });
  };

  const handleSaveOrder = async () => {
    setSaving(true);
    try {
      const reorderData = badges.map((b, index) => ({ id: b.id, displayOrder: index }));
      await bulkReorderBadges(reorderData);
      setBadges((prev) => prev.map((b, index) => ({ ...b, displayOrder: index })));
      originalOrderRef.current = badges.map((b) => b.id);
      setOrderChanged(false);
      antdMessage.success('Badge order saved successfully');
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  const handleResetOrder = () => {
    setBadges((prev) => {
      const original = originalOrderRef.current;
      const sorted = [...prev].sort(
        (a, b) => original.indexOf(a.id) - original.indexOf(b.id),
      );
      return sorted;
    });
    setOrderChanged(false);
  };

  const handleStatusChange = async (badgeId: string, status: 'ACTIVE' | 'INACTIVE') => {
    setStatusChanging(badgeId);
    try {
      await updateBadge(badgeId, { status });
      setBadges((prev) => prev.map((b) => (b.id === badgeId ? { ...b, status } : b)));
      antdMessage.success(`Badge ${status === 'ACTIVE' ? 'activated' : 'deactivated'}`);
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setStatusChanging(null);
    }
  };

  const handleRemove = async (badgeId: string) => {
    Modal.confirm({
      title: 'Remove Badge',
      content: 'This badge will be removed from the collection. Are you sure?',
      okText: 'Yes, remove',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        setRemoving(badgeId);
        try {
          await removeCollectionBadge(collectionId, badgeId);
          antdMessage.success('Badge removed from collection');
          await loadBadges();
          onUpdated();
        } catch (e) {
          antdMessage.error(e instanceof Error ? e.message : 'Failed to remove');
        } finally {
          setRemoving(null);
        }
      },
    });
  };

  const activeBadges = badges.filter((b) => b.status === 'ACTIVE');
  const inactiveBadges = badges.filter((b) => b.status === 'INACTIVE');

  return (
    <Card
      bordered
      title={
        <Space>
          <span>Collection badges ({collectionName})</span>
          <Tag color="green">{activeBadges.length} active</Tag>
          {inactiveBadges.length > 0 && (
            <Tag color="default">{inactiveBadges.length} inactive</Tag>
          )}
        </Space>
      }
      extra={
        orderChanged ? (
          <Space>
            <Button onClick={handleResetOrder} size="small">
              Reset
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSaveOrder}
              size="small"
            >
              Save Order
            </Button>
          </Space>
        ) : null
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : badges.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <Text>No badges in this collection yet.</Text>
              <br />
              <Text type="secondary">
                Click &quot;Add Badge&quot; button above to add badges.
              </Text>
            </div>
          }
        />
      ) : (
        <>
          {orderChanged && (
            <div
              style={{
                padding: '8px 16px',
                marginBottom: 16,
                background: token.colorWarningBg,
                border: `1px solid ${token.colorWarningBorder}`,
                borderRadius: token.borderRadius,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <HolderOutlined style={{ color: token.colorWarning }} />
              <Text style={{ fontSize: 13, color: token.colorWarningText }}>
                You have unsaved order changes. Click &quot;Save Order&quot; to apply.
              </Text>
            </div>
          )}
          {!orderChanged && badges.length > 1 && (
            <div
              style={{
                padding: '8px 16px',
                marginBottom: 16,
                background: token.colorBgElevated,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadius,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <MenuOutlined style={{ color: token.colorTextTertiary }} />
              <Text type="secondary" style={{ fontSize: 13 }}>
                Use arrow buttons to reorder badges. Toggle the switch to activate/deactivate.
              </Text>
            </div>
          )}
          <Row gutter={[16, 16]}>
            {badges.map((b, idx) => (
              <BadgeCard
                key={b.id}
                badge={b}
                index={idx}
                total={badges.length}
                collectionId={collectionId}
                onRemove={handleRemove}
                onStatusChange={handleStatusChange}
                onMoveUp={(i) => moveBadge(i, i - 1)}
                onMoveDown={(i) => moveBadge(i, i + 1)}
                removing={removing}
                statusChanging={statusChanging}
              />
            ))}
          </Row>
        </>
      )}
    </Card>
  );
}

/* ========== User Progress Tab ========== */

function CollectionUserProgressTab({ collectionId }: { collectionId: string }) {
  const [data, setData] = useState<AdminCollectionUserProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCollectionUserProgress(collectionId, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setData(res.data ?? []);
      setTotal(res.pagination?.total ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [collectionId, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const expandedRowRender = (record: AdminCollectionUserProgressItem) => (
    <Row gutter={[8, 8]} style={{ padding: '8px 0' }}>
      {record.badges.map((b: AdminCollectionUserProgressBadge) => (
        <Col key={b.badgeId}>
          <Space size="small">
            <Avatar
              src={b.badgeImageUrl ?? undefined}
              icon={!b.badgeImageUrl ? <TrophyOutlined /> : undefined}
              size="small"
            />
            <Text style={{ fontSize: 13 }}>{b.badgeName}</Text>
            {b.claimed ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                Claimed
              </Tag>
            ) : (
              <Tag color="default">Unclaimed</Tag>
            )}
            {b.claimedAt && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(b.claimedAt).toLocaleDateString('en-US')}
              </Text>
            )}
          </Space>
        </Col>
      ))}
    </Row>
  );

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_: unknown, record: AdminCollectionUserProgressItem) => (
        <Space>
          <UserOutlined />
          <span>{record.userName ?? record.displayName ?? record.email ?? record.userId}</span>
        </Space>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 220,
      render: (_: unknown, record: AdminCollectionUserProgressItem) => (
        <Progress
          percent={record.progressPercent}
          size="small"
          format={() => `${record.earnedBadges}/${record.totalBadges}`}
        />
      ),
    },
    {
      title: 'Earned',
      dataIndex: 'earnedBadges',
      key: 'earnedBadges',
      width: 80,
      align: 'center' as const,
    },
    {
      title: 'Claimed',
      dataIndex: 'claimed',
      key: 'claimed',
      width: 80,
      align: 'center' as const,
    },
  ];

  return (
    <Card bordered title={`User Progress (${total} users)`}>
      <Table
        dataSource={data}
        columns={columns}
        rowKey="userId"
        loading={loading}
        expandable={{
          expandedRowRender,
          rowExpandable: (record: AdminCollectionUserProgressItem) => record.badges.length > 0,
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p: number) => setPage(p),
          showSizeChanger: false,
          showTotal: (t: number) => `${t} users total`,
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No users have earned badges in this collection yet."
            />
          ),
        }}
      />
    </Card>
  );
}

export default CollectionDetail;
