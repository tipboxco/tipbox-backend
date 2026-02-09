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
      else setError('Koleksiyon bulunamadı');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
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
          <Button icon={<ArrowLeftOutlined />}>Listeye dön</Button>
        </Link>
        <Text>Geçersiz koleksiyon ID</Text>
      </div>
    );
  }

  if (loading || !collection) {
    return (
      <div>
        <Link to="/gamification/collections">
          <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>
            Listeye dön
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
      label: 'Özet',
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
      label: "Badge'ler",
      children: (
        <CollectionBadgesTab
          collectionId={id}
          collectionName={collection.name}
          collectionCategoryId={collection.categoryId}
          onUpdated={loadCollection}
        />
      ),
    },
  ];

  return (
    <div>
      <Link to="/gamification/collections">
        <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>
          Listeye dön
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
          <Text type="secondary">•</Text>
          <Text>{collection.categoryName ?? collection.categoryId}</Text>
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
                Badge sayısı
              </Text>
              <Title level={3} style={{ margin: 0 }}>
                {collection.badgesCount}
              </Title>
            </Card>
          </Col>
          <Col span={12}>
            <Card bordered>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Hedef sayısı
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
    collectionObjective: collection.collectionObjective ?? '',
    targetVertical: collection.targetVertical ?? '',
    productScope: collection.productScope ?? '',
    collectionType: collection.collectionType ?? '',
    hookPitch: collection.hookPitch ?? '',
    visualTheme: collection.visualTheme ?? '',
    completionBonus: collection.completionBonus ?? '',
    primaryKpi: collection.primaryKpi ?? '',
    secondaryKpi: collection.secondaryKpi ?? '',
    targetAudience: collection.targetAudience ?? '',
    campaignContext: collection.campaignContext ?? '',
    successMetric: collection.successMetric ?? '',
    sponsorship: collection.sponsorship ?? '',
    unlockCondition: collection.unlockCondition ?? '',
    scheduleLaunchDate: collection.scheduleLaunchDate?.slice(0, 16) ?? '',
    timeStockLimit: collection.timeStockLimit ?? '',
    categoryId: collection.categoryId,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCollection(collection.id, {
        name: form.name,
        bannerUrl: form.bannerUrl || null,
        owner: form.owner || null,
        collectionObjective: form.collectionObjective || null,
        targetVertical: form.targetVertical || null,
        productScope: form.productScope || null,
        collectionType: form.collectionType || null,
        hookPitch: form.hookPitch || null,
        visualTheme: form.visualTheme || null,
        completionBonus: form.completionBonus || null,
        primaryKpi: form.primaryKpi || null,
        secondaryKpi: form.secondaryKpi || null,
        targetAudience: form.targetAudience || null,
        campaignContext: form.campaignContext || null,
        successMetric: form.successMetric || null,
        sponsorship: form.sponsorship || null,
        unlockCondition: form.unlockCondition || null,
        scheduleLaunchDate: form.scheduleLaunchDate ? new Date(form.scheduleLaunchDate).toISOString() : null,
        timeStockLimit: form.timeStockLimit || null,
        categoryId: form.categoryId,
      });
      setEditing(false);
      antdMessage.success('Koleksiyon güncellendi');
      onUpdated();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: 'Koleksiyon Sil',
      content: 'Bu koleksiyon silinecek. İçindeki badge\'ler koleksiyondan çıkarılacak. Emin misiniz?',
      okText: 'Evet, sil',
      cancelText: 'İptal',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteCollection(collection.id);
          antdMessage.success('Koleksiyon silindi');
          onDeleted();
        } catch (e) {
          antdMessage.error(e instanceof Error ? e.message : 'Silinemedi');
        }
      },
    });
  };

  return (
    <Card bordered>
      {!editing ? (
        <>
          <Descriptions title="Tüm bilgiler" bordered column={1}>
            <Descriptions.Item label="Ad">{collection.name}</Descriptions.Item>
            <Descriptions.Item label="Kategori">
              {collection.categoryName ?? collection.categoryId}
            </Descriptions.Item>
            <Descriptions.Item label="Banner">
              {collection.bannerUrl ? (
                <a href={collection.bannerUrl} target="_blank" rel="noreferrer">
                  Görüntüle
                </a>
              ) : (
                '—'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Owner">{collection.owner || '—'}</Descriptions.Item>
            <Descriptions.Item label="Oluşturulma">
              {new Date(collection.createdAt).toLocaleString('tr-TR')}
            </Descriptions.Item>
            <Descriptions.Item label="Güncellenme">
              {new Date(collection.updatedAt).toLocaleString('tr-TR')}
            </Descriptions.Item>
            <Descriptions.Item label="Collection objective">
              {collection.collectionObjective || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Target vertical">{collection.targetVertical || '—'}</Descriptions.Item>
            <Descriptions.Item label="Product scope">{collection.productScope || '—'}</Descriptions.Item>
            <Descriptions.Item label="Collection type">{collection.collectionType || '—'}</Descriptions.Item>
            <Descriptions.Item label="Hook pitch">{collection.hookPitch || '—'}</Descriptions.Item>
            <Descriptions.Item label="Visual theme">{collection.visualTheme || '—'}</Descriptions.Item>
            <Descriptions.Item label="Completion bonus">{collection.completionBonus || '—'}</Descriptions.Item>
            <Descriptions.Item label="Primary KPI">{collection.primaryKpi || '—'}</Descriptions.Item>
            <Descriptions.Item label="Secondary KPI">{collection.secondaryKpi || '—'}</Descriptions.Item>
            <Descriptions.Item label="Target audience">{collection.targetAudience || '—'}</Descriptions.Item>
            <Descriptions.Item label="Campaign context">{collection.campaignContext || '—'}</Descriptions.Item>
            <Descriptions.Item label="Success metric">{collection.successMetric || '—'}</Descriptions.Item>
            <Descriptions.Item label="Sponsorship">{collection.sponsorship || '—'}</Descriptions.Item>
            <Descriptions.Item label="Unlock condition">{collection.unlockCondition || '—'}</Descriptions.Item>
            <Descriptions.Item label="Schedule launch date">
              {collection.scheduleLaunchDate
                ? new Date(collection.scheduleLaunchDate).toLocaleString('tr-TR')
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Time/stock limit">{collection.timeStockLimit || '—'}</Descriptions.Item>
          </Descriptions>

          <Space style={{ marginTop: 24 }}>
            <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>
              Düzenle
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
              Sil
            </Button>
          </Space>
        </>
      ) : (
        <>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Form.Item label="Ad">
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Form.Item>
            <Form.Item label="Banner URL">
              <Input value={form.bannerUrl} onChange={(e) => setForm((f) => ({ ...f, bannerUrl: e.target.value }))} />
            </Form.Item>
            <Form.Item label="Owner">
              <Input value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} />
            </Form.Item>
            <Form.Item label="Kategori ID">
              <Input value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} />
            </Form.Item>
            <Form.Item label="Collection objective">
              <Input
                value={form.collectionObjective}
                onChange={(e) => setForm((f) => ({ ...f, collectionObjective: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Target vertical">
              <Input
                value={form.targetVertical}
                onChange={(e) => setForm((f) => ({ ...f, targetVertical: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Product scope">
              <Input
                value={form.productScope}
                onChange={(e) => setForm((f) => ({ ...f, productScope: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Collection type">
              <Input
                value={form.collectionType}
                onChange={(e) => setForm((f) => ({ ...f, collectionType: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Hook pitch">
              <Input value={form.hookPitch} onChange={(e) => setForm((f) => ({ ...f, hookPitch: e.target.value }))} />
            </Form.Item>
            <Form.Item label="Visual theme">
              <Input
                value={form.visualTheme}
                onChange={(e) => setForm((f) => ({ ...f, visualTheme: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Completion bonus">
              <Input
                value={form.completionBonus}
                onChange={(e) => setForm((f) => ({ ...f, completionBonus: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Primary KPI">
              <Input value={form.primaryKpi} onChange={(e) => setForm((f) => ({ ...f, primaryKpi: e.target.value }))} />
            </Form.Item>
            <Form.Item label="Secondary KPI">
              <Input
                value={form.secondaryKpi}
                onChange={(e) => setForm((f) => ({ ...f, secondaryKpi: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Target audience">
              <Input
                value={form.targetAudience}
                onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Campaign context">
              <Input
                value={form.campaignContext}
                onChange={(e) => setForm((f) => ({ ...f, campaignContext: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Success metric">
              <Input
                value={form.successMetric}
                onChange={(e) => setForm((f) => ({ ...f, successMetric: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Sponsorship">
              <Input
                value={form.sponsorship}
                onChange={(e) => setForm((f) => ({ ...f, sponsorship: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Unlock condition">
              <Input
                value={form.unlockCondition}
                onChange={(e) => setForm((f) => ({ ...f, unlockCondition: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Schedule launch date">
              <Input
                type="datetime-local"
                value={form.scheduleLaunchDate}
                onChange={(e) => setForm((f) => ({ ...f, scheduleLaunchDate: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Time/stock limit">
              <Input
                value={form.timeStockLimit}
                onChange={(e) => setForm((f) => ({ ...f, timeStockLimit: e.target.value }))}
              />
            </Form.Item>
          </Space>

          <Space style={{ marginTop: 24 }}>
            <Button type="primary" onClick={handleSave} loading={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
            <Button onClick={() => setEditing(false)}>İptal</Button>
          </Space>
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
};

function CollectionBadgesTab({
  collectionId,
  collectionName,
  collectionCategoryId,
  onUpdated,
}: {
  collectionId: string;
  collectionName: string;
  collectionCategoryId: string;
  onUpdated: () => void;
}) {
  const [badges, setBadges] = useState<AdminCollectionBadgeListItem[]>([]);
  const [actionTypes, setActionTypes] = useState<AdminActionTypeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingActionTypes, setLoadingActionTypes] = useState(true);
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

  const handleAddBadge = async () => {
    setAddError(null);
    if (!addForm.name.trim()) {
      setAddError('Badge adı zorunludur.');
      return;
    }
    if (!addForm.actionTypeId) {
      setAddError('Aktivasyon tipi seçin.');
      return;
    }
    if (addForm.pointsRequired < 1) {
      setAddError('Hedef sayı en az 1 olmalıdır.');
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
        categoryId: collectionCategoryId,
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
      setAddForm({ ...INIT_ADD_FORM, actionTypeId: actionTypes[0]?.id ?? '' });
      antdMessage.success('Badge eklendi');
      loadBadges();
      onUpdated();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Badge eklenemedi');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (badgeId: string) => {
    Modal.confirm({
      title: 'Badge Çıkar',
      content: 'Bu badge koleksiyondan çıkarılacak. Emin misiniz?',
      okText: 'Evet, çıkar',
      cancelText: 'İptal',
      okButtonProps: { danger: true },
      onOk: async () => {
        setRemoving(badgeId);
        try {
          await removeCollectionBadge(collectionId, badgeId);
          antdMessage.success('Badge çıkarıldı');
          loadBadges();
          onUpdated();
        } catch (e) {
          antdMessage.error(e instanceof Error ? e.message : 'Çıkarılamadı');
        } finally {
          setRemoving(null);
        }
      },
    });
  };

  return (
    <div>
      <Card bordered title="Badge ekle" style={{ marginBottom: 24 }}>
        {addError && (
          <Alert message="Hata" description={addError} type="error" closable onClose={() => setAddError(null)} style={{ marginBottom: 16 }} />
        )}
        <Row gutter={16}>
          <Col xs={24} md={12} lg={6}>
            <Form.Item label="Ad">
              <Input
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Badge adı"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12} lg={6}>
            <Form.Item label="Açıklama">
              <Input
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="İsteğe bağlı"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12} lg={6}>
            <Form.Item label="Görsel URL">
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
        </Row>
        <Row gutter={16}>
          <Col xs={24} md={12} lg={8}>
            <Form.Item label="Aktivasyon tipi">
              <Select
                value={addForm.actionTypeId}
                onChange={(value) => setAddForm((f) => ({ ...f, actionTypeId: value }))}
                loading={loadingActionTypes}
                placeholder={loadingActionTypes ? 'Yükleniyor...' : 'Seçin'}
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
            <Form.Item label="Hedef sayı">
              <InputNumber
                min={1}
                value={addForm.pointsRequired}
                onChange={(value) => setAddForm((f) => ({ ...f, pointsRequired: Math.max(1, value || 1) }))}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12} lg={8}>
            <Form.Item label="Zorluk">
              <Select
                value={addForm.difficulty}
                onChange={(value) => setAddForm((f) => ({ ...f, difficulty: value }))}
              >
                <Select.Option value="EASY">Kolay</Select.Option>
                <Select.Option value="MEDIUM">Orta</Select.Option>
                <Select.Option value="HARD">Zor</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddBadge}
          loading={adding}
          disabled={loadingActionTypes || !addForm.actionTypeId}
        >
          {adding ? 'Ekleniyor...' : 'Badge ekle'}
        </Button>
      </Card>

      <Card bordered title={`Koleksiyon badge'leri (${collectionName})`}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : badges.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical">
                <Text>Bu koleksiyonda henüz badge yok.</Text>
                <Text type="secondary">Yukarıdaki form ile yeni badge ekleyebilirsiniz.</Text>
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
                      Düzenle
                    </Button>,
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      loading={removing === b.id}
                      onClick={() => handleRemove(b.id)}
                    >
                      Sil
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
                          {new Date(b.createdAt).toLocaleString('tr-TR')}
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
        setError(e instanceof Error ? e.message : 'Yüklenemedi');
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
      antdMessage.success('Badge güncellendi');
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Badge düzenle"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          İptal
        </Button>,
        <Button key="submit" type="primary" loading={saving} onClick={handleSubmit}>
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>,
      ]}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : !badge ? (
        <Alert message="Hata" description="Badge bulunamadı." type="error" />
      ) : (
        <>
          {error && (
            <Alert message="Hata" description={error} type="error" closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />
          )}
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Form.Item label="Ad">
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Form.Item>
            <Form.Item label="Açıklama">
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Görsel URL">
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
            <Form.Item label="Kategori">
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
