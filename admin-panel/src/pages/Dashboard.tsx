import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatsCard from '../components/StatsCard';
import DataCard from '../components/DataCard';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchAdminStats } from '../api/admin-stats';
import type { AdminStatsResponse } from '../types/admin';
import './Dashboard.css';

const recentActivity = [
  { id: 1, type: 'user', message: 'New user registered: johndoe@example.com', time: '2 min ago', icon: 'fa-user-plus' },
  { id: 2, type: 'event', message: 'Event "Tech Summit 2024" published', time: '15 min ago', icon: 'fa-calendar-check' },
  { id: 3, type: 'payment', message: 'Payment received: ₺1,250', time: '1 hour ago', icon: 'fa-credit-card' },
  { id: 4, type: 'brand', message: 'Brand "TechCorp" verified', time: '2 hours ago', icon: 'fa-badge-check' },
  { id: 5, type: 'content', message: 'New content published by @expert_user', time: '3 hours ago', icon: 'fa-file-lines' },
];

const quickActions = [
  { title: 'Create Event', icon: 'fa-calendar-plus', color: 'accent' },
  { title: 'Add User', icon: 'fa-user-plus', color: 'success' },
  { title: 'View Reports', icon: 'fa-chart-bar', color: 'neutral' },
  { title: 'Settings', icon: 'fa-gear', color: 'neutral' },
];

const systemStatus = [
  { name: 'API Server', status: 'online', uptime: '99.9%' },
  { name: 'Database', status: 'online', uptime: '100%' },
  { name: 'Cache Server', status: 'online', uptime: '98.5%' },
  { name: 'Payment Gateway', status: 'online', uptime: '99.2%' },
];

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAdminStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'İstatistikler yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="dashboard">
      {/* Welcome Header */}
      <div className="dashboard-header fade-in-up">
        <div>
          <h1 className="dashboard-title">Welcome to Tipbox Admin</h1>
          <p className="dashboard-subtitle">
            Monitor and manage your platform from this central hub
          </p>
        </div>
        <div className="dashboard-date">
          <i className="fa-solid fa-calendar"></i>
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {error && (
        <div className="dashboard-error" style={{ padding: 12, marginBottom: 16, background: 'rgba(239,68,68,0.15)', borderRadius: 8, color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* Stats Grid — GET /admin/stats */}
      <div className="stats-grid">
        {loading ? (
          <LoadingSpinner fullScreen={false} />
        ) : stats ? (
          <>
            <StatsCard title="Kullanıcılar" value={stats.users} icon="fa-users" color="accent" />
            <StatsCard title="Gönderiler" value={stats.posts} icon="fa-file-lines" color="success" />
            <StatsCard title="Yasaklı Kullanıcılar" value={stats.bannedUsers} icon="fa-user-slash" color="danger" />
            <StatsCard title="Admin Log Kayıtları" value={stats.adminLogs} icon="fa-clock-rotate-left" color="neutral" />
          </>
        ) : null}
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        {/* Recent Activity */}
        <DataCard
          title="Recent Activity"
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/system/logs')}>
              Admin Loglar
            </Button>
          }
        >
          <div className="activity-list">
            {recentActivity.map((activity, index) => (
              <div
                key={activity.id}
                className="activity-item"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className={`activity-icon activity-icon-${activity.type}`}>
                  <i className={`fa-solid ${activity.icon}`}></i>
                </div>
                <div className="activity-content">
                  <p className="activity-message">{activity.message}</p>
                  <span className="activity-time">{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </DataCard>

        {/* Quick Actions */}
        <DataCard title="Quick Actions">
          <div className="quick-actions-grid">
            {quickActions.map((action, index) => (
              <button
                key={action.title}
                className={`quick-action-btn quick-action-${action.color}`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <i className={`fa-solid ${action.icon}`}></i>
                <span>{action.title}</span>
              </button>
            ))}
          </div>
        </DataCard>

        {/* System Status */}
        <DataCard
          title="System Status"
          action={
            <div className="status-indicator">
              <span className="status-dot status-dot-online"></span>
              <span>All Systems Operational</span>
            </div>
          }
        >
          <div className="system-status-list">
            {systemStatus.map((system, index) => (
              <div
                key={system.name}
                className="system-status-item"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="system-info">
                  <span className="system-name">{system.name}</span>
                  <span className="system-uptime">{system.uptime} uptime</span>
                </div>
                <div className="system-status">
                  <span className={`status-badge status-badge-${system.status}`}>
                    {system.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </DataCard>
      </div>
    </div>
  );
}

export default Dashboard;
