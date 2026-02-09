import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  createCollection,
  fetchCollectionCategories,
  uploadMedia,
} from '../../api/admin-badges-collections';
import type { AdminCollectionCategoryMain } from '../../api/admin-badges-collections';
import './gamification.css';

const STEPS = [
  { id: 1, title: 'Temel bilgiler', icon: 'fa-info-circle' },
  { id: 2, title: 'Amaç ve kapsam', icon: 'fa-bullseye' },
  { id: 3, title: 'Metrikler ve hedefler', icon: 'fa-chart-line' },
  { id: 4, title: 'Ek bilgiler', icon: 'fa-cog' },
] as const;

const INITIAL_FORM = {
  name: '',
  mainCategoryId: '',
  subCategoryId: '',
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

function CreateCollectionPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [mainCategories, setMainCategories] = useState<AdminCollectionCategoryMain[]>([]);
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
          setMainCategories(res.data);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kategoriler yüklenemedi');
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedMain = mainCategories.find((m) => m.id === form.mainCategoryId);
  const subOptions = selectedMain?.children ?? [];
  const effectiveCategoryId = form.subCategoryId || form.mainCategoryId;

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
      if (res.data?.url) setForm((f) => ({ ...f, bannerUrl: res.data!.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Banner yüklenemedi');
    } finally {
      setUploadingBanner(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const categoryId = form.subCategoryId || form.mainCategoryId;
    if (!form.name.trim() || !form.mainCategoryId.trim()) {
      setError('Ad ve ana kategori zorunludur.');
      return;
    }
    if (subOptions.length > 0 && !form.subCategoryId.trim()) {
      setError('Bu ana kategori için alt kategori seçin.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await createCollection({
        name: form.name.trim(),
        categoryId: categoryId.trim(),
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
      if (res.data?.id) navigate(`/gamification/collections/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Koleksiyon oluşturulamadı');
    } finally {
      setSaving(false);
    }
  };

  const canNext =
    step === 1
      ? form.name.trim() &&
        form.mainCategoryId &&
        (subOptions.length === 0 ? true : !!form.subCategoryId)
      : true;
  const isLastStep = step === STEPS.length;

  return (
    <div className="create-collection-page gamification-page">
      <Link to="/gamification/collections" className="gamification-detail-back">
        <i className="fa-solid fa-arrow-left" aria-hidden /> Listeye dön
      </Link>
      <PageHeader
        title="Yeni koleksiyon"
        description="Koleksiyon bilgilerini adım adım doldurun."
        icon="fa-folder-plus"
      />

      <DataCard
        title="Koleksiyon formu"
        variant="compact"
        className="create-collection-card"
      >
        <div className="gamification-wizard-steps create-collection-steps">
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
          <div className="create-collection-body create-collection-body--center">
            <LoadingSpinner />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="create-collection-form">
            {error && (
              <div className="gamification-error create-collection-error" role="alert">
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="gamification-wizard-pane create-collection-pane">
                <div className="create-collection-row">
                  <label className="gamification-form-label create-collection-label create-collection-field--full">
                    <span className="gamification-form-label-row">Koleksiyon adı <span className="gamification-form-required" aria-hidden>*</span></span>
                    <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} required className="gamification-form-input" placeholder="Örn. Yaz Sezonu Rozetleri" />
                  </label>
                </div>
                <div className="create-collection-row">
                  <div className="gamification-form-label create-collection-label create-collection-field">
                    <span className="gamification-form-label-row">Ana kategori <span className="gamification-form-required" aria-hidden>*</span></span>
                    <select value={form.mainCategoryId} onChange={(e) => { update('mainCategoryId', e.target.value); update('subCategoryId', ''); }} required className="gamification-form-input gamification-form-select" aria-label="Ana kategori seçin">
                      <option value="">Ana kategori seçin</option>
                      {mainCategories.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  {subOptions.length > 0 && (
                    <div className="gamification-form-label create-collection-label create-collection-field">
                      <span className="gamification-form-label-row">Alt kategori <span className="gamification-form-required" aria-hidden>*</span></span>
                      <select value={form.subCategoryId} onChange={(e) => update('subCategoryId', e.target.value)} required className="gamification-form-input gamification-form-select" aria-label="Alt kategori seçin">
                        <option value="">Alt kategori seçin</option>
                        {subOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div className="create-collection-row">
                  <label className="gamification-form-label create-collection-label create-collection-field">
                    <span className="gamification-form-label-row">Sahip / Owner</span>
                    <input type="text" value={form.owner} onChange={(e) => update('owner', e.target.value)} className="gamification-form-input" placeholder="Opsiyonel" />
                  </label>
                </div>
                <div className="create-collection-row create-collection-row--full">
                  <div className="gamification-form-label create-collection-label create-collection-field--full">
                    <span className="gamification-form-label-row">Banner görseli</span>
                    <div className="gamification-banner-upload">
                      {form.bannerUrl ? (
                        <div className="gamification-banner-preview">
                          <img src={form.bannerUrl} alt="Banner önizleme" />
                          <div className="gamification-banner-actions">
                            <label className="gamification-banner-replace">
                              <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleBannerFile} disabled={uploadingBanner} />
                              {uploadingBanner ? 'Yükleniyor…' : 'Değiştir'}
                            </label>
                            <button type="button" className="gamification-banner-remove" onClick={() => update('bannerUrl', '')}>Kaldır</button>
                          </div>
                        </div>
                      ) : (
                        <label className="gamification-banner-dropzone">
                          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleBannerFile} disabled={uploadingBanner} />
                          <span className="gamification-banner-dropzone-text">
                            {uploadingBanner ? 'Yükleniyor…' : <><i className="fa-solid fa-cloud-arrow-up" aria-hidden /> Görsel yükle (JPG, PNG, WebP)</>}
                          </span>
                        </label>
                      )}
                      <input type="url" value={form.bannerUrl} onChange={(e) => update('bannerUrl', e.target.value)} className="gamification-form-input gamification-banner-url-fallback" placeholder="veya banner URL" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="gamification-wizard-pane create-collection-pane">
                <div className="create-collection-row create-collection-row--full">
                  <label className="gamification-form-label create-collection-label create-collection-field--full">
                    <span className="gamification-form-label-row">Koleksiyon amacı</span>
                    <textarea value={form.collectionObjective} onChange={(e) => update('collectionObjective', e.target.value)} className="gamification-form-input gamification-form-textarea" rows={2} placeholder="Bu koleksiyonun amacı" />
                  </label>
                </div>
                <div className="create-collection-row">
                  <label className="gamification-form-label create-collection-label create-collection-field"><span className="gamification-form-label-row">Hedef dikey</span><input type="text" value={form.targetVertical} onChange={(e) => update('targetVertical', e.target.value)} className="gamification-form-input" placeholder="Örn. E-ticaret, Oyun" /></label>
                  <label className="gamification-form-label create-collection-label create-collection-field"><span className="gamification-form-label-row">Ürün kapsamı</span><input type="text" value={form.productScope} onChange={(e) => update('productScope', e.target.value)} className="gamification-form-input" placeholder="Hangi ürünler dahil" /></label>
                </div>
                <div className="create-collection-row">
                  <label className="gamification-form-label create-collection-label create-collection-field"><span className="gamification-form-label-row">Koleksiyon tipi</span><input type="text" value={form.collectionType} onChange={(e) => update('collectionType', e.target.value)} className="gamification-form-input" placeholder="Örn. Sezonluk" /></label>
                </div>
                <div className="create-collection-row create-collection-row--full">
                  <label className="gamification-form-label create-collection-label create-collection-field--full"><span className="gamification-form-label-row">Hook / Pitch</span><textarea value={form.hookPitch} onChange={(e) => update('hookPitch', e.target.value)} className="gamification-form-input gamification-form-textarea" rows={2} placeholder="Kullanıcıyı çeken kısa açıklama" /></label>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="gamification-wizard-pane create-collection-pane">
                <div className="create-collection-row">
                  <label className="gamification-form-label create-collection-label create-collection-field"><span className="gamification-form-label-row">Görsel tema</span><input type="text" value={form.visualTheme} onChange={(e) => update('visualTheme', e.target.value)} className="gamification-form-input" placeholder="Örn. Yaz, Kış" /></label>
                  <label className="gamification-form-label create-collection-label create-collection-field"><span className="gamification-form-label-row">Tamamlama bonusu</span><input type="text" value={form.completionBonus} onChange={(e) => update('completionBonus', e.target.value)} className="gamification-form-input" placeholder="Koleksiyonu tamamlayanlara ne verilir" /></label>
                </div>
                <div className="create-collection-row">
                  <label className="gamification-form-label create-collection-label create-collection-field"><span className="gamification-form-label-row">Birincil KPI</span><input type="text" value={form.primaryKpi} onChange={(e) => update('primaryKpi', e.target.value)} className="gamification-form-input" placeholder="Ana başarı göstergesi" /></label>
                  <label className="gamification-form-label create-collection-label create-collection-field"><span className="gamification-form-label-row">İkincil KPI</span><input type="text" value={form.secondaryKpi} onChange={(e) => update('secondaryKpi', e.target.value)} className="gamification-form-input" placeholder="İkincil metrik" /></label>
                </div>
                <div className="create-collection-row create-collection-row--full">
                  <label className="gamification-form-label create-collection-label create-collection-field--full"><span className="gamification-form-label-row">Hedef kitle</span><textarea value={form.targetAudience} onChange={(e) => update('targetAudience', e.target.value)} className="gamification-form-input gamification-form-textarea" rows={2} placeholder="Kime yönelik" /></label>
                </div>
                <div className="create-collection-row">
                  <label className="gamification-form-label create-collection-label create-collection-field"><span className="gamification-form-label-row">Kampanya bağlamı</span><input type="text" value={form.campaignContext} onChange={(e) => update('campaignContext', e.target.value)} className="gamification-form-input" placeholder="Hangi kampanya ile ilişkili" /></label>
                  <label className="gamification-form-label create-collection-label create-collection-field"><span className="gamification-form-label-row">Başarı metriği</span><input type="text" value={form.successMetric} onChange={(e) => update('successMetric', e.target.value)} className="gamification-form-input" placeholder="Nasıl ölçülecek" /></label>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="gamification-wizard-pane create-collection-pane">
                <div className="create-collection-row">
                  <label className="gamification-form-label create-collection-label create-collection-field"><span className="gamification-form-label-row">Sponsorluk</span><input type="text" value={form.sponsorship} onChange={(e) => update('sponsorship', e.target.value)} className="gamification-form-input" placeholder="Varsa sponsor bilgisi" /></label>
                  <label className="gamification-form-label create-collection-label create-collection-field"><span className="gamification-form-label-row">Zaman / stok limiti</span><input type="text" value={form.timeStockLimit} onChange={(e) => update('timeStockLimit', e.target.value)} className="gamification-form-input" placeholder="Örn. 30 gün, 100 adet" /></label>
                </div>
                <div className="create-collection-row create-collection-row--full">
                  <label className="gamification-form-label create-collection-label create-collection-field--full"><span className="gamification-form-label-row">Açılma koşulu</span><textarea value={form.unlockCondition} onChange={(e) => update('unlockCondition', e.target.value)} className="gamification-form-input gamification-form-textarea" rows={2} placeholder="Koleksiyon ne zaman açılır" /></label>
                </div>
                <div className="create-collection-row">
                  <label className="gamification-form-label create-collection-label create-collection-field"><span className="gamification-form-label-row">Planlanan lansman</span><input type="datetime-local" value={form.scheduleLaunchDate} onChange={(e) => update('scheduleLaunchDate', e.target.value)} className="gamification-form-input" /></label>
                </div>
              </div>
            )}

            <div className="gamification-wizard-actions create-collection-actions">
              {step > 1 ? (
                <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>Geri</Button>
              ) : (
                <Link to="/gamification/collections"><Button type="button" variant="secondary">İptal</Button></Link>
              )}
              <div className="gamification-wizard-actions-next">
                {isLastStep ? (
                  <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Oluşturuluyor…' : 'Koleksiyonu oluştur'}</Button>
                ) : (
                  <Button type="button" variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>İleri</Button>
                )}
              </div>
            </div>
          </form>
        )}
      </DataCard>
    </div>
  );
}

export default CreateCollectionPage;
