import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import { fetchBadgeCategories, createBadge } from '../../api/admin-badges-collections';
import type { AdminBadgeCategoryListItem } from '../../types/admin';
import './gamification.css';

export type CreateBadgeModalType = 'EVENT' | 'BRAND' | 'COSMETIC' | 'COLLECTION';

interface CreateBadgeModalProps {
  badgeType: CreateBadgeModalType;
  listPath: string;
  collectionId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateBadgeModal({ badgeType, listPath, collectionId, onClose, onSuccess }: CreateBadgeModalProps) {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<AdminBadgeCategoryListItem[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    imageUrl: '',
    rarity: 'COMMON' as 'COMMON' | 'RARE' | 'EPIC',
    categoryId: '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchBadgeCategories();
        if (!cancelled && res.data) {
          setCategories(res.data);
          if (res.data.length > 0 && !form.categoryId) {
            setForm((f) => ({ ...f, categoryId: res.data[0].id }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.categoryId) {
      setError('Ad ve kategori zorunludur.');
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

  return (
    <div className="gamification-modal-overlay" onClick={onClose}>
      <div className="gamification-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gamification-modal-header">
          <h2>Yeni badge {badgeType === 'COLLECTION' ? '(Achievement)' : `(${badgeType})`}</h2>
          <button type="button" className="gamification-modal-close" onClick={onClose} aria-label="Kapat">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>
        {loadingCategories ? (
          <LoadingSpinner />
        ) : (
          <form onSubmit={handleSubmit} className="gamification-modal-form">
            {error && (
              <div className="gamification-error" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}
            <label className="gamification-form-label">
              Ad (zorunlu)
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, rarity: e.target.value as 'COMMON' | 'RARE' | 'EPIC' }))
                }
                className="gamification-form-input"
              >
                <option value="COMMON">COMMON</option>
                <option value="RARE">RARE</option>
                <option value="EPIC">EPIC</option>
              </select>
            </label>
            <label className="gamification-form-label">
              Kategori (zorunlu)
              <select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                required
                className="gamification-form-input"
              >
                <option value="">Seçin</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="gamification-modal-actions">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Oluşturuluyor…' : 'Oluştur'}
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
