import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import DataCard from '../../components/DataCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  fetchContentPost,
  deleteContentPost,
  createFeedHighlight,
  createTrending,
} from '../../api/admin-content';
import type { AdminContentPostDetailResponse } from '../../types/admin';
import './content.css';

const typeBadgeClass: Record<string, string> = {
  FREE: 'content-badge-free',
  TIPS: 'content-badge-tips',
  EXPERIENCE: 'content-badge-experience',
  QUESTION: 'content-badge-question',
  COMPARE: 'content-badge-compare',
  UPDATE: 'content-badge-update',
};

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
  const badgeClass = typeBadgeClass[post.type] ?? 'content-badge-free';
  const isImageUrl = (url: string) => /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url) || /\/image\//i.test(url);

  return (
    <div className="content-detail-page">
      <Link to="/content/posts" className="content-detail-back">
        <i className="fa-solid fa-arrow-left" /> Listeye dön
      </Link>

      {message && (
        <div className="content-detail-message content-detail-message-success">
          {message}
        </div>
      )}
      {error && (
        <div className="content-error">
          {error}
        </div>
      )}

      <header className="content-detail-header">
        <h1 className="content-detail-title">{post.title || 'Başlıksız'}</h1>
        <div className="content-detail-header-meta">
          <span className="content-detail-id">ID: {post.id}</span>
          <span className={`content-badge ${badgeClass}`}>{post.type}</span>
          {post.isBoosted && <span className="content-badge content-badge-tips">Boosted</span>}
        </div>
      </header>

      <DataCard title="Özet" className="content-detail-card">
        <div className="content-detail-meta-row">
          <span className="content-detail-meta-label">Yazar</span>
          <Link to={`/users/${post.userId}`} className="content-link">
            {userDisplay}
          </Link>
          <span className="content-detail-meta-sep">·</span>
          <span className="content-detail-meta-label">Oluşturulma</span>
          <span>{post.createdAt ? new Date(post.createdAt).toLocaleString('tr-TR') : '—'}</span>
        </div>
        <div className="content-detail-stats">
          <span className="content-detail-stat" title="Beğeni">
            <i className="fa-solid fa-heart" /> {post.likesCount}
          </span>
          <span className="content-detail-stat" title="Yorum">
            <i className="fa-solid fa-comment" /> {post.commentsCount}
          </span>
          <span className="content-detail-stat" title="Görüntülenme">
            <i className="fa-solid fa-eye" /> {post.viewsCount}
          </span>
        </div>
        {(post.mainCategory || post.subCategory) && (
          <div className="content-detail-meta-row">
            <span className="content-detail-meta-label">Kategori</span>
            {[post.mainCategory?.name, post.subCategory?.name].filter(Boolean).join(' / ')}
          </div>
        )}
        {post.product && (
          <div className="content-detail-meta-row">
            <span className="content-detail-meta-label">Ürün</span>
            {post.product.name}
          </div>
        )}
        {post.event && (
          <div className="content-detail-meta-row">
            <span className="content-detail-meta-label">Event</span>
            {post.event.title} <span className="content-detail-meta-muted">({post.event.status})</span>
          </div>
        )}
        {post.tags && post.tags.length > 0 && (
          <div className="content-detail-tags">
            {post.tags.map((tag) => (
              <span key={tag} className="content-detail-tag">{tag}</span>
            ))}
          </div>
        )}
      </DataCard>

      {post.body && (
        <DataCard title="İçerik" className="content-detail-card">
          <div className="content-detail-body">{post.body}</div>
        </DataCard>
      )}

      {post.media && post.media.length > 0 && (
        <DataCard title="Medya" className="content-detail-card">
          <div className="content-detail-media-grid">
            {post.media.map((m) => (
              <a
                key={m.id}
                href={m.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="content-detail-media-item"
                title={`Medya ${m.orderIndex + 1}`}
              >
                {isImageUrl(m.mediaUrl) ? (
                  <img
                    src={m.mediaUrl}
                    alt={`Medya ${m.orderIndex + 1}`}
                    className="content-detail-media-img"
                    loading="lazy"
                  />
                ) : (
                  <div className="content-detail-media-placeholder">
                    <i className="fa-solid fa-file-image" />
                    <span>Medya {m.orderIndex + 1}</span>
                    <span className="content-detail-media-open">Aç</span>
                  </div>
                )}
              </a>
            ))}
          </div>
        </DataCard>
      )}

      <DataCard title="İşlemler" className="content-detail-card">
        <div className="content-detail-actions">
          <div className="content-detail-actions-group">
            <Button
              size="sm"
              variant="secondary"
              disabled={actionLoading}
              onClick={() => handleAddHighlight('STAFF_PICK')}
              className="content-detail-btn"
            >
              <i className="fa-solid fa-star" /> Staff Pick
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={actionLoading}
              onClick={() => handleAddTrending('DAILY')}
              className="content-detail-btn"
            >
              <i className="fa-solid fa-chart-line" /> Günlük Trending
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={actionLoading}
              onClick={() => handleAddTrending('WEEKLY')}
              className="content-detail-btn"
            >
              <i className="fa-solid fa-chart-line" /> Haftalık Trending
            </Button>
          </div>
          <div className="content-detail-actions-group content-detail-actions-danger">
            <Button
              size="sm"
              variant="danger"
              disabled={actionLoading}
              onClick={handleDelete}
              className="content-detail-btn content-detail-btn-danger"
            >
              <i className="fa-solid fa-trash" /> Postu sil
            </Button>
          </div>
        </div>
      </DataCard>
    </div>
  );
}

export default ContentPostDetail;
