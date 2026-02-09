import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Form, Input, Select, InputNumber, Button, Alert, Spin, Space } from 'antd';
import {
  fetchBadgeCategories,
  createBadge,
  fetchCollection,
  fetchActionTypes,
  createCollectionGoal,
} from '../../api/admin-badges-collections';
import type { AdminBadgeCategoryListItem, AdminActionTypeListItem } from '../../types/admin';

export type CreateBadgeModalType = 'EVENT' | 'BRAND' | 'COSMETIC' | 'COLLECTION';

interface CreateBadgeModalProps {
  badgeType: CreateBadgeModalType;
  listPath: string;
  collectionId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  name: string;
  description?: string;
  imageUrl?: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC';
  categoryId: string;
  actionTypeId?: string;
  pointsRequired?: number;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
}

const isCollectionContext = (type: CreateBadgeModalType, cId?: string | null) =>
  type === 'COLLECTION' && cId;

function CreateBadgeModal({
  badgeType,
  listPath,
  collectionId,
  onClose,
  onSuccess,
}: CreateBadgeModalProps) {
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();
  const [categories, setCategories] = useState<AdminBadgeCategoryListItem[]>([]);
  const [actionTypes, setActionTypes] = useState<AdminActionTypeListItem[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [loadingActionTypes, setLoadingActionTypes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inCollection = isCollectionContext(badgeType, collectionId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchBadgeCategories();
        const data = res.data;
        if (!cancelled && data) {
          setCategories(data);
          if (data.length > 0 && !inCollection) {
            form.setFieldValue('categoryId', data[0].id);
          }
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Kategoriler yüklenemedi');
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inCollection, form]);

  useEffect(() => {
    if (!inCollection || !collectionId) return;
    let cancelled = false;
    setLoadingCollection(true);
    (async () => {
      try {
        const res = await fetchCollection(collectionId);
        const data = res.data;
        if (!cancelled && data?.categoryId) {
          form.setFieldValue('categoryId', data.categoryId);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Koleksiyon bilgisi alınamadı');
      } finally {
        if (!cancelled) setLoadingCollection(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collectionId, inCollection, form]);

  useEffect(() => {
    if (!inCollection) return;
    let cancelled = false;
    setLoadingActionTypes(true);
    (async () => {
      try {
        const res = await fetchActionTypes();
        const data = res.data;
        if (!cancelled && data?.length) {
          setActionTypes(data);
          form.setFieldValue('actionTypeId', data[0].id);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Aktivasyon tipleri yüklenemedi');
      } finally {
        if (!cancelled) setLoadingActionTypes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inCollection, form]);

  const handleSubmit = async (values: FormValues) => {
    setSaving(true);
    setError(null);
    try {
      const res = await createBadge({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        imageUrl: values.imageUrl?.trim() || null,
        type: badgeType,
        rarity: values.rarity,
        categoryId: values.categoryId,
        collectionId:
          badgeType === 'COLLECTION' && collectionId ? collectionId : null,
      });
      if (inCollection && collectionId && res.data?.id && values.actionTypeId) {
        await createCollectionGoal(collectionId, {
          actionTypeId: values.actionTypeId,
          rewardBadgeId: res.data.id,
          pointsRequired: values.pointsRequired ?? 1,
          title: values.name.trim(),
          difficulty: values.difficulty ?? 'MEDIUM',
        });
      }
      onSuccess();
      if (res.data?.id && badgeType !== 'COLLECTION') {
        navigate(`${listPath}/${res.data.id}`);
      } else if (badgeType === 'COLLECTION') {
        navigate(listPath);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Badge oluşturulamadı');
    } finally {
      setSaving(false);
    }
  };

  const loading =
    loadingCategories ||
    (inCollection && loadingCollection) ||
    (inCollection && loadingActionTypes);

  return (
    <Modal
      title={inCollection ? 'Badge ekle' : `Yeni badge (${badgeType})`}
      open
      onCancel={onClose}
      footer={null}
      width={600}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            rarity: 'COMMON',
            difficulty: 'MEDIUM',
            pointsRequired: 1,
          }}
        >
          {error && (
            <Alert
              message="Hata"
              description={error}
              type="error"
              closable
              onClose={() => setError(null)}
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            label="Ad"
            name="name"
            rules={[{ required: true, message: 'Ad zorunludur' }]}
          >
            <Input placeholder="Badge adı" />
          </Form.Item>

          <Form.Item label="Açıklama" name="description">
            <Input placeholder="İsteğe bağlı" />
          </Form.Item>

          <Form.Item label="Görsel URL" name="imageUrl">
            <Input type="url" placeholder="https://..." />
          </Form.Item>

          <Form.Item
            label="Rarity"
            name="rarity"
            rules={[{ required: true, message: 'Rarity seçin' }]}
          >
            <Select>
              <Select.Option value="COMMON">COMMON</Select.Option>
              <Select.Option value="RARE">RARE</Select.Option>
              <Select.Option value="EPIC">EPIC</Select.Option>
            </Select>
          </Form.Item>

          {!inCollection && (
            <Form.Item
              label="Kategori"
              name="categoryId"
              rules={[{ required: true, message: 'Kategori seçin' }]}
            >
              <Select placeholder="Seçin">
                {categories.map((c) => (
                  <Select.Option key={c.id} value={c.id}>
                    {c.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {inCollection && (
            <>
              <Form.Item
                label="Aktivasyon tipi"
                name="actionTypeId"
                rules={[{ required: true, message: 'Aktivasyon tipi seçin' }]}
              >
                <Select
                  placeholder={loadingActionTypes ? 'Yükleniyor…' : 'Seçin'}
                  disabled={loadingActionTypes}
                >
                  {actionTypes.map((a) => (
                    <Select.Option key={a.id} value={a.id}>
                      {a.label} ({a.mainAction} / {a.code})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="Hedef sayı"
                name="pointsRequired"
                rules={[
                  { required: true, message: 'Hedef sayı girin' },
                  { type: 'number', min: 1, message: 'En az 1 olmalıdır' },
                ]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                label="Zorluk"
                name="difficulty"
                rules={[{ required: true, message: 'Zorluk seçin' }]}
              >
                <Select>
                  <Select.Option value="EASY">Kolay</Select.Option>
                  <Select.Option value="MEDIUM">Orta</Select.Option>
                  <Select.Option value="HARD">Zor</Select.Option>
                </Select>
              </Form.Item>
            </>
          )}

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                {saving ? 'Oluşturuluyor…' : 'Badge ekle'}
              </Button>
              <Button onClick={onClose}>İptal</Button>
            </Space>
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}

export default CreateBadgeModal;
