import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import DataCard from '../../components/DataCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  fetchBadge,
  updateBadge,
  deleteBadge,
  fetchBadgeOwners,
} from '../../api/admin-badges-collections';
import type { AdminBadgeDetailResponse, AdminBadgeOwnerListItem } from '../../types/admin';
import './gamification.css';

/** Yakalanan hatayı kullanıcıya gösterilecek stringe çevirir; [object Object] önlenir. */
function errorToMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return e != null ? String(e) : 'Beklenmeyen hata';
}

type TabId = 'summary' | 'owners';

const OWNERS_PAGE_SIZE = 20;

function BadgeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [badge, setBadge] = useState<AdminBadgeDetailResponse | null>(null);
  const [tab, setTab] = useState<TabId>('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBadge = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetchBadge(id);
      if (res.data) setBadge(res.data);
      else setError('Badge bulunamadı');
    } catch (e) {
      setError(errorToMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadBadge();
  }, [loadBadge]);

  if (!id) {
    return (
      <div className="badge-detail-page">
        <p>Geçersiz badge ID.</p>
        <Link to="/gamification/badges" className="gamification-detail-back">
          <i className="fa-solid fa-arrow-left"></i> Listeye dön
        </Link>
      </div>
    );
  }

  if (loading || !badge) {
    return (
      <div className="badge-detail-page">
        <Link to="/gamification/badges" className="gamification-detail-back">
          <i className="fa-solid fa-arrow-left"></i> Listeye dön
        </Link>
        {loading ? <LoadingSpinner /> : error ? <p className="gamification-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="badge-detail-page">
      <Link to="/gamification/badges" className="gamification-detail-back">
        <i className="fa-solid fa-arrow-left"></i> Listeye dön
      </Link>

      <div className="badge-detail-header">
        {badge.imageUrl && (
          <img src={badge.imageUrl} alt="" className="badge-detail-image" />
        )}
        <div>
          <h1 className="badge-detail-title">{badge.name}</h1>
          <span className="badge-detail-id">ID: {badge.id}</span>
          <span className="gamification-badge-type">{badge.type}</span>
          <span className="gamification-badge-rarity">{badge.rarity}</span>
        </div>
      </div>

      <div className="gamification-detail-tabs">
        {(
          [
            ['summary', 'Özet'],
            ['owners', 'Sahipler'],
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
        <BadgeSummaryTab badge={badge} onUpdated={loadBadge} onDeleted={() => navigate('/gamification/badges')} />
      )}
      {tab === 'owners' && <BadgeOwnersTab badgeId={id} />}
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
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    name: badge.name,
    description: badge.description ?? '',
    imageUrl: badge.imageUrl ?? '',
    type: badge.type,
    rarity: badge.rarity,
    boostMultiplier: badge.boostMultiplier ?? '',
    rewardMultiplier: badge.rewardMultiplier ?? '',
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
        boostMultiplier: form.boostMultiplier === '' ? null : Number(form.boostMultiplier),
        rewardMultiplier: form.rewardMultiplier === '' ? null : Number(form.rewardMultiplier),
        categoryId: form.categoryId,
        collectionId: form.collectionId === '' ? null : form.collectionId,
      });
      setEditing(false);
      onUpdated();
    } catch (e) {
      alert(errorToMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteBadge(badge.id);
      onDeleted();
    } catch (e) {
      alert(errorToMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DataCard title="Badge bilgisi">
      {!editing ? (
        <>
          <div className="gamification-detail-section">
            <p><strong>Ad:</strong> {badge.name}</p>
            <p><strong>Açıklama:</strong> {badge.description ?? '—'}</p>
            <p><strong>Tip:</strong> {badge.type} · <strong>Rarity:</strong> {badge.rarity}</p>
            <p><strong>Kategori:</strong> {badge.categoryName ?? badge.categoryId}</p>
            {badge.collectionId && (
              <p>
                <strong>Koleksiyon:</strong>{' '}
                <Link to={`/gamification/collections/${badge.collectionId}`}>
                  {badge.collectionName ?? badge.collectionId}
                </Link>
              </p>
            )}
            {badge.boostMultiplier != null && <p><strong>Boost çarpanı:</strong> {badge.boostMultiplier}</p>}
            {badge.rewardMultiplier != null && <p><strong>Ödül çarpanı:</strong> {badge.rewardMultiplier}</p>}
            {badge.imageUrl && (
              <p><strong>Görsel:</strong> <a href={badge.imageUrl} target="_blank" rel="noreferrer">Görüntüle</a></p>
            )}
            <p><strong>Oluşturulma:</strong> {new Date(badge.createdAt).toLocaleString('tr-TR')}</p>
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
              <p>Bu badge silinecek. Emin misiniz?</p>
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
          <div className="gamification-detail-section">
            <label>Ad <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
            <label>Açıklama <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></label>
            <label>Görsel URL <input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} /></label>
            <label>Tip
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="COLLECTION">COLLECTION</option>
                <option value="EVENT">EVENT</option>
                <option value="COSMETIC">COSMETIC</option>
                <option value="BRAND">BRAND</option>
              </select>
            </label>
            <label>Rarity
              <select value={form.rarity} onChange={(e) => setForm((f) => ({ ...f, rarity: e.target.value }))}>
                <option value="COMMON">COMMON</option>
                <option value="RARE">RARE</option>
                <option value="EPIC">EPIC</option>
              </select>
            </label>
            <label>Boost çarpanı <input type="number" step="any" value={form.boostMultiplier} onChange={(e) => setForm((f) => ({ ...f, boostMultiplier: e.target.value }))} /></label>
            <label>Ödül çarpanı <input type="number" step="any" value={form.rewardMultiplier} onChange={(e) => setForm((f) => ({ ...f, rewardMultiplier: e.target.value }))} /></label>
            <label>Kategori ID <input value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} /></label>
            <label>Koleksiyon ID <input value={form.collectionId} onChange={(e) => setForm((f) => ({ ...f, collectionId: e.target.value }))} placeholder="Boş bırakılabilir" /></label>
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

  if (loading) return <LoadingSpinner />;

  return (
    <DataCard title="Bu badge'e sahip kullanıcılar">
      {owners.length === 0 ? (
        <p className="gamification-empty-text">Henüz bu badge'e sahip kullanıcı yok.</p>
      ) : (
        <>
          <div className="gamification-table-wrap">
            <table className="gamification-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Email</th>
                  <th>Claimed</th>
                  <th>Claimed at</th>
                  <th>Oluşturulma</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/users/${o.userId}`}>
                        {o.userDisplayName ?? o.userId}
                      </Link>
                    </td>
                    <td>{o.userEmail ?? '—'}</td>
                    <td>{o.claimed ? 'Evet' : 'Hayır'}</td>
                    <td>{o.claimedAt ? new Date(o.claimedAt).toLocaleString('tr-TR') : '—'}</td>
                    <td>{new Date(o.createdAt).toLocaleString('tr-TR')}</td>
                    <td>
                      <Link to={`/users/${o.userId}`}>
                        <Button variant="secondary" size="sm">
                          Kullanıcı
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination.total > pagination.limit && (
            <div className="gamification-pagination">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.offset <= 0}
                onClick={() =>
                  setPagination((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))
                }
              >
                Önceki
              </Button>
              <span className="gamification-pagination-info">
                Toplam {pagination.total} sahip
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.offset + pagination.limit >= pagination.total}
                onClick={() =>
                  setPagination((p) => ({ ...p, offset: p.offset + p.limit }))
                }
              >
                Sonraki
              </Button>
            </div>
          )}
        </>
      )}
    </DataCard>
  );
}

export default BadgeDetail;
