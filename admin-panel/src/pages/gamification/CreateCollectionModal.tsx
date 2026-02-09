import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  createCollection,
  fetchCollectionCategories,
  uploadMedia,
} from '../../api/admin-badges-collections';
import type { AdminCollectionCategoryOption } from '../../api/admin-badges-collections';
import './gamification.css';

const STEPS = [
  { id: 1, title: 'Temel bilgiler', icon: 'fa-info-circle' },
  { id: 2, title: 'Amaç ve kapsam', icon: 'fa-bullseye' },
  { id: 3, title: 'Metrikler ve hedefler', icon: 'fa-chart-line' },
  { id: 4, title: 'Ek bilgiler', icon: 'fa-cog' },
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
  onClose: () => void;
  onSuccess: () => void;
}

function CreateCollectionModal({ onClose, onSuccess }: CreateCollectionModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<AdminCollectionCategoryOption[]>([]);
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

  const handleBannerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    setError(null);
    try {
      const res = await uploadMedia(file);
      if (res.data?.url) {
        setForm((f) => ({ ...f, bannerUrl: res.data!.url }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Banner yüklenemedi');
    } finally {
      setUploadingBanner(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const canNext = step === 1 ? form.name.trim() && form.categoryId : true;
  const isLastStep = step === STEPS.length;

  return (
    <div className="gamification-modal-overlay" onClick={onClose}>
      <div
        className="gamification-modal gamification-modal--wizard"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gamification-modal-header">
          <h2>Yeni koleksiyon</h2>
          <button
            type="button"
            className="gamification-modal-close"
            onClick={onClose}
            aria-label="Kapat"
          >
            <i className="fa-solid fa-times" aria-hidden />
          </button>
        </div>

        <div className="gamification-wizard-steps">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`gamification-wizard-step ${step === s.id ? 'gamification-wizard-step--active' : ''}`}
              onClick={() => setStep(s.id)}
              aria-current={step === s.id ? 'step' : undefined}
            >
              <span className="gamification-wizard-step-icon">
                <i className={`fa-solid ${s.icon}`} aria-hidden />
              </span>
              <span className="gamification-wizard-step-title">{s.title}</span>
            </button>
          ))}
        </div>

        {loadingCategories && step === 1 ? (
          <div className="gamification-modal-form gamification-modal-form--center">
            <LoadingSpinner />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="gamification-modal-form">
            {error && (
              <div className="gamification-error gamification-wizard-error" role="alert">
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="gamification-wizard-pane">
                <label className="gamification-form-label">
                  Koleksiyon adı <span className="gamification-form-required">*</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    required
                    className="gamification-form-input"
                    placeholder="Örn. Yaz Sezonu Rozetleri"
                  />
                </label>
                <label className="gamification-form-label">
                  Kategori <span className="gamification-form-required">*</span>
                  <select
                    value={form.categoryId}
                    onChange={(e) => update('categoryId', e.target.value)}
                    required
                    className="gamification-form-input gamification-form-select"
                  >
                    <option value="">Kategori seçin</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="gamification-form-label">
                  Sahip / Owner
                  <input
                    type="text"
                    value={form.owner}
                    onChange={(e) => update('owner', e.target.value)}
                    className="gamification-form-input"
                    placeholder="Opsiyonel"
                  />
                </label>
                <div className="gamification-form-label">
                  <span>Banner görseli</span>
                  <div className="gamification-banner-upload">
                    {form.bannerUrl ? (
                      <div className="gamification-banner-preview">
                        <img src={form.bannerUrl} alt="Banner önizleme" />
                        <div className="gamification-banner-actions">
                          <label className="gamification-banner-replace">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/gif,image/webp"
                              onChange={handleBannerFile}
                              disabled={uploadingBanner}
                            />
                            {uploadingBanner ? 'Yükleniyor…' : 'Değiştir'}
                          </label>
                          <button
                            type="button"
                            className="gamification-banner-remove"
                            onClick={() => update('bannerUrl', '')}
                          >
                            Kaldır
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="gamification-banner-dropzone">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          onChange={handleBannerFile}
                          disabled={uploadingBanner}
                        />
                        <span className="gamification-banner-dropzone-text">
                          {uploadingBanner ? (
                            'Yükleniyor…'
                          ) : (
                            <>
                              <i className="fa-solid fa-cloud-arrow-up" aria-hidden />
                              Görsel yükle (JPG, PNG, WebP)
                            </>
                          )}
                        </span>
                      </label>
                    )}
                    <input
                      type="url"
                      value={form.bannerUrl}
                      onChange={(e) => update('bannerUrl', e.target.value)}
                      className="gamification-form-input gamification-banner-url-fallback"
                      placeholder="veya banner URL girin"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="gamification-wizard-pane">
                <label className="gamification-form-label">
                  Koleksiyon amacı
                  <textarea
                    value={form.collectionObjective}
                    onChange={(e) => update('collectionObjective', e.target.value)}
                    className="gamification-form-input gamification-form-textarea"
                    rows={2}
                    placeholder="Bu koleksiyonun amacı"
                  />
                </label>
                <label className="gamification-form-label">
                  Hedef dikey / Vertical
                  <input
                    type="text"
                    value={form.targetVertical}
                    onChange={(e) => update('targetVertical', e.target.value)}
                    className="gamification-form-input"
                    placeholder="Örn. E-ticaret, Oyun"
                  />
                </label>
                <label className="gamification-form-label">
                  Ürün kapsamı
                  <input
                    type="text"
                    value={form.productScope}
                    onChange={(e) => update('productScope', e.target.value)}
                    className="gamification-form-input"
                    placeholder="Hangi ürünler dahil"
                  />
                </label>
                <label className="gamification-form-label">
                  Koleksiyon tipi
                  <input
                    type="text"
                    value={form.collectionType}
                    onChange={(e) => update('collectionType', e.target.value)}
                    className="gamification-form-input"
                    placeholder="Örn. Sezonluk, Özel etkinlik"
                  />
                </label>
                <label className="gamification-form-label">
                  Hook / Pitch
                  <textarea
                    value={form.hookPitch}
                    onChange={(e) => update('hookPitch', e.target.value)}
                    className="gamification-form-input gamification-form-textarea"
                    rows={2}
                    placeholder="Kullanıcıyı çeken kısa açıklama"
                  />
                </label>
              </div>
            )}

            {step === 3 && (
              <div className="gamification-wizard-pane">
                <label className="gamification-form-label">
                  Görsel tema
                  <input
                    type="text"
                    value={form.visualTheme}
                    onChange={(e) => update('visualTheme', e.target.value)}
                    className="gamification-form-input"
                    placeholder="Örn. Yaz, Kış"
                  />
                </label>
                <label className="gamification-form-label">
                  Tamamlama bonusu
                  <input
                    type="text"
                    value={form.completionBonus}
                    onChange={(e) => update('completionBonus', e.target.value)}
                    className="gamification-form-input"
                    placeholder="Koleksiyonu tamamlayanlara ne verilir"
                  />
                </label>
                <label className="gamification-form-label">
                  Birincil KPI
                  <input
                    type="text"
                    value={form.primaryKpi}
                    onChange={(e) => update('primaryKpi', e.target.value)}
                    className="gamification-form-input"
                    placeholder="Ana başarı göstergesi"
                  />
                </label>
                <label className="gamification-form-label">
                  İkincil KPI
                  <input
                    type="text"
                    value={form.secondaryKpi}
                    onChange={(e) => update('secondaryKpi', e.target.value)}
                    className="gamification-form-input"
                    placeholder="İkincil metrik"
                  />
                </label>
                <label className="gamification-form-label">
                  Hedef kitle
                  <textarea
                    value={form.targetAudience}
                    onChange={(e) => update('targetAudience', e.target.value)}
                    className="gamification-form-input gamification-form-textarea"
                    rows={2}
                    placeholder="Kime yönelik"
                  />
                </label>
                <label className="gamification-form-label">
                  Kampanya bağlamı
                  <input
                    type="text"
                    value={form.campaignContext}
                    onChange={(e) => update('campaignContext', e.target.value)}
                    className="gamification-form-input"
                    placeholder="Hangi kampanya ile ilişkili"
                  />
                </label>
                <label className="gamification-form-label">
                  Başarı metriği
                  <input
                    type="text"
                    value={form.successMetric}
                    onChange={(e) => update('successMetric', e.target.value)}
                    className="gamification-form-input"
                    placeholder="Nasıl ölçülecek"
                  />
                </label>
              </div>
            )}

            {step === 4 && (
              <div className="gamification-wizard-pane">
                <label className="gamification-form-label">
                  Sponsorluk
                  <input
                    type="text"
                    value={form.sponsorship}
                    onChange={(e) => update('sponsorship', e.target.value)}
                    className="gamification-form-input"
                    placeholder="Varsa sponsor bilgisi"
                  />
                </label>
                <label className="gamification-form-label">
                  Açılma koşulu
                  <textarea
                    value={form.unlockCondition}
                    onChange={(e) => update('unlockCondition', e.target.value)}
                    className="gamification-form-input gamification-form-textarea"
                    rows={2}
                    placeholder="Koleksiyon ne zaman açılır"
                  />
                </label>
                <label className="gamification-form-label">
                  Planlanan lansman tarihi
                  <input
                    type="datetime-local"
                    value={form.scheduleLaunchDate}
                    onChange={(e) => update('scheduleLaunchDate', e.target.value)}
                    className="gamification-form-input"
                  />
                </label>
                <label className="gamification-form-label">
                  Zaman / stok limiti
                  <input
                    type="text"
                    value={form.timeStockLimit}
                    onChange={(e) => update('timeStockLimit', e.target.value)}
                    className="gamification-form-input"
                    placeholder="Örn. 30 gün, 100 adet"
                  />
                </label>
              </div>
            )}

            <div className="gamification-modal-actions gamification-wizard-actions">
              {step > 1 ? (
                <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>
                  Geri
                </Button>
              ) : (
                <Button type="button" variant="secondary" onClick={onClose}>
                  İptal
                </Button>
              )}
              <div className="gamification-wizard-actions-next">
                {isLastStep ? (
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Oluşturuluyor…' : 'Koleksiyonu oluştur'}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!canNext}
                    onClick={() => setStep(step + 1)}
                  >
                    İleri
                  </Button>
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default CreateCollectionModal;
