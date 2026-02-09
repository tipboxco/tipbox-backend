import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Modal,
  Steps,
  Form,
  Input,
  Select,
  Upload,
  Button,
  Alert,
  Spin,
  Space,
  message as antdMessage,
} from 'antd';
import {
  InfoCircleOutlined,
  AimOutlined,
  LineChartOutlined,
  SettingOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import {
  createCollection,
  fetchCollectionCategories,
  uploadMedia,
} from '../../api/admin-badges-collections';
import type { AdminCollectionCategoryMain } from '../../api/admin-badges-collections';

const { TextArea } = Input;

const STEPS = [
  { id: 1, title: 'Temel bilgiler', icon: <InfoCircleOutlined /> },
  { id: 2, title: 'Amaç ve kapsam', icon: <AimOutlined /> },
  { id: 3, title: 'Metrikler ve hedefler', icon: <LineChartOutlined /> },
  { id: 4, title: 'Ek bilgiler', icon: <SettingOutlined /> },
] as const;

const INITIAL_FORM = {
  name: '',
  categoryId: '',
  owner: '',
  bannerUrl: '',
  collectionObjective: '',
  targetVertical: '',
  productScope: '',
  collectionType: '',
  hookPitch: '',
  visualTheme: '',
  completionBonus: '',
  primaryKpi: '',
  secondaryKpi: '',
  targetAudience: '',
  campaignContext: '',
  successMetric: '',
  sponsorship: '',
  unlockCondition: '',
  scheduleLaunchDate: '',
  timeStockLimit: '',
};

interface CreateCollectionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateCollectionModal({ open, onClose, onSuccess }: CreateCollectionModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<AdminCollectionCategoryMain[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchCollectionCategories();
        if (!cancelled && res.data?.length) {
          setCategories(res.data);
          if (!form.categoryId) {
            setForm((f) => ({ ...f, categoryId: res.data![0].id }));
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kategoriler yüklenemedi');
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }, []);

  const handleBannerUpload = async (file: File) => {
    setUploadingBanner(true);
    setError(null);
    try {
      const res = await uploadMedia(file);
      if (res.data?.url) {
        setForm((f) => ({ ...f, bannerUrl: res.data!.url }));
        antdMessage.success('Banner yüklendi');
      }
    } catch (err) {
      antdMessage.error(err instanceof Error ? err.message : 'Banner yüklenemedi');
    } finally {
      setUploadingBanner(false);
    }
    return false; // Prevent default upload
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.categoryId.trim()) {
      setError('Ad ve kategori zorunludur.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await createCollection({
        name: form.name.trim(),
        categoryId: form.categoryId.trim(),
        bannerUrl: form.bannerUrl.trim() || null,
        owner: form.owner.trim() || null,
        collectionObjective: form.collectionObjective.trim() || null,
        targetVertical: form.targetVertical.trim() || null,
        productScope: form.productScope.trim() || null,
        collectionType: form.collectionType.trim() || null,
        hookPitch: form.hookPitch.trim() || null,
        visualTheme: form.visualTheme.trim() || null,
        completionBonus: form.completionBonus.trim() || null,
        primaryKpi: form.primaryKpi.trim() || null,
        secondaryKpi: form.secondaryKpi.trim() || null,
        targetAudience: form.targetAudience.trim() || null,
        campaignContext: form.campaignContext.trim() || null,
        successMetric: form.successMetric.trim() || null,
        sponsorship: form.sponsorship.trim() || null,
        unlockCondition: form.unlockCondition.trim() || null,
        scheduleLaunchDate: form.scheduleLaunchDate.trim() || null,
        timeStockLimit: form.timeStockLimit.trim() || null,
      });
      antdMessage.success('Koleksiyon oluşturuldu');
      onSuccess();
      if (res.data?.id) {
        navigate(`/gamification/collections/${res.data.id}`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Koleksiyon oluşturulamadı');
    } finally {
      setSaving(false);
    }
  };

  const canNext = step === 0 ? form.name.trim() && form.categoryId : true;
  const isLastStep = step === STEPS.length - 1;

  return (
    <Modal
      title="Yeni koleksiyon"
      open={open}
      onCancel={onClose}
      width={800}
      footer={null}
    >
      <Steps current={step} items={STEPS.map((s) => ({ title: s.title, icon: s.icon }))} style={{ marginBottom: 32 }} />

      {error && (
        <Alert message="Hata" description={error} type="error" closable onClose={() => setError(null)} style={{ marginBottom: 24 }} />
      )}

      {loadingCategories && step === 0 ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        <div>
          {/* Step 1: Basic Info */}
          {step === 0 && (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Form.Item label="Koleksiyon adı" required>
                <Input
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Örn. Yaz Sezonu Rozetleri"
                  size="large"
                />
              </Form.Item>

              <Form.Item label="Kategori" required>
                <Select
                  value={form.categoryId}
                  onChange={(value) => update('categoryId', value)}
                  placeholder="Kategori seçin"
                  size="large"
                >
                  {categories.map((c) => (
                    <Select.Option key={c.id} value={c.id}>
                      {c.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="Sahip / Owner">
                <Input
                  value={form.owner}
                  onChange={(e) => update('owner', e.target.value)}
                  placeholder="Opsiyonel"
                  size="large"
                />
              </Form.Item>

              <Form.Item label="Banner görseli">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Upload
                    beforeUpload={handleBannerUpload}
                    showUploadList={false}
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    disabled={uploadingBanner}
                  >
                    <Button icon={<CloudUploadOutlined />} loading={uploadingBanner}>
                      {uploadingBanner ? 'Yükleniyor...' : 'Görsel yükle (JPG, PNG, WebP)'}
                    </Button>
                  </Upload>
                  {form.bannerUrl && (
                    <div>
                      <img src={form.bannerUrl} alt="Banner" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4 }} />
                      <Button size="small" danger onClick={() => update('bannerUrl', '')} style={{ marginTop: 8 }}>
                        Kaldır
                      </Button>
                    </div>
                  )}
                  <Input
                    value={form.bannerUrl}
                    onChange={(e) => update('bannerUrl', e.target.value)}
                    placeholder="veya banner URL"
                  />
                </Space>
              </Form.Item>
            </Space>
          )}

          {/* Step 2: Purpose */}
          {step === 1 && (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Form.Item label="Koleksiyon amacı">
                <TextArea
                  value={form.collectionObjective}
                  onChange={(e) => update('collectionObjective', e.target.value)}
                  rows={3}
                  placeholder="Bu koleksiyonun amacı"
                />
              </Form.Item>

              <Form.Item label="Hedef dikey">
                <Input
                  value={form.targetVertical}
                  onChange={(e) => update('targetVertical', e.target.value)}
                  placeholder="Örn. E-ticaret, Oyun"
                />
              </Form.Item>

              <Form.Item label="Ürün kapsamı">
                <Input
                  value={form.productScope}
                  onChange={(e) => update('productScope', e.target.value)}
                  placeholder="Hangi ürünler dahil"
                />
              </Form.Item>

              <Form.Item label="Koleksiyon tipi">
                <Input
                  value={form.collectionType}
                  onChange={(e) => update('collectionType', e.target.value)}
                  placeholder="Örn. Sezonluk"
                />
              </Form.Item>

              <Form.Item label="Hook / Pitch">
                <TextArea
                  value={form.hookPitch}
                  onChange={(e) => update('hookPitch', e.target.value)}
                  rows={3}
                  placeholder="Kullanıcıyı çeken kısa açıklama"
                />
              </Form.Item>
            </Space>
          )}

          {/* Step 3: Metrics */}
          {step === 2 && (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Form.Item label="Görsel tema">
                <Input
                  value={form.visualTheme}
                  onChange={(e) => update('visualTheme', e.target.value)}
                  placeholder="Örn. Yaz, Kış"
                />
              </Form.Item>

              <Form.Item label="Tamamlama bonusu">
                <Input
                  value={form.completionBonus}
                  onChange={(e) => update('completionBonus', e.target.value)}
                  placeholder="Koleksiyonu tamamlayanlara ne verilir"
                />
              </Form.Item>

              <Form.Item label="Birincil KPI">
                <Input
                  value={form.primaryKpi}
                  onChange={(e) => update('primaryKpi', e.target.value)}
                  placeholder="Ana başarı göstergesi"
                />
              </Form.Item>

              <Form.Item label="İkincil KPI">
                <Input
                  value={form.secondaryKpi}
                  onChange={(e) => update('secondaryKpi', e.target.value)}
                  placeholder="İkincil metrik"
                />
              </Form.Item>

              <Form.Item label="Hedef kitle">
                <TextArea
                  value={form.targetAudience}
                  onChange={(e) => update('targetAudience', e.target.value)}
                  rows={3}
                  placeholder="Kime yönelik"
                />
              </Form.Item>

              <Form.Item label="Kampanya bağlamı">
                <Input
                  value={form.campaignContext}
                  onChange={(e) => update('campaignContext', e.target.value)}
                  placeholder="Hangi kampanya ile ilişkili"
                />
              </Form.Item>

              <Form.Item label="Başarı metriği">
                <Input
                  value={form.successMetric}
                  onChange={(e) => update('successMetric', e.target.value)}
                  placeholder="Nasıl ölçülecek"
                />
              </Form.Item>
            </Space>
          )}

          {/* Step 4: Additional */}
          {step === 3 && (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Form.Item label="Sponsorluk">
                <Input
                  value={form.sponsorship}
                  onChange={(e) => update('sponsorship', e.target.value)}
                  placeholder="Varsa sponsor bilgisi"
                />
              </Form.Item>

              <Form.Item label="Zaman / stok limiti">
                <Input
                  value={form.timeStockLimit}
                  onChange={(e) => update('timeStockLimit', e.target.value)}
                  placeholder="Örn. 30 gün, 100 adet"
                />
              </Form.Item>

              <Form.Item label="Açılma koşulu">
                <TextArea
                  value={form.unlockCondition}
                  onChange={(e) => update('unlockCondition', e.target.value)}
                  rows={3}
                  placeholder="Koleksiyon ne zaman açılır"
                />
              </Form.Item>

              <Form.Item label="Planlanan lansman">
                <Input
                  type="datetime-local"
                  value={form.scheduleLaunchDate}
                  onChange={(e) => update('scheduleLaunchDate', e.target.value)}
                />
              </Form.Item>
            </Space>
          )}

          {/* Navigation */}
          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
            {step > 0 ? (
              <Button onClick={() => setStep(step - 1)}>Geri</Button>
            ) : (
              <Button onClick={onClose}>İptal</Button>
            )}

            <div>
              {isLastStep ? (
                <Button type="primary" loading={saving} onClick={handleSubmit}>
                  {saving ? 'Oluşturuluyor...' : 'Koleksiyonu oluştur'}
                </Button>
              ) : (
                <Button type="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
                  İleri
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default CreateCollectionModal;
