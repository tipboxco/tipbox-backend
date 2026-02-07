import { Link } from 'react-router-dom';
import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: string;
  /** Sol üstte gösterilecek geri linki (örn. listeye dön) */
  backTo?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

function PageHeader({ title, description, icon, backTo, backLabel = 'Listeye dön', actions }: PageHeaderProps) {
  return (
    <div className="page-header fade-in">
      <div className="page-header-content">
        {backTo && (
          <Link to={backTo} className="page-header-back">
            <i className="fa-solid fa-arrow-left" aria-hidden />
            <span>{backLabel}</span>
          </Link>
        )}
        <div className="page-header-text">
          {icon && <i className={`fa-solid ${icon} page-icon`}></i>}
          <div>
            <h1 className="page-title">{title}</h1>
            {description && <p className="page-description">{description}</p>}
          </div>
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </div>
  );
}

export default PageHeader;
