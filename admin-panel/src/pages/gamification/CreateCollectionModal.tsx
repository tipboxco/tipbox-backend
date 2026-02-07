import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import { createCollection } from '../../api/admin-badges-collections';
import './gamification.css';

interface CreateCollectionModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreateCollectionModal({ onClose, onSuccess }: CreateCollectionModalProps) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    categoryId: '',
    bannerUrl: '',
    owner: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.categoryId.trim()) {
      setError('Ad ve kategori ID zorunludur.');
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
      });
      onSuccess();
      if (res.data?.id) {
        navigate(`/gamification/collections/${res.data.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Koleksiyon oluşturulamadı');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gamification-modal-overlay" onClick={onClose}>
      <div className="gamification-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gamification-modal-header">
          <h2>Yeni koleksiyon</h2>
          <button type="button" className="gamification-modal-close" onClick={onClose} aria-label="Kapat">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>
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
            Kategori ID (zorunlu)
            <input
              type="text"
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              required
              placeholder="Category tablosundaki id"
              className="gamification-form-input"
            />
          </label>
          <label className="gamification-form-label">
            Banner URL
            <input
              type="url"
              value={form.bannerUrl}
              onChange={(e) => setForm((f) => ({ ...f, bannerUrl: e.target.value }))}
              className="gamification-form-input"
            />
          </label>
          <label className="gamification-form-label">
            Owner
            <input
              type="text"
              value={form.owner}
              onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
              className="gamification-form-input"
            />
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
      </div>
    </div>
  );
}

export default CreateCollectionModal;
