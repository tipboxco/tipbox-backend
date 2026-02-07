import './DataCard.css';

interface DataCardProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

function DataCard({ title, children, action, className = '' }: DataCardProps) {
  return (
    <div className={`data-card fade-in ${className}`}>
      <div className="data-card-header">
        <h3 className="data-card-title">{title}</h3>
        {action && <div className="data-card-action">{action}</div>}
      </div>
      <div className="data-card-body">{children}</div>
    </div>
  );
}

export default DataCard;
