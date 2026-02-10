import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Tabs,
  Button,
  Input,
  Select,
  Space,
  Spin,
  Empty,
  Modal,
  Alert,
  Row,
  Col,
  Typography,
  Descriptions,
  Image,
  message as antdMessage,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import {
  fetchCollection,
  deleteCollection,
  fetchCollectionBadges,
  removeCollectionBadge,
  fetchBadgeCategories,
  updateBadge,
  fetchBadge,
} from '../../api/admin-badges-collections';
import type {
  AdminCollectionDetailResponse,
  AdminCollectionBadgeListItem,
  AdminBadgeCategoryListItem,
  AdminBadgeDetailResponse,
} from '../../types/admin';
import EditCollectionModal from './modals/EditCollectionModal';
import AddBadgeToCollectionModal from './modals/AddBadgeToCollectionModal';

const { Title, Text } = Typography;

function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<AdminCollectionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <Link to="/gamification/collections">
          <Button icon={<ArrowLeftOutlined />}>Back to list</Button>
        </Link>
        <Text>Invalid collection ID</Text>
      </div>
    );
  }

  if (loading || !collection) {
    return (
      <div>
        <Link to="/gamification/collections">
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
          collectionCategoryId={collection.categoryId ?? null}
          onUpdated={loadCollection}
        />
      ),
    },
  ];

  return (
    <div>
      <Link to="/gamification/collections">
        <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>
          Back to list
        </Button>
      </Link>

      <Card bordered style={{ marginBottom: 16 }}>
        {collection.bannerUrl && (
          <Image
            src={collection.bannerUrl}
            alt={collection.name}
            style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 8, marginBottom: 16 }}
          />
        )}
        <Title level={2} style={{ marginBottom: 8 }}>
          {collection.name}
        </Title>
        <Space wrap>
          <Text type="secondary">ID: {collection.id}</Text>
          {(collection.categoryName ?? collection.categoryId) && (
            <>
              <Text type="secondary">•</Text>
              <Text>{collection.categoryName ?? collection.categoryId}</Text>
            </>
          )}
          {collection.owner && (
            <>
              <Text type="secondary">•</Text>
              <Text>{collection.owner}</Text>
            </>
          )}
        </Space>
        <Row gutter={24} style={{ marginTop: 24 }}>
          <Col span={12}>
            <Card bordered>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Badge count
              </Text>
              <Title level={3} style={{ margin: 0 }}>
                {collection.badgesCount}
              </Title>
            </Card>
          </Col>
          <Col span={12}>
            <Card bordered>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Goal count
              </Text>
              <Title level={3} style={{ margin: 0 }}>
                {collection.goalsCount ?? 0}
              </Title>
            </Card>
          </Col>
        </Row>
      </Card>

      <Tabs items={tabItems} />
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
  const [editModalOpen, setEditModalOpen] = useState(false);

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

  return (
    <Card bordered>
      <Descriptions title="COLLECTION METADATA" bordered column={1}>
        <Descriptions.Item label="Collection Name">{collection.name}</Descriptions.Item>
        <Descriptions.Item label="Owner">{collection.owner || '—'}</Descriptions.Item>
        <Descriptions.Item label="Focus Sector">{collection.focusSector || '—'}</Descriptions.Item>
        <Descriptions.Item label="Target Group">{collection.targetGroup || '—'}</Descriptions.Item>
        <Descriptions.Item label="Short Description">{collection.shortDescription || '—'}</Descriptions.Item>
        <Descriptions.Item label="Long Description">{collection.longDescription || '—'}</Descriptions.Item>
        <Descriptions.Item label="Cover Image">
          {collection.bannerUrl ? (
            <a href={collection.bannerUrl} target="_blank" rel="noreferrer">
              View
            </a>
          ) : (
            '—'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Prerequisite">{collection.unlockCondition || '—'}</Descriptions.Item>
        <Descriptions.Item label="Completion Reward">{collection.completionBonus || '—'}</Descriptions.Item>
        <Descriptions.Item label="Category">
          {collection.categoryName ?? collection.categoryId ?? '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Created">
          {new Date(collection.createdAt).toLocaleString('en-US')}
        </Descriptions.Item>
        <Descriptions.Item label="Updated">
          {new Date(collection.updatedAt).toLocaleString('en-US')}
        </Descriptions.Item>
      </Descriptions>

      <Space style={{ marginTop: 24 }}>
        <Button type="primary" icon={<EditOutlined />} onClick={() => setEditModalOpen(true)}>
          Edit
        </Button>
        <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
          Delete
        </Button>
      </Space>

      {editModalOpen && (
        <EditCollectionModal
          open={editModalOpen}
          collectionId={collection.id}
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

function CollectionBadgesTab({
  collectionId,
  collectionName,
  collectionCategoryId,
  onUpdated,
}: {
  collectionId: string;
  collectionName: string;
  collectionCategoryId: string | null;
  onUpdated: () => void;
}) {
  const [badges, setBadges] = useState<AdminCollectionBadgeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const loadBadges = useCallback(async () => {
    try {
      const res = await fetchCollectionBadges(collectionId);
      setBadges(res.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    loadBadges();
  }, [loadBadges]);

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
          antdMessage.success('Badge removed');
          loadBadges();
          onUpdated();
        } catch (e) {
          antdMessage.error(e instanceof Error ? e.message : 'Failed to remove');
        } finally {
          setRemoving(null);
        }
      },
    });
  };

  return (
    <div>
      <Card bordered style={{ marginBottom: 24 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setAddModalOpen(true)}
        >
          Add Badge
        </Button>
      </Card>

      <Card bordered title={`Collection badges (${collectionName})`}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : badges.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical">
                <Text>No badges in this collection yet.</Text>
                <Text type="secondary">You can add new badges using the form above.</Text>
              </Space>
            }
          />
        ) : (
          <Row gutter={[16, 16]}>
            {badges.map((b) => (
              <Col xs={24} sm={12} md={8} lg={6} key={b.id}>
                <Card
                  bordered
                  hoverable
                  cover={
                    b.imageUrl ? (
                      <Image
                        src={b.imageUrl}
                        alt={b.name}
                        style={{ height: 150, objectFit: 'cover' }}
                        preview={false}
                      />
                    ) : (
                      <div
                        style={{
                          height: 150,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#f0f0f0',
                        }}
                      >
                        <TrophyOutlined style={{ fontSize: 48, color: '#ccc' }} />
                      </div>
                    )
                  }
                  actions={[
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => setEditingBadgeId(b.id)}
                    >
                      Edit
                    </Button>,
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      loading={removing === b.id}
                      onClick={() => handleRemove(b.id)}
                    >
                      Delete
                    </Button>,
                  ]}
                >
                  <Card.Meta
                    title={
                      <Link to={`/gamification/collections/${collectionId}/badges/${b.id}`}>
                        {b.name}
                      </Link>
                    }
                    description={
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        {b.description && <Text type="secondary" style={{ fontSize: 12 }}>{b.description}</Text>}
                        <Space wrap>
                          <Text type="secondary" style={{ fontSize: 11 }}>{b.rarity}</Text>
                          {b.categoryName && <Text type="secondary" style={{ fontSize: 11 }}>• {b.categoryName}</Text>}
                        </Space>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {new Date(b.createdAt).toLocaleString('en-US')}
                        </Text>
                      </Space>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      {editingBadgeId && (
        <EditBadgeInCollectionModal
          open={!!editingBadgeId}
          badgeId={editingBadgeId}
          onClose={() => setEditingBadgeId(null)}
          onSuccess={() => {
            setEditingBadgeId(null);
            loadBadges();
            onUpdated();
          }}
        />
      )}

      {addModalOpen && (
        <AddBadgeToCollectionModal
          open={addModalOpen}
          collectionId={collectionId}
          collectionCategoryId={collectionCategoryId}
          onClose={() => setAddModalOpen(false)}
          onSuccess={() => {
            loadBadges();
            onUpdated();
            setAddModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function EditBadgeInCollectionModal({
  open,
  badgeId,
  onClose,
  onSuccess,
}: {
  open: boolean;
  badgeId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [badge, setBadge] = useState<AdminBadgeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<AdminBadgeCategoryListItem[]>([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    imageUrl: '',
    rarity: 'COMMON' as string,
    categoryId: '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [badgeRes, catRes] = await Promise.all([fetchBadge(badgeId), fetchBadgeCategories()]);
        if (cancelled) return;
        if (badgeRes.data) {
          setBadge(badgeRes.data);
          setForm({
            name: badgeRes.data.name,
            description: badgeRes.data.description ?? '',
            imageUrl: badgeRes.data.imageUrl ?? '',
            rarity: badgeRes.data.rarity,
            categoryId: badgeRes.data.categoryId,
          });
        }
        if (catRes.data) setCategories(catRes.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [badgeId]);

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      await updateBadge(badgeId, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        rarity: form.rarity,
        categoryId: form.categoryId,
      });
      antdMessage.success('Badge updated');
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Edit badge"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="submit" type="primary" loading={saving} onClick={handleSubmit}>
          {saving ? 'Saving...' : 'Save'}
        </Button>,
      ]}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : !badge ? (
        <Alert message="Error" description="Badge not found." type="error" />
      ) : (
        <>
          {error && (
            <Alert message="Error" description={error} type="error" closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />
          )}
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Form.Item label="Name">
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Form.Item>
            <Form.Item label="Description">
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Image URL">
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Rarity">
              <Select value={form.rarity} onChange={(value) => setForm((f) => ({ ...f, rarity: value }))}>
                <Select.Option value="COMMON">COMMON</Select.Option>
                <Select.Option value="RARE">RARE</Select.Option>
                <Select.Option value="EPIC">EPIC</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="Category">
              <Select
                value={form.categoryId}
                onChange={(value) => setForm((f) => ({ ...f, categoryId: value }))}
              >
                {categories.map((c) => (
                  <Select.Option key={c.id} value={c.id}>
                    {c.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Space>
        </>
      )}
    </Modal>
  );
}

export default CollectionDetail;
