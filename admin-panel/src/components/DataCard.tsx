import './DataCard.css';

export type DataCardVariant = 'default' | 'compact' | 'bordered' | 'elevated';

interface DataCardProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Görsel varyant: default, compact (daha az padding), bordered (sol çizgi), elevated (gölge) */
  variant?: DataCardVariant;
}

function DataCard({
  title,
  children,
  action,
  className = '',
  variant = 'default',
}: DataCardProps) {
  return (
    <div
      className={`data-card data-card-variant-${variant} fade-in ${className}`.trim()}
      data-variant={variant}
    >
      <div className="data-card-header">
        <h3 className="data-card-title">{title}</h3>
        {action && <div className="data-card-action">{action}</div>}
      </div>
      <div className="data-card-body">{children}</div>
    </div>
  );
}

export default DataCard;
