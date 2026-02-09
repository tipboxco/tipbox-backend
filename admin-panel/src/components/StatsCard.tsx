import './StatsCard.css';

export type StatsCardVariant = 'default' | 'hero' | 'compact' | 'minimal' | 'pulse';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  /** İkincil bilgi (örn. "toplam", "% yasaklı") */
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'accent' | 'success' | 'danger' | 'neutral' | 'info';
  variant?: StatsCardVariant;
}

function StatsCard({
  title,
  value,
  icon,
  subtitle,
  trend,
  color = 'accent',
  variant = 'default',
}: StatsCardProps) {
  return (
    <div
      className={`stats-card stats-card-${color} stats-card-variant-${variant} fade-in-up`}
      data-variant={variant}
    >
      <div className={`stats-icon stats-icon-${color}`}>
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <div className="stats-card-body">
        <h3 className="stats-value">{value}</h3>
        <p className="stats-title">{title}</p>
        {subtitle && <span className="stats-subtitle">{subtitle}</span>}
      </div>
      {trend && (
        <div className={`stats-trend ${trend.isPositive ? 'positive' : 'negative'}`}>
          <i className={`fa-solid fa-arrow-${trend.isPositive ? 'up' : 'down'}`}></i>
          <span>{Math.abs(trend.value)}%</span>
        </div>
      )}
    </div>
  );
}

export default StatsCard;
