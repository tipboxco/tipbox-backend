import { Link } from 'react-router-dom';
import { Space, Typography, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';

const { Title, Text } = Typography;

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
}

function PageHeader({
  title,
  description,
  icon,
  backTo,
  backLabel = 'Back to list',
  actions
}: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 24 }}>
      {backTo && (
        <div style={{ marginBottom: 12 }}>
          <Link to={backTo}>
            <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingLeft: 0 }}>
              {backLabel}
            </Button>
          </Link>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <Space direction="vertical" size={4}>
          <Space align="center" size={12}>
            {icon && <span style={{ fontSize: 24 }}>{icon}</span>}
            <Title level={2} style={{ margin: 0, fontWeight: 700 }}>
              {title}
            </Title>
          </Space>
          {description && (
            <Text type="secondary" style={{ fontSize: 14 }}>
              {description}
            </Text>
          )}
        </Space>
        {actions && <div>{actions}</div>}
      </div>
    </div>
  );
}

export default PageHeader;
