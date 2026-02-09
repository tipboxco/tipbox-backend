import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  fetchUser,
  fetchUserModerationHistory,
  fetchUserLoginAttempts,
  fetchUserAvatar,
  updateUserAvatar,
  createUserAvatar,
  fetchUserEvents,
  fetchUserBadges,
  grantUserBadge,
  revokeUserBadge,
  fetchUserWallet,
  fetchUserTipsSummary,
  fetchUserTipsTransactions,
  updateUser,
  updateUserRoles,
  banUser,
  unbanUser,
} from '../../api/admin-users';
import { fetchUserPosts } from '../../api/admin-content';
import type {
  AdminUserDetailResponse,
  AdminModerationHistoryItem,
  AdminLoginAttemptListItem,
  AdminAvatarResponse,
  AdminUserEventListItem,
  AdminUserBadgeListItem,
  AdminWalletSummaryItem,
  AdminTipsSummaryResponse,
  AdminTipsTransactionListItem,
  PaginationMeta,
  AdminContentPostListItem,
} from '../../types/admin';
import './users.css';

type TabId = 'overview' | 'profile' | 'roles' | 'events' | 'badges' | 'posts' | 'wallet' | 'moderation' | 'login';

function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<AdminUserDetailResponse | null>(null);
  const [moderation, setModeration] = useState<AdminModerationHistoryItem[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<AdminLoginAttemptListItem[]>([]);
  const [avatar, setAvatar] = useState<AdminAvatarResponse | null | undefined>(undefined);
  const [userEvents, setUserEvents] = useState<AdminUserEventListItem[]>([]);
  const [userBadges, setUserBadges] = useState<AdminUserBadgeListItem[]>([]);
  const [userPosts, setUserPosts] = useState<AdminContentPostListItem[]>([]);
  const [wallet, setWallet] = useState<AdminWalletSummaryItem[]>([]);
  const [tipsSummary, setTipsSummary] = useState<AdminTipsSummaryResponse | null>(null);
  const [tipsTransactions, setTipsTransactions] = useState<AdminTipsTransactionListItem[]>([]);
  const [eventsPagination, setEventsPagination] = useState<PaginationMeta | undefined>(undefined);
  const [badgesPagination, setBadgesPagination] = useState<PaginationMeta | undefined>(undefined);
  const [postsPagination, setPostsPagination] = useState<PaginationMeta | undefined>(undefined);
  const [tipsPagination, setTipsPagination] = useState<PaginationMeta | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingTab, setLoadingTab] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [error, setError] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editStatus, setEditStatus] = useState<string>('');
  const [editEmailVerified, setEditEmailVerified] = useState(false);
  const [editRoles, setEditRoles] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [avatarImageUrl, setAvatarImageUrl] = useState('');
  const [avatarActiveId, setAvatarActiveId] = useState<string | null>(null);
  const [grantBadgeId, setGrantBadgeId] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchUser(id);
        if (!cancelled && res.data) {
          setUser(res.data);
          setEditEmail(res.data.email ?? '');
          setEditStatus(res.data.status ?? '');
          setEditEmailVerified(res.data.emailVerified ?? false);
          setEditRoles((res.data.roles ?? []).join(', '));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kullanıcı yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!id || activeTab !== 'moderation') return;
    let cancelled = false;
    setLoadingTab(true);
    (async () => {
      try {
        const res = await fetchUserModerationHistory(id, { limit: 50, offset: 0 });
        if (!cancelled) setModeration(res.data ?? []);
      } finally {
        if (!cancelled) setLoadingTab(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, activeTab]);

  useEffect(() => {
    if (!id || activeTab !== 'login') return;
    let cancelled = false;
    setLoadingTab(true);
    (async () => {
      try {
        const res = await fetchUserLoginAttempts(id, { limit: 50, offset: 0 });
        if (!cancelled) setLoginAttempts(res.data ?? []);
      } finally {
        if (!cancelled) setLoadingTab(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, activeTab]);

  useEffect(() => {
    if (!id || activeTab !== 'profile') return;
    let cancelled = false;
    setLoadingTab(true);
    setAvatar(undefined);
    (async () => {
      try {
        const res = await fetchUserAvatar(id);
        if (!cancelled) {
          setAvatar(res.data ?? null);
          if (res.data) {
            setAvatarImageUrl(res.data.imageUrl);
            if (res.data.isActive) setAvatarActiveId(res.data.id);
          } else {
            setAvatarImageUrl('');
            setAvatarActiveId(null);
          }
        }
      } catch {
        if (!cancelled) setAvatar(null);
      } finally {
        if (!cancelled) setLoadingTab(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, activeTab]);

  useEffect(() => {
    if (!id || activeTab !== 'events') return;
    let cancelled = false;
    setLoadingTab(true);
    (async () => {
      try {
        const res = await fetchUserEvents(id, { limit: 20, offset: 0 });
        if (!cancelled) {
          setUserEvents(res.data ?? []);
          setEventsPagination(res.pagination);
        }
      } finally {
        if (!cancelled) setLoadingTab(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, activeTab]);

  useEffect(() => {
    if (!id || activeTab !== 'badges') return;
    let cancelled = false;
    setLoadingTab(true);
    (async () => {
      try {
        const res = await fetchUserBadges(id, { limit: 50, offset: 0 });
        if (!cancelled) {
          setUserBadges(res.data ?? []);
          setBadgesPagination(res.pagination);
        }
      } finally {
        if (!cancelled) setLoadingTab(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, activeTab]);

  useEffect(() => {
    if (!id || activeTab !== 'posts') return;
    let cancelled = false;
    setLoadingTab(true);
    (async () => {
      try {
        const res = await fetchUserPosts(id, { limit: 20, offset: 0 });
        if (!cancelled) {
          setUserPosts(res.data ?? []);
          setPostsPagination(res.pagination);
        }
      } finally {
        if (!cancelled) setLoadingTab(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, activeTab]);

  useEffect(() => {
    if (!id || activeTab !== 'wallet') return;
    let cancelled = false;
    setLoadingTab(true);
    (async () => {
      try {
        const [walletRes, summaryRes, txRes] = await Promise.all([
          fetchUserWallet(id),
          fetchUserTipsSummary(id),
          fetchUserTipsTransactions(id, { limit: 20, offset: 0 }),
        ]);
        if (!cancelled) {
          setWallet(Array.isArray(walletRes.data) ? walletRes.data : []);
          setTipsSummary(summaryRes.data ?? null);
          setTipsTransactions(Array.isArray(txRes.data) ? txRes.data : []);
          setTipsPagination(txRes.pagination);
        }
      } finally {
        if (!cancelled) setLoadingTab(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, activeTab]);

  const handleSaveUser = async () => {
    if (!id || !user) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateUser(id, {
        email: editEmail || undefined,
        status: editStatus || null,
        emailVerified: editEmailVerified,
      });
      const res = await fetchUser(id);
      if (res.data) setUser(res.data);
      setMessage('Kullanıcı güncellendi');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Güncelleme başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRoles = async () => {
    if (!id) return;
    const roles = editRoles
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    setSaving(true);
    setMessage(null);
    try {
      await updateUserRoles(id, roles);
      const res = await fetchUser(id);
      if (res.data) setUser(res.data);
      setEditRoles(res.data?.roles?.join(', ') ?? '');
      setMessage('Roller güncellendi');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Güncelleme başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleBan = async () => {
    if (!id) return;
    if (!window.confirm('Bu kullanıcıyı yasaklamak istediğinize emin misiniz?')) return;
    setSaving(true);
    setMessage(null);
    try {
      await banUser(id);
      const res = await fetchUser(id);
      if (res.data) setUser(res.data);
      setEditStatus('BANNED');
      setMessage('Kullanıcı yasaklandı');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleUnban = async () => {
    if (!id) return;
    if (!window.confirm('Yasağı kaldırmak istediğinize emin misiniz?')) return;
    setSaving(true);
    setMessage(null);
    try {
      await unbanUser(id);
      const res = await fetchUser(id);
      if (res.data) setUser(res.data);
      setEditStatus('');
      setMessage('Yasak kaldırıldı');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAvatar = async () => {
    if (!id) return;
    setSaving(true);
    setMessage(null);
    try {
      const body: { imageUrl?: string; avatarId?: string; isActive?: boolean } = {};
      if (avatarImageUrl.trim()) body.imageUrl = avatarImageUrl.trim();
      if (avatarActiveId) body.avatarId = avatarActiveId;
      await updateUserAvatar(id, body);
      const res = await fetchUserAvatar(id);
      setAvatar(res.data ?? null);
      if (res.data) {
        setAvatarImageUrl(res.data.imageUrl);
        setAvatarActiveId(res.data.isActive ? res.data.id : null);
      }
      setMessage('Profil resmi güncellendi');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Güncelleme başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAvatar = async () => {
    if (!id || !avatarImageUrl.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await createUserAvatar(id, { imageUrl: avatarImageUrl.trim() });
      const res = await fetchUserAvatar(id);
      setAvatar(res.data ?? null);
      if (res.data) {
        setAvatarImageUrl(res.data.imageUrl);
        setAvatarActiveId(res.data.isActive ? res.data.id : null);
      }
      setMessage('Profil resmi eklendi');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ekleme başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleGrantBadge = async () => {
    if (!id || !grantBadgeId.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await grantUserBadge(id, { badgeId: grantBadgeId.trim() });
      const res = await fetchUserBadges(id, { limit: 50, offset: 0 });
      setUserBadges(res.data ?? []);
      setGrantBadgeId('');
      setMessage('Rozet verildi');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Rozet verilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeBadge = async (userBadgeId: string) => {
    if (!id || !window.confirm('Bu rozeti kullanıcıdan almak istediğinize emin misiniz?')) return;
    setSaving(true);
    setMessage(null);
    try {
      await revokeUserBadge(id, userBadgeId);
      const res = await fetchUserBadges(id, { limit: 50, offset: 0 });
      setUserBadges(res.data ?? []);
      setMessage('Rozet alındı');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setSaving(false);
    }
  };

  if (!id) {
    return (
      <div className="users-page">
        <p>Geçersiz kullanıcı</p>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="users-page">
        <LoadingSpinner fullScreen={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="users-page">
        <PageHeader
          title="Hata"
          description={error}
          icon="fa-exclamation-triangle"
          backTo="/users"
          backLabel="Listeye dön"
        />
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Özet' },
    { id: 'profile', label: 'Profil' },
    { id: 'roles', label: 'Roller' },
    { id: 'events', label: 'Etkinlikler' },
    { id: 'badges', label: 'Rozetler' },
    { id: 'posts', label: 'Postları' },
    { id: 'wallet', label: 'Cüzdan & Tips' },
    { id: 'moderation', label: 'Moderation geçmişi' },
    { id: 'login', label: 'Giriş denemeleri' },
  ];

  return (
    <div className="users-page">
      <PageHeader
        title={user.displayName || user.userName || user.email || user.id}
        description={user.email ?? undefined}
        icon="fa-user"
        backTo="/users"
        backLabel="Listeye dön"
        actions={
          <div className="users-detail-header-actions">
            {user.status === 'BANNED' ? (
              <Button size="sm" variant="success" onClick={handleUnban} disabled={saving}>
                Yasak kaldır
              </Button>
            ) : (
              <Button size="sm" variant="danger" onClick={handleBan} disabled={saving}>
                Yasakla
              </Button>
            )}
          </div>
        }
      />

      {message && (
        <div className={`users-message ${message.includes('başarı') ? 'users-message-success' : 'users-message-error'}`}>
          {message}
        </div>
      )}

      <div className="users-detail-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`users-detail-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="users-detail-panel">
        {activeTab === 'overview' && (
          <div className="users-detail-grid users-detail-grid--wide">
            <DataCard title="Hesap">
              <div className="users-detail-fields">
                <div className="users-detail-field">
                  <div className="users-detail-field-label">User ID</div>
                  <div className="users-detail-field-value users-id-value" title={user.id}>
                    {user.id}
                  </div>
                </div>
                {user.auth0Id && (
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Auth0 ID</div>
                    <div className="users-detail-field-value users-id-value" title={user.auth0Id}>
                      {user.auth0Id}
                    </div>
                  </div>
                )}
                <div className="users-detail-field">
                  <div className="users-detail-field-label">Email</div>
                  <div className="users-detail-field-value">{user.email ?? '—'}</div>
                </div>
                <div className="users-detail-field">
                  <div className="users-detail-field-label">Durum</div>
                  <div className="users-detail-field-value">
                    <span className={`users-badge users-badge-${user.status === 'BANNED' ? 'danger' : 'neutral'}`}>
                      {user.status ?? '—'}
                    </span>
                  </div>
                </div>
                <div className="users-detail-field">
                  <div className="users-detail-field-label">Email doğrulu</div>
                  <div className="users-detail-field-value">{user.emailVerified ? 'Evet' : 'Hayır'}</div>
                </div>
                <div className="users-detail-field">
                  <div className="users-detail-field-label">Roller</div>
                  <div className="users-detail-field-value">{(user.roles ?? []).join(', ') || '—'}</div>
                </div>
                <div className="users-detail-field">
                  <div className="users-detail-field-label">Kayıt</div>
                  <div className="users-detail-field-value">
                    {user.createdAt ? new Date(user.createdAt).toLocaleString('tr-TR') : '—'}
                  </div>
                </div>
              </div>
            </DataCard>
            {user.lastBan ? (
              <DataCard title="Son yasaklama">
                <div className="users-detail-fields">
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Kayıt ID</div>
                    <div className="users-detail-field-value users-id-value" title={user.lastBan.id}>
                      {user.lastBan.id}
                    </div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Moderatör ID</div>
                    <div className="users-detail-field-value users-id-value" title={user.lastBan.moderatorId}>
                      {user.lastBan.moderatorId}
                    </div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Tarih</div>
                    <div className="users-detail-field-value">
                      {new Date(user.lastBan.createdAt).toLocaleString('tr-TR')}
                    </div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Moderatör</div>
                    <div className="users-detail-field-value">{user.lastBan.moderatorEmail ?? '—'}</div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Gerekçe</div>
                    <div className="users-detail-field-value">{user.lastBan.reason ?? '—'}</div>
                  </div>
                </div>
              </DataCard>
            ) : null}
            <DataCard title="Hesap düzenle">
              <div className="users-form-group">
                <label>Email</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
              <div className="users-form-group">
                <label>Durum</label>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                  <option value="">—</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="BANNED">BANNED</option>
                </select>
              </div>
              <div className="users-form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={editEmailVerified}
                    onChange={(e) => setEditEmailVerified(e.target.checked)}
                  />{' '}
                  Email doğrulu
                </label>
              </div>
              <div className="users-form-actions">
                <Button onClick={handleSaveUser} disabled={saving}>
                  Kaydet
                </Button>
              </div>
            </DataCard>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="users-detail-grid users-detail-grid--profile">
            <DataCard title="Profil detayı">
              {user.profile ? (
                <div className="users-detail-fields">
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Profil ID</div>
                    <div className="users-detail-field-value users-id-value" title={user.profile.id}>
                      {user.profile.id}
                    </div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">User ID</div>
                    <div className="users-detail-field-value users-id-value" title={user.profile.userId}>
                      {user.profile.userId}
                    </div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Görünen ad</div>
                    <div className="users-detail-field-value">{user.profile.displayName ?? '—'}</div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Kullanıcı adı</div>
                    <div className="users-detail-field-value">{user.profile.userName ?? '—'}</div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Ülke</div>
                    <div className="users-detail-field-value">{user.profile.country ?? '—'}</div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Doğum tarihi</div>
                    <div className="users-detail-field-value">{user.profile.birthDate ?? '—'}</div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Bio</div>
                    <div className="users-detail-field-value">{user.profile.bio ?? '—'}</div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Gönderi sayısı</div>
                    <div className="users-detail-field-value tabular-nums">{user.profile.postsCount}</div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Trust sayıları</div>
                    <div className="users-detail-field-value tabular-nums">
                      {user.profile.trustCount} / {user.profile.trusterCount}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="users-detail-field-value">Profil kaydı yok.</p>
              )}
            </DataCard>
            <DataCard title="Profil resmi">
              {loadingTab ? (
                <LoadingSpinner fullScreen={false} />
              ) : avatar === undefined ? (
                <p className="users-detail-field-value">Yükleniyor…</p>
              ) : avatar ? (
                <div className="users-detail-fields">
                  <div className="users-detail-avatar-preview">
                    <img src={avatar.imageUrl} alt="Avatar" className="users-detail-avatar-img" />
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Avatar ID</div>
                    <div className="users-detail-field-value users-id-value" title={avatar.id}>
                      {avatar.id}
                    </div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Aktif</div>
                    <div className="users-detail-field-value">{avatar.isActive ? 'Evet' : 'Hayır'}</div>
                  </div>
                  <div className="users-form-group">
                    <label>Resim URL</label>
                    <input
                      type="url"
                      value={avatarImageUrl}
                      onChange={(e) => setAvatarImageUrl(e.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                  <div className="users-form-group">
                    <label>Aktif yapılacak avatar ID</label>
                    <input
                      type="text"
                      value={avatarActiveId ?? ''}
                      onChange={(e) => setAvatarActiveId(e.target.value || null)}
                      placeholder="Opsiyonel"
                    />
                  </div>
                  <div className="users-form-actions">
                    <Button onClick={handleUpdateAvatar} disabled={saving}>
                      Güncelle
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="users-detail-fields">
                  <p className="users-detail-field-value">Profil resmi yok.</p>
                  <div className="users-form-group">
                    <label>Resim URL</label>
                    <input
                      type="url"
                      value={avatarImageUrl}
                      onChange={(e) => setAvatarImageUrl(e.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                  <div className="users-form-actions">
                    <Button onClick={handleCreateAvatar} disabled={saving || !avatarImageUrl.trim()}>
                      Ekle
                    </Button>
                  </div>
                </div>
              )}
            </DataCard>
          </div>
        )}

        {activeTab === 'roles' && (
          <DataCard title="Rolleri düzenle">
            <div className="users-form-group">
              <label>Roller (virgülle ayırın)</label>
              <input
                type="text"
                value={editRoles}
                onChange={(e) => setEditRoles(e.target.value)}
                placeholder="ADMIN, USER, MODERATOR"
              />
            </div>
            <div className="users-form-actions">
              <Button onClick={handleSaveRoles} disabled={saving}>
                Rolleri güncelle
              </Button>
            </div>
          </DataCard>
        )}

        {activeTab === 'events' && (
          <DataCard
            title="Katıldığı etkinlikler"
            action={
              <Link to="/events" className="users-link">
                Tüm etkinlikler
              </Link>
            }
          >
            {loadingTab ? (
              <LoadingSpinner fullScreen={false} />
            ) : userEvents.length === 0 ? (
              <p className="users-detail-field-value">Kayıt yok</p>
            ) : (
              <>
                <div className="users-table-wrap">
                  <table className="users-table">
<thead>
                    <tr>
                        <th>Event ID</th>
                        <th>Etkinlik</th>
                        <th>Durum</th>
                        <th>Başlangıç</th>
                        <th>Bitiş</th>
                        <th>Gönderi</th>
                        <th>Beğeni</th>
                        <th>Katılım</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userEvents.map((e) => (
                        <tr key={e.id}>
                          <td className="users-id-cell" title={e.eventId}>
                            {e.eventId}
                          </td>
                          <td>
                            <Link to={`/events?highlight=${e.eventId}`} className="users-link">
                              {e.eventTitle ?? e.eventId}
                            </Link>
                          </td>
                          <td>{e.eventStatus ?? '—'}</td>
                          <td>{e.eventStartDate ? new Date(e.eventStartDate).toLocaleDateString('tr-TR') : '—'}</td>
                          <td>{e.eventEndDate ? new Date(e.eventEndDate).toLocaleDateString('tr-TR') : '—'}</td>
                          <td className="tabular-nums">{e.eventPostsCount}</td>
                          <td className="tabular-nums">{e.eventLikesReceived}</td>
                          <td className="tabular-nums">{e.totalParticipated}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {eventsPagination && eventsPagination.total > eventsPagination.limit && (
                  <p className="users-pagination-info">
                    Toplam {eventsPagination.total} kayıt (gösterilen: {userEvents.length})
                  </p>
                )}
              </>
            )}
          </DataCard>
        )}

        {activeTab === 'posts' && (
          <DataCard
            title="Kullanıcının postları"
            action={
              <Link to="/content/posts" className="users-link">
                Tüm postlar
              </Link>
            }
          >
            {loadingTab ? (
              <LoadingSpinner fullScreen={false} />
            ) : userPosts.length === 0 ? (
              <p className="users-detail-field-value">Kayıt yok</p>
            ) : (
              <>
                <div className="users-table-wrap">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Başlık</th>
                        <th>Tür</th>
                        <th>Beğeni</th>
                        <th>Yorum</th>
                        <th>Oluşturulma</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {userPosts.map((p) => (
                        <tr key={p.id}>
                          <td title={p.title}>
                            {p.title.length > 50 ? p.title.slice(0, 50) + '…' : p.title}
                          </td>
                          <td>{p.type}</td>
                          <td className="tabular-nums">{p.likesCount}</td>
                          <td className="tabular-nums">{p.commentsCount}</td>
                          <td>{p.createdAt ? new Date(p.createdAt).toLocaleDateString('tr-TR') : '—'}</td>
                          <td>
                            <Link to={`/content/posts/${p.id}`} className="users-link">
                              Post detay
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {postsPagination && postsPagination.total > postsPagination.limit && (
                  <p className="users-pagination-info">
                    Toplam {postsPagination.total} kayıt (gösterilen: {userPosts.length})
                  </p>
                )}
              </>
            )}
          </DataCard>
        )}

        {activeTab === 'badges' && (
          <div className="users-detail-grid">
            <DataCard title="Rozetler" className="users-detail-edit-card">
              <div className="users-form-group">
                <label>Yeni rozet ver (Badge ID)</label>
                <input
                  type="text"
                  value={grantBadgeId}
                  onChange={(e) => setGrantBadgeId(e.target.value)}
                  placeholder="UUID"
                />
              </div>
              <div className="users-form-actions">
                <Button onClick={handleGrantBadge} disabled={saving || !grantBadgeId.trim()}>
                  Rozet ver
                </Button>
              </div>
            </DataCard>
            <DataCard title="Kullanıcının rozetleri" className="users-detail-edit-card">
              {loadingTab ? (
                <LoadingSpinner fullScreen={false} />
              ) : userBadges.length === 0 ? (
                <p className="users-detail-field-value">Kayıt yok</p>
              ) : (
                <>
                  <div className="users-table-wrap">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>UserBadge ID</th>
                          <th>Badge ID</th>
                          <th>Rozet</th>
                          <th>Kategori</th>
                          <th>Görünür</th>
                          <th>Claimed</th>
                          <th>Tarih</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {userBadges.map((b) => (
                          <tr key={b.id}>
                            <td className="users-id-cell" title={b.id}>
                              {b.id}
                            </td>
                            <td className="users-id-cell" title={b.badgeId}>
                              {b.badgeId}
                            </td>
                            <td>
                              {b.badgeImageUrl ? (
                                <img src={b.badgeImageUrl} alt="" className="users-badge-thumb" />
                              ) : null}
                              {b.badgeName}
                            </td>
                            <td>{b.badgeCategoryName ?? '—'}</td>
                            <td>{b.isVisible ? 'Evet' : 'Hayır'}</td>
                            <td>{b.claimed ? new Date(b.claimedAt!).toLocaleDateString('tr-TR') : '—'}</td>
                            <td>{new Date(b.createdAt).toLocaleDateString('tr-TR')}</td>
                            <td>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleRevokeBadge(b.id)}
                                disabled={saving}
                              >
                                Al
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {badgesPagination && badgesPagination.total > badgesPagination.limit && (
                    <p className="users-pagination-info">
                      Toplam {badgesPagination.total} kayıt
                    </p>
                  )}
                </>
              )}
            </DataCard>
          </div>
        )}

        {activeTab === 'wallet' && (
          <div className="users-detail-grid users-detail-grid--wallet">
            {/* Özet: GET /admin/users/:id/wallet response'undan türetilen toplamlar */}
            {!loadingTab && wallet.length > 0 && (
              <DataCard title="Cüzdan özeti (response’tan)">
                <div className="users-detail-fields">
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Cüzdan sayısı</div>
                    <div className="users-detail-field-value tabular-nums">{wallet.length}</div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Toplam bakiye</div>
                    <div className="users-detail-field-value tabular-nums">
                      {wallet.reduce((s, w) => s + (w.balance ?? 0), 0)}
                    </div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Toplam kilitli</div>
                    <div className="users-detail-field-value tabular-nums">
                      {wallet.reduce((s, w) => s + (w.lockedBalance ?? 0), 0)}
                    </div>
                  </div>
                </div>
              </DataCard>
            )}
            <DataCard
              title="Cüzdanlar"
              action={
                <Link to="/crypto/wallets" className="users-link">
                  Tüm cüzdanlar
                </Link>
              }
            >
              {loadingTab ? (
                <LoadingSpinner fullScreen={false} />
              ) : wallet.length === 0 ? (
                <p className="users-detail-field-value">Kayıt yok</p>
              ) : (
                <div className="users-table-wrap">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Wallet ID</th>
                        <th>User ID</th>
                        <th>Provider</th>
                        <th>Adres</th>
                        <th>Bakiye</th>
                        <th>Kilitli</th>
                        <th>Bağlı</th>
                        <th>Oluşturulma</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wallet.map((w) => (
                        <tr key={w.id}>
                          <td className="users-id-cell" title={w.id}>
                            {w.id}
                          </td>
                          <td className="users-id-cell" title={w.userId}>
                            {w.userId}
                          </td>
                          <td>{w.provider}</td>
                          <td className="users-cell-truncate" title={w.publicAddress}>
                            {w.publicAddress}
                          </td>
                          <td className="tabular-nums">{w.balance}</td>
                          <td className="tabular-nums">{w.lockedBalance}</td>
                          <td>{w.isConnected ? 'Evet' : 'Hayır'}</td>
                          <td>{w.createdAt ? new Date(w.createdAt).toLocaleString('tr-TR') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DataCard>
            <DataCard title="Tips özeti">
              {loadingTab ? (
                <LoadingSpinner fullScreen={false} />
              ) : tipsSummary ? (
                <div className="users-detail-fields">
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Toplam gönderilen</div>
                    <div className="users-detail-field-value tabular-nums">{tipsSummary.totalSent}</div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Toplam alınan</div>
                    <div className="users-detail-field-value tabular-nums">{tipsSummary.totalReceived}</div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Gönderi sayısı</div>
                    <div className="users-detail-field-value tabular-nums">{tipsSummary.sentCount}</div>
                  </div>
                  <div className="users-detail-field">
                    <div className="users-detail-field-label">Alım sayısı</div>
                    <div className="users-detail-field-value tabular-nums">{tipsSummary.receivedCount}</div>
                  </div>
                </div>
              ) : (
                <p className="users-detail-field-value">Veri yok</p>
              )}
            </DataCard>
            <DataCard title="Tips işlemleri" className="users-detail-edit-card">
              {loadingTab ? (
                <LoadingSpinner fullScreen={false} />
              ) : tipsTransactions.length === 0 ? (
                <p className="users-detail-field-value">Kayıt yok</p>
              ) : (
                <>
                  <div className="users-table-wrap">
                    <table className="users-table">
<thead>
                      <tr>
                          <th>İşlem ID</th>
                          <th>Tarih</th>
                          <th>Gönderen</th>
                          <th>Alan</th>
                          <th>Tutar</th>
                          <th>Sebep</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tipsTransactions.map((t) => (
                          <tr key={t.id}>
                            <td className="users-id-cell" title={t.id}>
                              {t.id}
                            </td>
                            <td>{new Date(t.createdAt).toLocaleString('tr-TR')}</td>
                            <td>{t.fromUserDisplayName ?? t.fromUserEmail ?? t.fromUserId}</td>
                            <td>{t.toUserDisplayName ?? t.toUserEmail ?? t.toUserId}</td>
                            <td className="tabular-nums">{t.amount}</td>
                            <td>{t.reason ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {tipsPagination && tipsPagination.total > tipsPagination.limit && (
                    <p className="users-pagination-info">
                      Toplam {tipsPagination.total} kayıt (gösterilen: {tipsTransactions.length})
                    </p>
                  )}
                </>
              )}
            </DataCard>
          </div>
        )}

        {activeTab === 'moderation' && (
          <DataCard title="Moderation geçmişi">
            {loadingTab ? (
              <LoadingSpinner fullScreen={false} />
            ) : moderation.length === 0 ? (
              <p className="users-detail-field-value">Kayıt yok</p>
            ) : (
              <div className="users-table-wrap">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Kayıt ID</th>
                      <th>Tarih</th>
                      <th>Tür</th>
                      <th>Moderatör ID</th>
                      <th>Moderatör</th>
                      <th>Gerekçe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moderation.map((m) => (
                      <tr key={m.id}>
                        <td className="users-id-cell" title={m.id}>
                          {m.id}
                        </td>
                        <td>{new Date(m.createdAt).toLocaleString('tr-TR')}</td>
                        <td>{m.actionType}</td>
                        <td className="users-id-cell" title={m.moderatorId}>
                          {m.moderatorId}
                        </td>
                        <td>{m.moderatorEmail ?? '—'}</td>
                        <td>{m.reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>
        )}

        {activeTab === 'login' && (
          <DataCard title="Giriş denemeleri">
            {loadingTab ? (
              <LoadingSpinner fullScreen={false} />
            ) : loginAttempts.length === 0 ? (
              <p className="users-detail-field-value">Kayıt yok</p>
            ) : (
              <div className="users-table-wrap">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Kayıt ID</th>
                      <th>Tarih</th>
                      <th>IP</th>
                      <th>Durum</th>
                      <th>User-Agent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginAttempts.map((a) => (
                      <tr key={a.id}>
                        <td className="users-id-cell" title={a.id}>
                          {a.id}
                        </td>
                        <td>{new Date(a.attemptedAt).toLocaleString('tr-TR')}</td>
                        <td>{a.ipAddress}</td>
                        <td>
                          <span className={`users-badge users-badge-${a.status === 'SUCCESS' ? 'success' : 'neutral'}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="users-cell-truncate" title={a.userAgent}>
                          {a.userAgent?.slice(0, 50)}…
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>
        )}
      </div>
    </div>
  );
}

export default UserDetail;
