import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Table, Input, Empty, Alert, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { TagsOutlined, SearchOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { fetchContentTags } from '../../api/admin-content';
import type { AdminContentTagListItem } from '../../types/admin';

const { Text } = Typography;
const PAGE_SIZE = 50;

function TagsCategories() {
  const [tags, setTags] = useState<AdminContentTagListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchContentTags({
          limit: PAGE_SIZE,
          offset: 0,
          search: search || undefined,
        });
        if (!cancelled) setTags(res.data ?? []);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Tag listesi yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search]);

  const columns: ColumnsType<AdminContentTagListItem> = [
    {
      title: 'Tag',
      dataIndex: 'tag',
      key: 'tag',
    },
    {
      title: 'Kullanım sayısı',
      dataIndex: 'count',
      key: 'count',
      align: 'right',
      render: (count) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tags & Categories"
        description="Manage content tags and categories"
        icon={<TagsOutlined />}
      />

      {error && (
        <Alert
          message="Hata"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 24 }}
        />
      )}

      <Card
        bordered
        title="Kullanılan tag'ler"
        extra={
          <Input
            placeholder="Tag ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            allowClear
          />
        }
        style={{ marginBottom: 16 }}
      >
        <Table
          columns={columns}
          dataSource={tags}
          rowKey="tag"
          loading={loading}
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Tag bulunamadı. İçeriklerde kullanılan tag'ler burada listelenir."
              />
            ),
          }}
        />
      </Card>

      <Card bordered title="Kategoriler">
        <Text type="secondary">
          Kategori, ana kategori ve alt kategori yönetimi için{' '}
          <Link to="/products/categories" style={{ color: 'inherit', textDecoration: 'underline' }}>
            Ürün Kategorileri
          </Link>{' '}
          sayfasını kullanın.
        </Text>
      </Card>
    </div>
  );
}

export default TagsCategories;
