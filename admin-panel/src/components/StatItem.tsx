import { Skeleton } from 'antd';
import type { ReactNode } from 'react';

export interface StatItemProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  valueColor?: string;
  loading?: boolean;
}

export interface StatItemData {
  label: string;
  value: number | string;
  icon?: ReactNode;
  valueColor?: string;
}

function StatItem({ label, value, icon, valueColor, loading = false }: StatItemProps) {
  if (loading) {
    return (
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <Skeleton.Input active size="small" style={{ width: 60, height: 20 }} />
        <Skeleton.Input active size="small" style={{ width: 80, height: 13 }} />
      </div>
    );
  }

  const formattedValue =
    typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <div
      style={{
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {icon && (
          <span
            style={{
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              color: valueColor || 'inherit',
            }}
          >
            {icon}
          </span>
        )}
        <span
          style={{
            fontSize: 23,
            fontWeight: 700,
            lineHeight: 1.2,
            color: valueColor || 'inherit',
          }}
        >
          {formattedValue}
        </span>
      </div>
      <div
        style={{
          fontSize: 15,
          lineHeight: 1.4,
          color: 'var(--ant-color-text-secondary)',
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default StatItem;
