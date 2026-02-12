import { Link } from 'react-router-dom';
import { Space, Typography, Button, Grid, theme } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import StatItem from './StatItem';
import type { StatItemData } from './StatItem';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
  stats?: StatItemData[];
  statsLoading?: boolean;
}

function PageHeader({
  title,
  description,
  icon,
  backTo,
  backLabel = 'Back to list',
  actions,
  stats,
  statsLoading = false,
}: PageHeaderProps) {
  const screens = useBreakpoint();
  const { token } = theme.useToken();

  // Desktop (≥lg): stats on same line as title
  // Tablet/Mobile (<lg): stats below title
  const isDesktop = screens.lg;

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
          flexDirection: isDesktop && stats ? 'row' : 'column',
          justifyContent: 'space-between',
          alignItems: isDesktop && stats ? 'center' : 'flex-start',
          gap: 16,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <Space orientation="vertical" size={4}>
              <Space align="center" size={12}>
                {icon && <span style={{ fontSize: 28 }}>{icon}</span>}
                <Title level={2} style={{ margin: 0, fontWeight: 700 }}>
                  {title}
                </Title>
              </Space>
              {description && (
                <Text type="secondary" style={{ fontSize: 16 }}>
                  {description}
                </Text>
              )}
            </Space>
            {actions && !stats && <div>{actions}</div>}
          </div>
        </div>

        {stats && stats.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0,
              alignItems: 'center',
            }}
          >
            {stats.map((stat, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
                <StatItem
                  label={stat.label}
                  value={stat.value}
                  icon={stat.icon}
                  valueColor={stat.valueColor}
                  loading={statsLoading}
                />
                {index < stats.length - 1 && (
                  <div
                    style={{
                      width: 1,
                      height: 40,
                      background: token.colorBorder,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {actions && stats && <div>{actions}</div>}
      </div>
    </div>
  );
}

export default PageHeader;
