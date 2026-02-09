import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import DataCard from '../../components/DataCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
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
import './gamification.css';

type TabId = 'summary' | 'badges';

function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<AdminCollectionDetailResponse | null>(null);
  const [tab, setTab] = useState<TabId>('summary');
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
      <div className="collection-detail-page">
        <p>Geçersiz koleksiyon ID.</p>
        <Link to="/gamification/collections" className="gamification-detail-back">
          <i className="fa-solid fa-arrow-left"></i> Listeye dön
        </Link>
      </div>
    );
  }

  if (loading || !collection) {
    return (
      <div className="collection-detail-page">
        <Link to="/gamification/collections" className="gamification-detail-back">
          <i className="fa-solid fa-arrow-left"></i> Listeye dön
        </Link>
        {loading ? <LoadingSpinner /> : error ? <p className="gamification-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="collection-detail-page">
      <Link to="/gamification/collections" className="gamification-detail-back">
        <i className="fa-solid fa-arrow-left"></i> Listeye dön
      </Link>

      <div className="collection-detail-header">
        <h1 className="collection-detail-title">{collection.name}</h1>
        <span className="collection-detail-id">ID: {collection.id}</span>
      </div>

      <div className="gamification-detail-tabs">
        {(
          [
            ['summary', 'Özet'],
            ['badges', "Badge'ler"],
          ] as const
        ).map(([tabId, label]) => (
          <button
            key={tabId}
            type="button"
            className={`gamification-detail-tab ${tab === tabId ? 'active' : ''}`}
            onClick={() => setTab(tabId)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <CollectionSummaryTab
          collection={collection}
          onUpdated={loadCollection}
          onDeleted={() => navigate('/gamification/collections')}
        />
      )}
      {tab === 'badges' && (
        <CollectionBadgesTab
          collectionId={id}
          collectionName={collection.name}
          collectionCategoryId={collection.categoryId}
          onUpdated={loadCollection}
        />
      )}
    </div>
  );
}

const EMPTY = '—';

function formatValue(v: string | number | null | undefined, isDate = false): React.ReactNode {
  if (v == null || (typeof v === 'string' && v.trim() === '')) return EMPTY;
  if (isDate) return new Date(v as string).toLocaleString('tr-TR');
  return String(v);
}

function FullRow({ label, value }: { label: string; value: React.ReactNode }) {
  const display = value == null || value === '' ? EMPTY : value;
  return (
    <div className="collection-overview-row">
      <span className="collection-overview-label">{label}</span>
      <span className="collection-overview-value">{display}</span>
    </div>
  );
}

function DetailBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="collection-overview-block">
      <h4 className="collection-overview-block-title">{title}</h4>
      <div className="collection-overview-block-body">{children}</div>
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
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
      onUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteCollection(collection.id);
      onDeleted();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setDeleting(false);
    }
  };

  if (editing) {
    return (
      <DataCard title="Koleksiyon düzenle" variant="compact">
        <div className="collection-summary-edit-grid">
          <label>Ad <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
          <label>Banner URL <input value={form.bannerUrl} onChange={(e) => setForm((f) => ({ ...f, bannerUrl: e.target.value }))} /></label>
          <label>Owner <input value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} /></label>
          <label>Kategori ID <input value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} /></label>
          <label>Collection objective <input value={form.collectionObjective} onChange={(e) => setForm((f) => ({ ...f, collectionObjective: e.target.value }))} /></label>
          <label>Target vertical <input value={form.targetVertical} onChange={(e) => setForm((f) => ({ ...f, targetVertical: e.target.value }))} /></label>
          <label>Product scope <input value={form.productScope} onChange={(e) => setForm((f) => ({ ...f, productScope: e.target.value }))} /></label>
          <label>Collection type <input value={form.collectionType} onChange={(e) => setForm((f) => ({ ...f, collectionType: e.target.value }))} /></label>
          <label>Hook pitch <input value={form.hookPitch} onChange={(e) => setForm((f) => ({ ...f, hookPitch: e.target.value }))} /></label>
          <label>Visual theme <input value={form.visualTheme} onChange={(e) => setForm((f) => ({ ...f, visualTheme: e.target.value }))} /></label>
          <label>Completion bonus <input value={form.completionBonus} onChange={(e) => setForm((f) => ({ ...f, completionBonus: e.target.value }))} /></label>
          <label>Primary KPI <input value={form.primaryKpi} onChange={(e) => setForm((f) => ({ ...f, primaryKpi: e.target.value }))} /></label>
          <label>Secondary KPI <input value={form.secondaryKpi} onChange={(e) => setForm((f) => ({ ...f, secondaryKpi: e.target.value }))} /></label>
          <label>Target audience <input value={form.targetAudience} onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))} /></label>
          <label>Campaign context <input value={form.campaignContext} onChange={(e) => setForm((f) => ({ ...f, campaignContext: e.target.value }))} /></label>
          <label>Success metric <input value={form.successMetric} onChange={(e) => setForm((f) => ({ ...f, successMetric: e.target.value }))} /></label>
          <label>Sponsorship <input value={form.sponsorship} onChange={(e) => setForm((f) => ({ ...f, sponsorship: e.target.value }))} /></label>
          <label>Unlock condition <input value={form.unlockCondition} onChange={(e) => setForm((f) => ({ ...f, unlockCondition: e.target.value }))} /></label>
          <label>Schedule launch date <input type="datetime-local" value={form.scheduleLaunchDate} onChange={(e) => setForm((f) => ({ ...f, scheduleLaunchDate: e.target.value }))} /></label>
          <label>Time/stock limit <input value={form.timeStockLimit} onChange={(e) => setForm((f) => ({ ...f, timeStockLimit: e.target.value }))} /></label>
        </div>
        <div className="gamification-detail-actions">
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
          <Button variant="secondary" onClick={() => setEditing(false)}>
            İptal
          </Button>
        </div>
      </DataCard>
    );
  }

  return (
    <div className="collection-overview">
      <div className="collection-overview-hero">
        {collection.bannerUrl && (
          <div className="collection-overview-hero-banner">
            <img src={collection.bannerUrl} alt="" />
          </div>
        )}
        <div className="collection-overview-hero-main">
          <div className="collection-overview-hero-top">
            <span className="collection-overview-hero-category">
              {collection.categoryName ?? collection.categoryId}
            </span>
            {collection.owner && (
              <span className="collection-overview-hero-meta"> · {collection.owner}</span>
            )}
            <span className="collection-overview-hero-meta">
              {' '}
              · {new Date(collection.createdAt).toLocaleDateString('tr-TR')}
            </span>
          </div>
          <div className="collection-overview-hero-stats">
            <div className="collection-overview-stat">
              <span className="collection-overview-stat-value">{collection.badgesCount}</span>
              <span className="collection-overview-stat-label">Badge</span>
            </div>
            <div className="collection-overview-stat">
              <span className="collection-overview-stat-value">{collection.goalsCount ?? 0}</span>
              <span className="collection-overview-stat-label">Hedef</span>
            </div>
          </div>
          <div className="collection-overview-hero-actions">
            {collection.bannerUrl && (
              <a
                href={collection.bannerUrl}
                target="_blank"
                rel="noreferrer"
                className="collection-overview-hero-link"
              >
                Banner görüntüle
              </a>
            )}
            <Button variant="primary" onClick={() => setEditing(true)}>
              Düzenle
            </Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Sil
            </Button>
          </div>
          {confirmDelete && (
            <div className="collection-overview-confirm">
              <p>Bu koleksiyon silinecek. İçindeki badge'ler koleksiyondan çıkarılacak. Emin misiniz?</p>
              <div className="collection-overview-confirm-buttons">
                <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Siliniyor…' : 'Evet, sil'}
                </Button>
                <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                  İptal
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="collection-overview-details-card">
        <h3 className="collection-overview-details-title">Tüm bilgiler</h3>
        <div className="collection-overview-details-body">
          <DetailBlock title="Temel bilgiler">
            <FullRow label="Ad" value={collection.name} />
            <FullRow label="Kategori" value={collection.categoryName ?? collection.categoryId} />
            <FullRow
              label="Banner"
              value={
                collection.bannerUrl ? (
                  <a href={collection.bannerUrl} target="_blank" rel="noreferrer">
                    Görüntüle
                  </a>
                ) : EMPTY
              }
            />
            <FullRow label="Owner" value={collection.owner} />
            <FullRow label="Oluşturulma" value={formatValue(collection.createdAt, true)} />
            <FullRow label="Güncellenme" value={formatValue(collection.updatedAt, true)} />
          </DetailBlock>
          <DetailBlock title="İstatistikler">
            <FullRow label="Badge sayısı" value={collection.badgesCount} />
            <FullRow label="Hedef sayısı" value={collection.goalsCount ?? 0} />
          </DetailBlock>
          <DetailBlock title="Amaç & kapsam">
            <FullRow label="Collection objective" value={collection.collectionObjective} />
            <FullRow label="Target vertical" value={collection.targetVertical} />
            <FullRow label="Product scope" value={collection.productScope} />
            <FullRow label="Collection type" value={collection.collectionType} />
          </DetailBlock>
          <DetailBlock title="Hook & tema">
            <FullRow label="Hook pitch" value={collection.hookPitch} />
            <FullRow label="Visual theme" value={collection.visualTheme} />
            <FullRow label="Completion bonus" value={collection.completionBonus} />
          </DetailBlock>
          <DetailBlock title="KPI & metrik">
            <FullRow label="Primary KPI" value={collection.primaryKpi} />
            <FullRow label="Secondary KPI" value={collection.secondaryKpi} />
            <FullRow label="Success metric" value={collection.successMetric} />
          </DetailBlock>
          <DetailBlock title="Hedef kitle & kampanya">
            <FullRow label="Target audience" value={collection.targetAudience} />
            <FullRow label="Campaign context" value={collection.campaignContext} />
            <FullRow label="Sponsorship" value={collection.sponsorship} />
          </DetailBlock>
          <DetailBlock title="Zamanlama & koşul">
            <FullRow label="Unlock condition" value={collection.unlockCondition} />
            <FullRow
              label="Schedule launch date"
              value={formatValue(collection.scheduleLaunchDate, true)}
            />
            <FullRow label="Time/stock limit" value={collection.timeStockLimit} />
          </DetailBlock>
        </div>
      </div>

      <div className="collection-overview-meta">
        <span>ID: {collection.id}</span>
      </div>
    </div>
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

  const handleAddBadge = async (e: React.FormEvent) => {
    e.preventDefault();
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
      loadBadges();
      onUpdated();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Badge eklenemedi');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (badgeId: string) => {
    if (!confirm('Bu badge koleksiyondan çıkarılacak. Emin misiniz?')) return;
    setRemoving(badgeId);
    try {
      await removeCollectionBadge(collectionId, badgeId);
      loadBadges();
      onUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Çıkarılamadı');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="collection-badges-tab">
      <DataCard title="Badge ekle" variant="bordered" className="collection-badges-form-card">
        <form onSubmit={handleAddBadge} className="collection-badges-form collection-badges-form--horizontal">
          {addError && (
            <div className="gamification-error collection-badges-form-error" role="alert">
              {addError}
            </div>
          )}
          <div className="collection-badges-form-row">
            <label className="collection-badges-form-field">
              <span className="collection-badges-form-label">Ad</span>
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Badge adı"
                className="collection-badges-form-input"
              />
            </label>
            <label className="collection-badges-form-field">
              <span className="collection-badges-form-label">Açıklama</span>
              <input
                type="text"
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="İsteğe bağlı"
                className="collection-badges-form-input"
              />
            </label>
            <label className="collection-badges-form-field">
              <span className="collection-badges-form-label">Görsel URL</span>
              <input
                type="url"
                value={addForm.imageUrl}
                onChange={(e) => setAddForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://..."
                className="collection-badges-form-input"
              />
            </label>
            <label className="collection-badges-form-field">
              <span className="collection-badges-form-label">Rarity</span>
              <select
                value={addForm.rarity}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, rarity: e.target.value as 'COMMON' | 'RARE' | 'EPIC' }))
                }
                className="collection-badges-form-input"
              >
                <option value="COMMON">COMMON</option>
                <option value="RARE">RARE</option>
                <option value="EPIC">EPIC</option>
              </select>
            </label>
            <label className="collection-badges-form-field">
              <span className="collection-badges-form-label">Aktivasyon tipi</span>
              <select
                value={addForm.actionTypeId}
                onChange={(e) => setAddForm((f) => ({ ...f, actionTypeId: e.target.value }))}
                className="collection-badges-form-input"
                disabled={loadingActionTypes}
              >
                <option value="">
                  {loadingActionTypes ? 'Yükleniyor…' : 'Seçin'}
                </option>
                {actionTypes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} ({a.mainAction} / {a.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="collection-badges-form-field">
              <span className="collection-badges-form-label">Hedef sayı</span>
              <input
                type="number"
                min={1}
                value={addForm.pointsRequired}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, pointsRequired: Math.max(1, parseInt(e.target.value, 10) || 1) }))
                }
                className="collection-badges-form-input"
              />
            </label>
            <label className="collection-badges-form-field">
              <span className="collection-badges-form-label">Zorluk</span>
              <select
                value={addForm.difficulty}
                onChange={(e) =>
                  setAddForm((f) => ({
                    ...f,
                    difficulty: e.target.value as 'EASY' | 'MEDIUM' | 'HARD',
                  }))
                }
                className="collection-badges-form-input"
              >
                <option value="EASY">Kolay</option>
                <option value="MEDIUM">Orta</option>
                <option value="HARD">Zor</option>
              </select>
            </label>
            <div className="collection-badges-form-actions">
              <Button
                type="submit"
                variant="primary"
                disabled={adding || loadingActionTypes || !addForm.actionTypeId}
              >
                {adding ? 'Ekleniyor…' : 'Badge ekle'}
              </Button>
            </div>
          </div>
        </form>
      </DataCard>

      <DataCard title={`Koleksiyon badge'leri (${collectionName})`} className="collection-badges-list-card">
        {loading ? (
          <LoadingSpinner />
        ) : badges.length === 0 ? (
          <div className="collection-badges-empty">
            <i className="fa-solid fa-medal" aria-hidden />
            <p>Bu koleksiyonda henüz badge yok.</p>
            <p className="collection-badges-empty-hint">Yukarıdaki form ile yeni badge ekleyebilirsiniz.</p>
          </div>
        ) : (
          <div className="collection-badges-grid">
            {badges.map((b) => (
              <div key={b.id} className="collection-badge-card">
                <div className="collection-badge-card-visual">
                  {b.imageUrl ? (
                    <img src={b.imageUrl} alt="" className="collection-badge-card-image" />
                  ) : (
                    <div className="collection-badge-card-placeholder">
                      <i className="fa-solid fa-medal" />
                    </div>
                  )}
                </div>
                <div className="collection-badge-card-body">
                  <h4 className="collection-badge-card-title">
                    <Link to={`/gamification/collections/${collectionId}/badges/${b.id}`}>{b.name}</Link>
                  </h4>
                  {b.description && (
                    <p className="collection-badge-card-description">{b.description}</p>
                  )}
                  <div className="collection-badge-card-chips">
                    <span className={`info-chip info-chip-rarity info-chip-rarity-${b.rarity.toLowerCase()}`}>
                      {b.rarity}
                    </span>
                    {b.categoryName && (
                      <span className="info-chip info-chip-category">{b.categoryName}</span>
                    )}
                  </div>
                  <p className="collection-badge-card-meta">
                    {new Date(b.createdAt).toLocaleString('tr-TR')}
                  </p>
                </div>
                <div className="collection-badge-card-actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditingBadgeId(b.id)}
                    aria-label="Düzenle"
                  >
                    <i className="fa-solid fa-pen" /> Düzenle
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={removing === b.id}
                    onClick={() => handleRemove(b.id)}
                    aria-label="Koleksiyondan çıkar"
                  >
                    {removing === b.id ? (
                      <i className="fa-solid fa-spinner fa-spin" />
                    ) : (
                      <i className="fa-solid fa-trash-can" />
                    )}{' '}
                    Sil
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataCard>

      {editingBadgeId && (
        <EditBadgeInCollectionModal
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
  badgeId,
  onClose,
  onSuccess,
}: {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gamification-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="gamification-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gamification-modal-header">
          <h2>Badge düzenle</h2>
          <button type="button" className="gamification-modal-close" onClick={onClose} aria-label="Kapat">
            <i className="fa-solid fa-times" />
          </button>
        </div>
        {loading ? (
          <LoadingSpinner />
        ) : !badge ? (
          <div className="gamification-modal-form">
            <p className="gamification-error">Badge bulunamadı.</p>
            <Button variant="secondary" onClick={onClose}>Kapat</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="gamification-modal-form">
            {error && (
              <div className="gamification-error" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}
            <label className="gamification-form-label">
              Ad
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="gamification-form-input"
              />
            </label>
            <label className="gamification-form-label">
              Açıklama
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="gamification-form-input"
              />
            </label>
            <label className="gamification-form-label">
              Görsel URL
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                className="gamification-form-input"
              />
            </label>
            <label className="gamification-form-label">
              Rarity
              <select
                value={form.rarity}
                onChange={(e) => setForm((f) => ({ ...f, rarity: e.target.value }))}
                className="gamification-form-input"
              >
                <option value="COMMON">COMMON</option>
                <option value="RARE">RARE</option>
                <option value="EPIC">EPIC</option>
              </select>
            </label>
            <label className="gamification-form-label">
              Kategori
              <select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="gamification-form-input"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="gamification-modal-actions">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
              <Button type="button" variant="secondary" onClick={onClose}>
                İptal
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default CollectionDetail;
