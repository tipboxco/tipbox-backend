import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Tabs,
  Button,
  Input,
  Select,
  InputNumber,
  Form,
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
  updateCollection,
  deleteCollection,
  fetchCollectionBadges,
  removeCollectionBadge,
  fetchBadgeCategories,
  createBadge,
  updateBadge,
  fetchBadge,
  fetchActionTypes,
  createCollectionGoal,
} from '../../api/admin-badges-collections';
import type {
  AdminCollectionDetailResponse,
  AdminCollectionBadgeListItem,
  AdminBadgeCategoryListItem,
  AdminActionTypeListItem,
  AdminBadgeDetailResponse,
} from '../../types/admin';
import { FORM_LAYOUT_VERTICAL } from '../../constants/form-layout';

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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: collection.name,
    bannerUrl: collection.bannerUrl ?? '',
    owner: collection.owner ?? '',
    focusSector: collection.focusSector ?? '',
    targetGroup: collection.targetGroup ?? '',
    shortDescription: collection.shortDescription ?? '',
    longDescription: collection.longDescription ?? '',
    unlockCondition: collection.unlockCondition ?? '',
    completionBonus: collection.completionBonus ?? '',
    categoryId: collection.categoryId ?? '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCollection(collection.id, {
        name: form.name,
        bannerUrl: form.bannerUrl || null,
        owner: form.owner || null,
        focusSector: form.focusSector || null,
        targetGroup: form.targetGroup || null,
        shortDescription: form.shortDescription || null,
        longDescription: form.longDescription || null,
        unlockCondition: form.unlockCondition || null,
        completionBonus: form.completionBonus || null,
        categoryId: form.categoryId || null,
      });
      setEditing(false);
      antdMessage.success('Collection updated');
      onUpdated();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

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
      {!editing ? (
        <>
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
            <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
              Delete
            </Button>
          </Space>
        </>
      ) : (
        <>
          <Form {...FORM_LAYOUT_VERTICAL} style={{ width: '100%' }}>
            <Form.Item label="Collection Name">
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Form.Item>
            <Form.Item label="Owner">
              <Input value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} />
            </Form.Item>
            <Form.Item label="Focus Sector">
              <Input
                value={form.focusSector}
                onChange={(e) => setForm((f) => ({ ...f, focusSector: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Target Group">
              <Input
                value={form.targetGroup}
                onChange={(e) => setForm((f) => ({ ...f, targetGroup: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Short Description">
              <Input.TextArea
                value={form.shortDescription}
                onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
                rows={2}
              />
            </Form.Item>
            <Form.Item label="Long Description">
              <Input.TextArea
                value={form.longDescription}
                onChange={(e) => setForm((f) => ({ ...f, longDescription: e.target.value }))}
                rows={4}
              />
            </Form.Item>
            <Form.Item label="Cover Image (URL)">
              <Input value={form.bannerUrl} onChange={(e) => setForm((f) => ({ ...f, bannerUrl: e.target.value }))} />
            </Form.Item>
            <Form.Item label="Prerequisite">
              <Input
                value={form.unlockCondition}
                onChange={(e) => setForm((f) => ({ ...f, unlockCondition: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Completion Reward">
              <Input
                value={form.completionBonus}
                onChange={(e) => setForm((f) => ({ ...f, completionBonus: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Category ID (optional)">
              <Input value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} />
            </Form.Item>

            <Space style={{ marginTop: 24 }}>
            <Button type="primary" onClick={handleSave} loading={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button onClick={() => setEditing(false)}>Cancel</Button>
            </Space>
          </Form>
        </>
      )}
    </Card>
  );
}

const INIT_ADD_FORM = {
  name: '',
  description: '',
  imageUrl: '',
  rarity: 'COMMON' as 'COMMON' | 'RARE' | 'EPIC',
  actionTypeId: '',
  pointsRequired: 1,
  difficulty: 'MEDIUM' as 'EASY' | 'MEDIUM' | 'HARD',
  categoryId: '',
};

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
  const [badgeCategories, setBadgeCategories] = useState<AdminBadgeCategoryListItem[]>([]);
  const [actionTypes, setActionTypes] = useState<AdminActionTypeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingActionTypes, setLoadingActionTypes] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState(INIT_ADD_FORM);
  const [addError, setAddError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchActionTypes();
        const data = res.data;
        if (!cancelled && data?.length) {
          setActionTypes(data);
          setAddForm((f) => (f.actionTypeId ? f : { ...f, actionTypeId: data[0].id }));
        }
      } catch (e) {
        if (!cancelled) console.error(e);
      } finally {
        if (!cancelled) setLoadingActionTypes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (collectionCategoryId !== null) return;
    let cancelled = false;
    setLoadingCategories(true);
    (async () => {
      try {
        const res = await fetchBadgeCategories();
        if (!cancelled && res.data?.length) {
          setBadgeCategories(res.data);
          setAddForm((f) => (f.categoryId ? f : { ...f, categoryId: res.data![0].id }));
        }
      } catch (e) {
        if (!cancelled) console.error(e);
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collectionCategoryId]);

  const effectiveCategoryId = collectionCategoryId ?? addForm.categoryId;

  const handleAddBadge = async () => {
    setAddError(null);
    if (!addForm.name.trim()) {
      setAddError('Badge name is required.');
      return;
    }
    if (!effectiveCategoryId) {
      setAddError('Select badge category.');
      return;
    }
    if (!addForm.actionTypeId) {
      setAddError('Select activation type.');
      return;
    }
    if (addForm.pointsRequired < 1) {
      setAddError('Target count must be at least 1.');
      return;
    }
    setAdding(true);
    try {
      const badgeRes = await createBadge({
        name: addForm.name.trim(),
        description: addForm.description.trim() || null,
        imageUrl: addForm.imageUrl.trim() || null,
        type: 'COLLECTION',
        rarity: addForm.rarity,
        categoryId: effectiveCategoryId,
        collectionId,
      });
      const newBadgeId = badgeRes.data?.id;
      if (newBadgeId) {
        await createCollectionGoal(collectionId, {
          actionTypeId: addForm.actionTypeId,
          rewardBadgeId: newBadgeId,
          pointsRequired: addForm.pointsRequired,
          title: addForm.name.trim(),
          difficulty: addForm.difficulty,
        });
      }
      setAddForm({
        ...INIT_ADD_FORM,
        actionTypeId: actionTypes[0]?.id ?? '',
        categoryId: collectionCategoryId ?? badgeCategories[0]?.id ?? '',
      });
      antdMessage.success('Badge added');
      loadBadges();
      onUpdated();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add badge');
    } finally {
      setAdding(false);
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
      <Card bordered title="Add badge" style={{ marginBottom: 24 }}>
        {addError && (
          <Alert message="Error" description={addError} type="error" closable onClose={() => setAddError(null)} style={{ marginBottom: 16 }} />
        )}
        <Row gutter={16}>
          <Col xs={24} md={12} lg={6}>
            <Form.Item label="Name">
              <Input
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Badge name"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12} lg={6}>
            <Form.Item label="Description">
              <Input
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12} lg={6}>
            <Form.Item label="Image URL">
              <Input
                value={addForm.imageUrl}
                onChange={(e) => setAddForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://..."
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12} lg={6}>
            <Form.Item label="Rarity">
              <Select
                value={addForm.rarity}
                onChange={(value) => setAddForm((f) => ({ ...f, rarity: value }))}
              >
                <Select.Option value="COMMON">COMMON</Select.Option>
                <Select.Option value="RARE">RARE</Select.Option>
                <Select.Option value="EPIC">EPIC</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          {collectionCategoryId === null && (
            <Col xs={24} md={12} lg={6}>
              <Form.Item label="Badge category" required>
                <Select
                  value={addForm.categoryId || undefined}
                  onChange={(value) => setAddForm((f) => ({ ...f, categoryId: value }))}
                  loading={loadingCategories}
                  placeholder={loadingCategories ? 'Loading...' : 'Select category'}
                >
                  {badgeCategories.map((c) => (
                    <Select.Option key={c.id} value={c.id}>
                      {c.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          )}
        </Row>
        <Row gutter={16}>
          <Col xs={24} md={12} lg={8}>
            <Form.Item label="Activation Type">
              <Select
                value={addForm.actionTypeId}
                onChange={(value) => setAddForm((f) => ({ ...f, actionTypeId: value }))}
                loading={loadingActionTypes}
                placeholder={loadingActionTypes ? 'Loading...' : 'Select'}
              >
                {actionTypes.map((a) => (
                  <Select.Option key={a.id} value={a.id}>
                    {a.label} ({a.mainAction} / {a.code})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={12} lg={8}>
            <Form.Item label="Target Count">
              <InputNumber
                min={1}
                value={addForm.pointsRequired}
                onChange={(value) => setAddForm((f) => ({ ...f, pointsRequired: Math.max(1, value || 1) }))}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12} lg={8}>
            <Form.Item label="Difficulty">
              <Select
                value={addForm.difficulty}
                onChange={(value) => setAddForm((f) => ({ ...f, difficulty: value }))}
              >
                <Select.Option value="EASY">Easy</Select.Option>
                <Select.Option value="MEDIUM">Medium</Select.Option>
                <Select.Option value="HARD">Hard</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddBadge}
          loading={adding}
          disabled={loadingActionTypes || !addForm.actionTypeId || !effectiveCategoryId}
        >
          {adding ? 'Adding...' : 'Add badge'}
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
