import { useState, useRef, useMemo } from 'react';
import { Select, Typography, Tag, Space, Spin } from 'antd';
import { CalendarOutlined, SearchOutlined } from '@ant-design/icons';
import { fetchEvents } from '../api/admin-events';
import type { AdminEventListItem } from '../types/admin';

const { Text } = Typography;

interface EventSearchSelectProps {
  value?: string;
  onChange?: (eventId: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

const statusColors: Record<string, string> = {
  ACTIVE: 'green',
  UPCOMING: 'blue',
  ENDED: 'default',
  DRAFT: 'orange',
};

function EventSearchSelect({
  value,
  onChange,
  placeholder = 'Search event (min 2 chars)...',
  style,
  disabled,
}: EventSearchSelectProps) {
  const [options, setOptions] = useState<AdminEventListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, AdminEventListItem>>(new Map());

  const doSearch = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text || text.length < 2) {
      setOptions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchEvents({ search: text, limit: 10 });
        const items = res.data ?? [];
        items.forEach((item) => cacheRef.current.set(item.id, item));
        setOptions(items);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleChange = (selectedValue: string) => {
    if (!selectedValue) {
      onChange?.('');
      setOptions([]);
      return;
    }
    onChange?.(selectedValue);
  };

  const renderOption = (event: AdminEventListItem) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
      <CalendarOutlined style={{ fontSize: 18, color: '#8c8c8c', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text strong style={{ fontSize: 13 }} ellipsis>
            {event.title}
          </Text>
          <Tag
            color={statusColors[event.status] || 'default'}
            style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}
          >
            {event.status}
          </Tag>
        </div>
        <Space size={6}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
          </Text>
        </Space>
      </div>
    </div>
  );

  const selectOptions = useMemo(() => {
    const result: { key: string; value: string; label: React.ReactNode }[] = [];

    if (value && !options.find((o) => o.id === value)) {
      const cached = cacheRef.current.get(value);
      if (cached) {
        result.push({ key: cached.id, value: cached.id, label: renderOption(cached) });
      } else {
        result.push({
          key: value,
          value,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarOutlined />
              <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{value}</Text>
            </div>
          ),
        });
      }
    }

    options.forEach((event) => {
      result.push({ key: event.id, value: event.id, label: renderOption(event) });
    });

    return result;
  }, [options, value]);

  return (
    <Select
      showSearch
      value={value || undefined}
      placeholder={
        <span>
          <SearchOutlined style={{ marginRight: 6 }} />
          {placeholder}
        </span>
      }
      filterOption={false}
      onSearch={doSearch}
      onChange={handleChange}
      loading={loading}
      disabled={disabled}
      notFoundContent={
        loading ? (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <Spin size="small" />
            <span style={{ marginLeft: 8, color: '#999' }}>Searching...</span>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 16, color: '#999' }}>
            <SearchOutlined style={{ fontSize: 20, display: 'block', marginBottom: 8 }} />
            Type at least 2 characters to search
          </div>
        )
      }
      style={{ minWidth: 300, ...style }}
      allowClear
      options={selectOptions}
      optionFilterProp="key"
      listHeight={350}
      popupMatchSelectWidth={450}
    />
  );
}

export default EventSearchSelect;
