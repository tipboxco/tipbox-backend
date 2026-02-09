import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  fetchBadgeCategories,
  createBadge,
  fetchCollection,
  fetchActionTypes,
  createCollectionGoal,
} from '../../api/admin-badges-collections';
import type { AdminBadgeCategoryListItem, AdminActionTypeListItem } from '../../types/admin';
import './gamification.css';

export type CreateBadgeModalType = 'EVENT' | 'BRAND' | 'COSMETIC' | 'COLLECTION';

interface CreateBadgeModalProps {
  badgeType: CreateBadgeModalType;
  listPath: string;
  collectionId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const isCollectionContext = (type: CreateBadgeModalType, cId?: string | null) =>
  type === 'COLLECTION' && cId;

function CreateBadgeModal({ badgeType, listPath, collectionId, onClose, onSuccess }: CreateBadgeModalProps) {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<AdminBadgeCategoryListItem[]>([]);
  const [actionTypes, setActionTypes] = useState<AdminActionTypeListItem[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [loadingActionTypes, setLoadingActionTypes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    imageUrl: '',
    rarity: 'COMMON' as 'COMMON' | 'RARE' | 'EPIC',
    categoryId: '',
    actionTypeId: '',
    pointsRequired: 1,
    difficulty: 'MEDIUM' as 'EASY' | 'MEDIUM' | 'HARD',
  });

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
            setForm((f) => ({ ...f, categoryId: data[0].id }));
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
  }, [inCollection]);

  useEffect(() => {
    if (!inCollection || !collectionId) return;
    let cancelled = false;
    setLoadingCollection(true);
    (async () => {
      try {
        const res = await fetchCollection(collectionId);
        const data = res.data;
        if (!cancelled && data?.categoryId) {
          setForm((f) => ({ ...f, categoryId: data.categoryId }));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Koleksiyon bilgisi alınamadı');
      } finally {
        if (!cancelled) setLoadingCollection(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collectionId, inCollection]);

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
          setForm((f) => (f.actionTypeId ? f : { ...f, actionTypeId: data[0].id }));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Aktivasyon tipleri yüklenemedi');
      } finally {
        if (!cancelled) setLoadingActionTypes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inCollection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Ad zorunludur.');
      return;
    }
    if (!form.categoryId) {
      setError(inCollection ? 'Koleksiyon bilgisi yükleniyor, lütfen bekleyin.' : 'Kategori seçin.');
      return;
    }
    if (inCollection && (!form.actionTypeId || form.pointsRequired < 1)) {
      setError('Aktivasyon tipi seçin ve hedef sayı en az 1 olmalıdır.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await createBadge({
        name: form.name.trim(),
        description: form.description.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        type: badgeType,
        rarity: form.rarity,
        categoryId: form.categoryId,
        collectionId: badgeType === 'COLLECTION' && collectionId ? collectionId : null,
      });
      if (inCollection && collectionId && res.data?.id) {
        await createCollectionGoal(collectionId, {
          actionTypeId: form.actionTypeId,
          rewardBadgeId: res.data.id,
          pointsRequired: form.pointsRequired,
          title: form.name.trim(),
          difficulty: form.difficulty,
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
  const canSubmit =
    form.categoryId &&
    form.name.trim() &&
    (!inCollection || (form.actionTypeId && form.pointsRequired >= 1));

  return (
    <div className="gamification-modal-overlay" onClick={onClose}>
      <div className="gamification-modal gamification-modal--create-badge" onClick={(e) => e.stopPropagation()}>
        <div className="gamification-modal-header">
          <h2>{inCollection ? 'Badge ekle' : `Yeni badge (${badgeType})`}</h2>
          <button type="button" className="gamification-modal-close" onClick={onClose} aria-label="Kapat">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <form onSubmit={handleSubmit} className="gamification-modal-form create-badge-form">
            {error && (
              <div className="gamification-error create-badge-form-error">
                {error}
              </div>
            )}
            <label className="create-badge-form-field create-badge-form-field--name">
              <span className="create-badge-form-label">Ad</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="Badge adı"
                className="create-badge-form-input"
              />
            </label>
            <label className="create-badge-form-field create-badge-form-field--description">
              <span className="create-badge-form-label">Açıklama</span>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="İsteğe bağlı"
                className="create-badge-form-input"
              />
            </label>
            <label className="create-badge-form-field create-badge-form-field--full">
              <span className="create-badge-form-label">Görsel URL</span>
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://..."
                className="create-badge-form-input"
              />
            </label>
            <label className="create-badge-form-field create-badge-form-field--rarity">
              <span className="create-badge-form-label">Rarity</span>
              <select
                value={form.rarity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rarity: e.target.value as 'COMMON' | 'RARE' | 'EPIC' }))
                }
                className="create-badge-form-input"
              >
                <option value="COMMON">COMMON</option>
                <option value="RARE">RARE</option>
                <option value="EPIC">EPIC</option>
              </select>
            </label>
            {!inCollection && (
              <label className="create-badge-form-field create-badge-form-field--category">
                <span className="create-badge-form-label">Kategori</span>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                  required
                  className="create-badge-form-input"
                >
                  <option value="">Seçin</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {inCollection && (
              <>
                <label className="create-badge-form-field create-badge-form-field--full">
                  <span className="create-badge-form-label">Aktivasyon tipi</span>
                  <select
                    value={form.actionTypeId}
                    onChange={(e) => setForm((f) => ({ ...f, actionTypeId: e.target.value }))}
                    className="create-badge-form-input"
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
                <label className="create-badge-form-field create-badge-form-field--rarity">
                  <span className="create-badge-form-label">Hedef sayı</span>
                  <input
                    type="number"
                    min={1}
                    value={form.pointsRequired}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        pointsRequired: Math.max(1, parseInt(e.target.value, 10) || 1),
                      }))
                    }
                    className="create-badge-form-input"
                  />
                </label>
                <label className="create-badge-form-field create-badge-form-field--rarity">
                  <span className="create-badge-form-label">Zorluk</span>
                  <select
                    value={form.difficulty}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        difficulty: e.target.value as 'EASY' | 'MEDIUM' | 'HARD',
                      }))
                    }
                    className="create-badge-form-input"
                  >
                    <option value="EASY">Kolay</option>
                    <option value="MEDIUM">Orta</option>
                    <option value="HARD">Zor</option>
                  </select>
                </label>
              </>
            )}
            <div className="create-badge-form-actions">
              <Button
                type="submit"
                variant="primary"
                disabled={Boolean(
                  saving || !canSubmit || (inCollection && (loadingActionTypes || !form.actionTypeId))
                )}
              >
                {saving ? 'Oluşturuluyor…' : 'Badge ekle'}
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

export default CreateBadgeModal;
