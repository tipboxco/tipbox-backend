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
  addCollectionBadge,
  removeCollectionBadge,
  fetchBadges,
} from '../../api/admin-badges-collections';
import type {
  AdminCollectionDetailResponse,
  AdminCollectionBadgeListItem,
  AdminBadgeListItem,
} from '../../types/admin';
import CreateBadgeModal from './CreateBadgeModal';
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
          onUpdated={loadCollection}
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

  return (
    <DataCard title="Koleksiyon bilgisi">
      {!editing ? (
        <>
          <div className="gamification-detail-section">
            <p><strong>Ad:</strong> {collection.name}</p>
            <p><strong>Kategori:</strong> {collection.categoryName ?? collection.categoryId}</p>
            {collection.bannerUrl && <p><strong>Banner:</strong> <a href={collection.bannerUrl} target="_blank" rel="noreferrer">Görüntüle</a></p>}
            {collection.owner && <p><strong>Owner:</strong> {collection.owner}</p>}
            {collection.collectionObjective && <p><strong>Amaç:</strong> {collection.collectionObjective}</p>}
            {collection.targetVertical && <p><strong>Target vertical:</strong> {collection.targetVertical}</p>}
            {collection.productScope && <p><strong>Product scope:</strong> {collection.productScope}</p>}
            {collection.collectionType && <p><strong>Tip:</strong> {collection.collectionType}</p>}
            {collection.hookPitch && <p><strong>Hook pitch:</strong> {collection.hookPitch}</p>}
            {collection.visualTheme && <p><strong>Görsel tema:</strong> {collection.visualTheme}</p>}
            {collection.completionBonus && <p><strong>Tamamlama bonusu:</strong> {collection.completionBonus}</p>}
            {collection.primaryKpi && <p><strong>Primary KPI:</strong> {collection.primaryKpi}</p>}
            {collection.secondaryKpi && <p><strong>Secondary KPI:</strong> {collection.secondaryKpi}</p>}
            {collection.targetAudience && <p><strong>Hedef kitle:</strong> {collection.targetAudience}</p>}
            {collection.campaignContext && <p><strong>Kampanya bağlamı:</strong> {collection.campaignContext}</p>}
            {collection.successMetric && <p><strong>Başarı metriği:</strong> {collection.successMetric}</p>}
            {collection.sponsorship && <p><strong>Sponsorluk:</strong> {collection.sponsorship}</p>}
            {collection.unlockCondition && <p><strong>Unlock koşulu:</strong> {collection.unlockCondition}</p>}
            {collection.scheduleLaunchDate && <p><strong>Lansman tarihi:</strong> {new Date(collection.scheduleLaunchDate).toLocaleString('tr-TR')}</p>}
            {collection.timeStockLimit && <p><strong>Zaman/stok limiti:</strong> {collection.timeStockLimit}</p>}
            <p><strong>Badge sayısı:</strong> {collection.badgesCount} · <strong>Hedef sayısı:</strong> {collection.goalsCount ?? 0}</p>
            <p><strong>Oluşturulma:</strong> {new Date(collection.createdAt).toLocaleString('tr-TR')}</p>
          </div>
          <div className="gamification-detail-actions">
            <Button variant="primary" onClick={() => setEditing(true)}>
              Düzenle
            </Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Sil
            </Button>
          </div>
          {confirmDelete && (
            <div className="gamification-confirm-delete">
              <p>Bu koleksiyon silinecek. İçindeki badge'ler koleksiyondan çıkarılacak. Emin misiniz?</p>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Siliniyor…' : 'Evet, sil'}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                İptal
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="gamification-detail-section gamification-form-grid">
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
        </>
      )}
    </DataCard>
  );
}

function CollectionBadgesTab({
  collectionId,
  collectionName,
  onUpdated,
}: {
  collectionId: string;
  collectionName: string;
  onUpdated: () => void;
}) {
  const [badges, setBadges] = useState<AdminCollectionBadgeListItem[]>([]);
  const [allBadges, setAllBadges] = useState<AdminBadgeListItem[]>([]);
  const [selectedBadgeId, setSelectedBadgeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [createBadgeOpen, setCreateBadgeOpen] = useState(false);

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
    (async () => {
      try {
        const res = await fetchBadges({ limit: 500 });
        setAllBadges(res.data ?? []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const availableToAdd = allBadges.filter(
    (b) => !badges.some((cb) => cb.id === b.id) && b.collectionId !== collectionId
  );

  const handleAdd = async () => {
    if (!selectedBadgeId) return;
    setAdding(true);
    try {
      await addCollectionBadge(collectionId, { badgeId: selectedBadgeId });
      setSelectedBadgeId('');
      loadBadges();
      onUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Eklenemedi');
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
    <DataCard title={`Bu koleksiyon: ${collectionName}`}>
      <div className="gamification-badges-toolbar">
        <Button variant="primary" size="sm" onClick={() => setCreateBadgeOpen(true)}>
          Yeni badge oluştur
        </Button>
        <select
          value={selectedBadgeId}
          onChange={(e) => setSelectedBadgeId(e.target.value)}
          className="gamification-filter-select"
        >
          <option value="">Badge seçin</option>
          {availableToAdd.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.type}, {b.rarity})
            </option>
          ))}
        </select>
        <Button
          variant="primary"
          size="sm"
          disabled={!selectedBadgeId || adding}
          onClick={handleAdd}
        >
          {adding ? 'Ekleniyor…' : 'Badge ekle'}
        </Button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : badges.length === 0 ? (
        <p className="gamification-empty-text">Bu koleksiyonda henüz badge yok.</p>
      ) : (
        <div className="gamification-table-wrap">
          <table className="gamification-table">
            <thead>
              <tr>
                <th>Badge</th>
                <th>Tip</th>
                <th>Rarity</th>
                <th>Kategori</th>
                <th>Oluşturulma</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {badges.map((b) => (
                <tr key={b.id}>
                  <td>
                    {b.imageUrl && <img src={b.imageUrl} alt="" className="gamification-badge-thumb" />}
                    <Link to={`/gamification/collections/${collectionId}/badges/${b.id}`}>{b.name}</Link>
                  </td>
                  <td>{b.type}</td>
                  <td>{b.rarity}</td>
                  <td>{b.categoryName ?? b.categoryId}</td>
                  <td>{new Date(b.createdAt).toLocaleString('tr-TR')}</td>
                  <td>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={removing === b.id}
                      onClick={() => handleRemove(b.id)}
                    >
                      {removing === b.id ? '…' : 'Koleksiyondan çıkar'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {createBadgeOpen && (
        <CreateBadgeModal
          badgeType="COLLECTION"
          listPath={`/gamification/collections/${collectionId}`}
          collectionId={collectionId}
          onClose={() => setCreateBadgeOpen(false)}
          onSuccess={() => {
            setCreateBadgeOpen(false);
            loadBadges();
            onUpdated();
          }}
        />
      )}
    </DataCard>
  );
}

export default CollectionDetail;
