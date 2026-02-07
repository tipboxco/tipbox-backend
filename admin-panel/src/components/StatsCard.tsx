import './StatsCard.css';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'accent' | 'success' | 'danger' | 'neutral';
}

function StatsCard({ title, value, icon, trend, color = 'accent' }: StatsCardProps) {
  return (
    <div className={`stats-card stats-card-${color} fade-in-up`}>
      <div className="stats-card-header">
        <div className={`stats-icon stats-icon-${color}`}>
          <i className={`fa-solid ${icon}`}></i>
        </div>
        {trend && (
          <div className={`stats-trend ${trend.isPositive ? 'positive' : 'negative'}`}>
            <i className={`fa-solid fa-arrow-${trend.isPositive ? 'up' : 'down'}`}></i>
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
      <div className="stats-card-body">
        <h3 className="stats-value">{value}</h3>
        <p className="stats-title">{title}</p>
      </div>
    </div>
  );
}

export default StatsCard;
