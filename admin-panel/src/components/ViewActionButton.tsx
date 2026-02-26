import { Link } from 'react-router-dom';
import { EyeOutlined } from '@ant-design/icons';

interface ViewActionButtonProps {
  to: string;
  label?: string;
}

export default function ViewActionButton({ to, label = 'View' }: ViewActionButtonProps) {
  return (
    <Link to={to} className="view-action-badge">
      <EyeOutlined />
      {label}
    </Link>
  );
}
