import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Tabs,
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Input,
  Select,
  InputNumber,
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
  updateBadge,
  deleteBadge,
  fetchBadgeOwners,
} from '../../api/admin-badges-collections';
import type { AdminBadgeDetailResponse, AdminBadgeOwnerListItem } from '../../types/admin';

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
      else setError('Badge bulunamadı');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
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
          <Button icon={<ArrowLeftOutlined />}>Listeye dön</Button>
        </Link>
        <Text>Geçersiz badge ID</Text>
      </div>
    );
  }

  if (loading || !badge) {
    return (
      <div>
        <Link to={listPath}>
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

  const backPath = getListPathFromPathname(location.pathname, badge.type);

  const tabItems = [
    {
      key: 'summary',
      label: 'Özet',
      children: <BadgeSummaryTab badge={badge} onUpdated={loadBadge} onDeleted={() => navigate(backPath)} />,
    },
    {
      key: 'owners',
      label: 'Sahipler',
      children: <BadgeOwnersTab badgeId={badgeIdToFetch!} />,
    },
  ];

  return (
    <div>
      <Link to={backPath}>
        <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>
          Listeye dön
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
              <Tag color="blue">{badge.type}</Tag>
              <Tag color="gold">{badge.rarity}</Tag>
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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: badge.name,
    description: badge.description ?? '',
    imageUrl: badge.imageUrl ?? '',
    type: badge.type,
    rarity: badge.rarity,
    boostMultiplier: badge.boostMultiplier ?? null,
    rewardMultiplier: badge.rewardMultiplier ?? null,
    categoryId: badge.categoryId,
    collectionId: badge.collectionId ?? '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateBadge(badge.id, {
        name: form.name,
        description: form.description || null,
        imageUrl: form.imageUrl || null,
        type: form.type,
        rarity: form.rarity,
        boostMultiplier: form.boostMultiplier,
        rewardMultiplier: form.rewardMultiplier,
        categoryId: form.categoryId,
        collectionId: form.collectionId || null,
      });
      setEditing(false);
      antdMessage.success('Badge güncellendi');
      onUpdated();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: 'Badge Sil',
      content: 'Bu badge silinecek. Emin misiniz?',
      okText: 'Evet, sil',
      cancelText: 'İptal',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteBadge(badge.id);
          antdMessage.success('Badge silindi');
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
                <Tag color="blue">{badge.type}</Tag>
                <Tag color="gold">{badge.rarity}</Tag>
                {badge.categoryName && <Tag>{badge.categoryName}</Tag>}
                {badge.collectionId && (
                  <Link to={`/gamification/collections/${badge.collectionId}`}>
                    <Tag icon={<LinkOutlined />} color="cyan">
                      {badge.collectionName ?? 'Koleksiyon'}
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
                    <Text strong>Ödül:</Text>
                    <Text>{badge.rewardMultiplier}×</Text>
                  </Space>
                )}
              </Space>
            )}

            {badge.description && <Paragraph>{badge.description}</Paragraph>}

            {badge.createdAt && (
              <Space>
                <CalendarOutlined />
                <Text type="secondary">{new Date(badge.createdAt).toLocaleString('tr-TR')}</Text>
              </Space>
            )}
          </Space>

          <Space style={{ marginTop: 24 }}>
            <Button type="primary" onClick={() => setEditing(true)}>
              Düzenle
            </Button>
            <Button danger onClick={handleDelete}>
              Sil
            </Button>
          </Space>
        </>
      ) : (
        <>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Text strong>Ad</Text>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Text strong>Açıklama</Text>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Text strong>Görsel URL</Text>
              <Input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} />
            </div>
            <div>
              <Text strong>Tip</Text>
              <Select
                value={form.type}
                onChange={(value) => setForm((f) => ({ ...f, type: value }))}
                style={{ width: '100%' }}
              >
                <Select.Option value="COLLECTION">COLLECTION</Select.Option>
                <Select.Option value="EVENT">EVENT</Select.Option>
                <Select.Option value="COSMETIC">COSMETIC</Select.Option>
                <Select.Option value="BRAND">BRAND</Select.Option>
              </Select>
            </div>
            <div>
              <Text strong>Rarity</Text>
              <Select
                value={form.rarity}
                onChange={(value) => setForm((f) => ({ ...f, rarity: value }))}
                style={{ width: '100%' }}
              >
                <Select.Option value="COMMON">COMMON</Select.Option>
                <Select.Option value="RARE">RARE</Select.Option>
                <Select.Option value="EPIC">EPIC</Select.Option>
              </Select>
            </div>
            <div>
              <Text strong>Boost çarpanı</Text>
              <InputNumber
                value={form.boostMultiplier}
                onChange={(value) => setForm((f) => ({ ...f, boostMultiplier: value }))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <Text strong>Ödül çarpanı</Text>
              <InputNumber
                value={form.rewardMultiplier}
                onChange={(value) => setForm((f) => ({ ...f, rewardMultiplier: value }))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <Text strong>Kategori ID</Text>
              <Input value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} />
            </div>
            <div>
              <Text strong>Koleksiyon ID</Text>
              <Input
                value={form.collectionId}
                onChange={(e) => setForm((f) => ({ ...f, collectionId: e.target.value }))}
                placeholder="Boş bırakılabilir"
              />
            </div>
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
      title: 'Kullanıcı',
      key: 'user',
      render: (_, record) => (
        <Link to={`/users/${record.userId}`}>
          <Button type="link" size="small" style={{ padding: 0 }}>
            {record.userDisplayName ?? record.userId}
          </Button>
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
      render: (claimed) => (claimed ? 'Evet' : 'Hayır'),
    },
    {
      title: 'Claimed at',
      dataIndex: 'claimedAt',
      key: 'claimedAt',
      render: (date) => (date ? new Date(date).toLocaleString('tr-TR') : '—'),
    },
    {
      title: 'Oluşturulma',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => (date ? new Date(date).toLocaleString('tr-TR') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Link to={`/users/${record.userId}`}>
          <Button type="link" size="small">
            Kullanıcı
          </Button>
        </Link>
      ),
    },
  ];

  const handleTableChange = (pag: TablePaginationConfig) => {
    const newOffset = ((pag.current ?? 1) - 1) * OWNERS_PAGE_SIZE;
    setPagination((prev) => ({ ...prev, offset: newOffset }));
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <Card bordered title="Bu badge'e sahip kullanıcılar">
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
          showTotal: (total) => `Toplam ${total} sahip`,
        }}
        onChange={handleTableChange}
        locale={{
          emptyText: (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Henüz bu badge'e sahip kullanıcı yok" />
          ),
        }}
      />
    </Card>
  );
}

export default BadgeDetail;
