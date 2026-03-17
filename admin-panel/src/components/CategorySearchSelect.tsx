import { useState, useEffect, useMemo } from 'react';
import { Select, Typography, Spin } from 'antd';
import { AppstoreOutlined, SearchOutlined } from '@ant-design/icons';
import { fetchSubCategories, type SubCategoryListItem } from '../api/admin-categories';

const { Text } = Typography;

interface CategorySearchSelectProps {
  value?: string;
  onChange?: (categoryId: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

function CategorySearchSelect({
  value,
  onChange,
  placeholder = 'Select sub-category...',
  style,
  disabled,
}: CategorySearchSelectProps) {
  const [allCategories, setAllCategories] = useState<SubCategoryListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    setLoading(true);
    fetchSubCategories({ limit: 200, sort: 'name', order: 'asc' })
      .then((res) => {
        setAllCategories(res.data ?? []);
        setLoaded(true);
      })
      .catch(() => {
        setAllCategories([]);
      })
      .finally(() => setLoading(false));
  }, [loaded]);

  const handleChange = (selectedValue: string) => {
    if (!selectedValue) {
      onChange?.('');
      return;
    }
    onChange?.(selectedValue);
  };

  const selectOptions = useMemo(() => {
    return allCategories.map((cat) => ({
      key: cat.id,
      value: cat.id,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
          <AppstoreOutlined style={{ fontSize: 14, color: '#8c8c8c' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13 }}>{cat.name}</Text>
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
              ({cat.mainCategoryName})
            </Text>
          </div>
        </div>
      ),
      searchText: `${cat.name} ${cat.mainCategoryName}`,
    }));
  }, [allCategories]);

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
      filterOption={(input, option) => {
        const searchText = (option as { searchText?: string })?.searchText ?? '';
        return searchText.toLowerCase().includes(input.toLowerCase());
      }}
      onChange={handleChange}
      loading={loading}
      disabled={disabled}
      notFoundContent={
        loading ? (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <Spin size="small" />
            <span style={{ marginLeft: 8, color: '#999' }}>Loading categories...</span>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 16, color: '#999' }}>
            No categories found
          </div>
        )
      }
      style={{ minWidth: 300, ...style }}
      allowClear
      options={selectOptions}
      optionFilterProp="searchText"
      listHeight={350}
      popupMatchSelectWidth={400}
    />
  );
}

export default CategorySearchSelect;
