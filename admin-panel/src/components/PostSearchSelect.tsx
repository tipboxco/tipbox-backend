import { useState, useRef, useMemo } from 'react';
import { Select, Avatar, Typography, Space, Spin, Tag } from 'antd';
import { UserOutlined, FileTextOutlined, SearchOutlined } from '@ant-design/icons';
import { searchPosts } from '../api/admin-content';
import type { AdminPostSearchItem } from '../types/admin';

const { Text } = Typography;

interface PostSearchSelectProps {
  value?: string;
  onChange?: (postId: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

function PostSearchSelect({
  value,
  onChange,
  placeholder = 'Search post (min 3 chars)...',
  style,
}: PostSearchSelectProps) {
  const [options, setOptions] = useState<AdminPostSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, AdminPostSearchItem>>(new Map());

  const doSearch = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text || text.length < 3) {
      setOptions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchPosts(text, 10);
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

  const renderOption = (post: AdminPostSearchItem) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '6px 0' }}>
      <Avatar
        size={40}
        src={post.avatarUrl}
        icon={!post.avatarUrl ? <UserOutlined /> : undefined}
        style={{ flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text strong style={{ fontSize: 14 }}>
            {post.title}
          </Text>
          <Tag
            color="processing"
            style={{ fontSize: 11, lineHeight: '18px', padding: '0 4px', margin: 0 }}
          >
            {post.type}
          </Tag>
        </div>
        <Text
          type="secondary"
          style={{ fontSize: 13, display: 'block', marginBottom: 2 }}
          ellipsis
        >
          {post.bodyExcerpt}
        </Text>
        <Space size={6}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {post.userDisplayName ?? post.userName ?? '—'}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>·</Text>
          <Text
            type="secondary"
            style={{ fontSize: 12, fontFamily: 'monospace' }}
          >
            {post.id.slice(0, 10)}...
          </Text>
        </Space>
      </div>
    </div>
  );

  // Build options for Select
  const selectOptions = useMemo(() => {
    const result: { key: string; value: string; label: React.ReactNode }[] = [];

    // If there's a selected value not in search results, add it from cache
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
              <FileTextOutlined />
              <Text style={{ fontSize: 13 }}>{value}</Text>
            </div>
          ),
        });
      }
    }

    options.forEach((post) => {
      result.push({ key: post.id, value: post.id, label: renderOption(post) });
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
      notFoundContent={
        loading ? (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <Spin size="small" />
            <span style={{ marginLeft: 8, color: '#999' }}>Searching...</span>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 16, color: '#999' }}>
            <SearchOutlined style={{ fontSize: 20, display: 'block', marginBottom: 8 }} />
            Type at least 3 characters to search
          </div>
        )
      }
      style={{ minWidth: 400, ...style }}
      allowClear
      options={selectOptions}
      optionFilterProp="key"
      listHeight={350}
      popupMatchSelectWidth={480}
    />
  );
}

export default PostSearchSelect;
