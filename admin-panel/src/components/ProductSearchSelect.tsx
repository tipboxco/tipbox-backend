import { useState, useRef, useMemo } from 'react';
import { Select, Avatar, Typography, Space, Spin } from 'antd';
import { ShoppingOutlined, SearchOutlined } from '@ant-design/icons';
import { fetchProducts, type AdminProductListItem } from '../api/admin-products';

const { Text } = Typography;

interface ProductSearchSelectProps {
  value?: string;
  onChange?: (productId: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

function ProductSearchSelect({
  value,
  onChange,
  placeholder = 'Search product (min 2 chars)...',
  style,
  disabled,
}: ProductSearchSelectProps) {
  const [options, setOptions] = useState<AdminProductListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, AdminProductListItem>>(new Map());

  const doSearch = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text || text.length < 2) {
      setOptions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchProducts({ search: text, limit: 10 });
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

  const renderOption = (product: AdminProductListItem) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
      <Avatar
        size={36}
        shape="square"
        src={product.imageUrl || product.thumbnail}
        icon={!product.imageUrl && !product.thumbnail ? <ShoppingOutlined /> : undefined}
        style={{ flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
        <Text strong style={{ fontSize: 13 }} ellipsis>
          {product.name}
        </Text>
        <Space size={6}>
          {product.categoryName && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {product.categoryName}
            </Text>
          )}
          <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
            {product.id.length > 16 ? product.id.slice(0, 16) + '...' : product.id}
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
              <ShoppingOutlined />
              <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{value}</Text>
            </div>
          ),
        });
      }
    }

    options.forEach((product) => {
      result.push({ key: product.id, value: product.id, label: renderOption(product) });
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

export default ProductSearchSelect;
