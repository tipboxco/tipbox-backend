import { useState, useRef, useMemo } from 'react';
import { Select, Avatar, Typography, Space, Spin } from 'antd';
import { UserOutlined, SearchOutlined } from '@ant-design/icons';
import { fetchUsers } from '../api/admin-users';
import type { AdminUserListItem } from '../types/admin';

const { Text } = Typography;

interface UserSearchSelectProps {
  value?: string;
  onChange?: (userId: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

function UserSearchSelect({
  value,
  onChange,
  placeholder = 'Search user (min 2 chars)...',
  style,
  disabled,
}: UserSearchSelectProps) {
  const [options, setOptions] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, AdminUserListItem>>(new Map());

  const doSearch = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text || text.length < 2) {
      setOptions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchUsers({ search: text, limit: 10 });
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

  const renderOption = (user: AdminUserListItem) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
      <Avatar
        size={32}
        src={user.avatarUrl}
        icon={!user.avatarUrl ? <UserOutlined /> : undefined}
        style={{ flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text strong style={{ fontSize: 13 }}>
            {user.displayName || user.email || 'Unknown'}
          </Text>
        </div>
        <Space size={6}>
          {user.userName && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              @{user.userName}
            </Text>
          )}
          {user.email && (
            <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
              {user.email}
            </Text>
          )}
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
              <UserOutlined />
              <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{value}</Text>
            </div>
          ),
        });
      }
    }

    options.forEach((user) => {
      result.push({ key: user.id, value: user.id, label: renderOption(user) });
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
      popupMatchSelectWidth={420}
    />
  );
}

export default UserSearchSelect;
