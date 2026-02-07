import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  fetchContentPost,
  updateContentPost,
  deleteContentPost,
  createFeedHighlight,
  createTrending,
} from '../../api/admin-content';
import type { AdminContentPostDetailResponse } from '../../types/admin';
import './content.css';

function ContentPostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<AdminContentPostDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchContentPost(id);
        if (!cancelled && res.data) setPost(res.data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Post yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleDelete = async () => {
    if (!id || !window.confirm('Bu postu silmek istediğinize emin misiniz?')) return;
    setActionLoading(true);
    try {
      await deleteContentPost(id);
      setMessage('Post silindi.');
      setTimeout(() => navigate('/content/posts'), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddHighlight = async (reason: string) => {
    if (!id) return;
    setActionLoading(true);
    try {
      await createFeedHighlight({ postId: id, reason });
      setMessage('Feed highlight eklendi.');
      const res = await fetchContentPost(id);
      if (res.data) setPost(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTrending = async (trendPeriod: string) => {
    if (!id) return;
    setActionLoading(true);
    try {
      await createTrending({ postId: id, trendPeriod });
      setMessage('Trending\'e eklendi.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setActionLoading(false);
    }
  };

  if (!id) {
    return (
      <div className="content-detail-page">
        <p>Geçersiz post ID.</p>
        <Link to="/content/posts" className="content-detail-back">
          Listeye dön
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="content-detail-page">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="content-detail-page">
        <p>{error || 'Post bulunamadı.'}</p>
        <Link to="/content/posts" className="content-detail-back">
          Listeye dön
        </Link>
      </div>
    );
  }

  const userDisplay = post.userDisplayName || post.userName || post.userId?.slice(0, 8) || '—';

  return (
    <div className="content-detail-page">
      <Link to="/content/posts" className="content-detail-back">
        <i className="fa-solid fa-arrow-left" /> Listeye dön
      </Link>

      {message && (
        <div className="content-error" style={{ background: 'rgba(var(--success-rgb), 0.15)', color: 'var(--success)' }}>
          {message}
        </div>
      )}
      {error && (
        <div className="content-error">
          {error}
        </div>
      )}

      <div className="content-detail-header">
        <h1 className="content-detail-title">{post.title}</h1>
        <span className="content-detail-id">ID: {post.id}</span>
        <span className="content-badge content-badge-free">{post.type}</span>
        {post.isBoosted && <span className="content-badge content-badge-tips">Boosted</span>}
      </div>

      <DataCard title="Özet">
        <div className="content-detail-meta">
          Yazar:{' '}
          <Link to={`/users/${post.userId}`} className="content-link">
            {userDisplay}
          </Link>
          {' · '}
          Oluşturulma: {post.createdAt ? new Date(post.createdAt).toLocaleString('tr-TR') : '—'}
          {' · '}
          Beğeni: {post.likesCount} · Yorum: {post.commentsCount} · Görüntülenme: {post.viewsCount}
        </div>
        {post.mainCategory && (
          <div className="content-detail-meta">
            Kategori: {post.mainCategory.name}
            {post.subCategory && ` / ${post.subCategory.name}`}
          </div>
        )}
        {post.product && (
          <div className="content-detail-meta">Ürün: {post.product.name}</div>
        )}
        {post.event && (
          <div className="content-detail-meta">
            Event: {post.event.title} ({post.event.status})
          </div>
        )}
        {post.tags && post.tags.length > 0 && (
          <div className="content-detail-meta">
            Etiketler: {post.tags.join(', ')}
          </div>
        )}
        <div className="content-detail-body">{post.body}</div>
        {post.media && post.media.length > 0 && (
          <div className="content-detail-section">
            <strong>Medya:</strong>{' '}
            {post.media.map((m) => (
              <a key={m.id} href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="content-link">
                [{m.orderIndex + 1}]
              </a>
            ))}
          </div>
        )}
        <div className="content-detail-actions">
          <Button
            size="sm"
            variant="secondary"
            disabled={actionLoading}
            onClick={() => handleAddHighlight('STAFF_PICK')}
          >
            Staff Pick olarak öne çıkar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={actionLoading}
            onClick={() => handleAddTrending('DAILY')}
          >
            Günlük Trending'e ekle
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={actionLoading}
            onClick={() => handleAddTrending('WEEKLY')}
          >
            Haftalık Trending'e ekle
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={actionLoading}
            onClick={handleDelete}
          >
            Postu sil
          </Button>
        </div>
      </DataCard>
    </div>
  );
}

export default ContentPostDetail;
