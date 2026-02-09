import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Table, Select, Space, Tag, Button, Empty, Alert } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { FlagOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { fetchUserReports } from '../../api/admin-reports';
import type { AdminUserReportListItem } from '../../types/admin';

const PAGE_SIZE = 20;

function UserReports() {
  const [reports, setReports] = useState<AdminUserReportListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('');
  const [resolved, setResolved] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchUserReports({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          category: category || undefined,
          sort: 'createdAt',
          order: 'desc',
        });
        if (!cancelled) {
          setReports(res.data ?? []);
          if (res.pagination) setPagination(res.pagination);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.offset, category]);

  const filteredReports =
    resolved === ''
      ? reports
      : resolved === 'true'
      ? reports.filter((r) => r.resolved)
      : reports.filter((r) => !r.resolved);

  const columns: ColumnsType<AdminUserReportListItem> = [
    {
      title: 'Tarih',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('tr-TR'),
    },
    {
      title: 'Kategori',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: 'Şikayet edilen',
      key: 'reported',
      render: (_, record) =>
        record.reportedUserDisplayName ??
        record.reportedUserEmail ??
        record.reportedUserId,
    },
    {
      title: 'Şikayet eden',
      key: 'reporter',
      render: (_, record) =>
        record.reporterDisplayName ??
        record.reporterEmail ??
        record.reporterId,
    },
    {
      title: 'Durum',
      dataIndex: 'resolved',
      key: 'resolved',
      render: (resolved) => (
        <Tag color={resolved ? 'success' : 'default'}>
          {resolved ? 'Çözüldü' : 'Bekliyor'}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'action',
      render: (_, record) => (
        <Link to={`/users/reports/${record.id}`}>
          <Button type="link" size="small">
            Detay
          </Button>
        </Link>
      ),
    },
  ];

  const handleTableChange = (pag: TablePaginationConfig) => {
    const newOffset = ((pag.current ?? 1) - 1) * PAGE_SIZE;
    setPagination((prev) => ({ ...prev, offset: newOffset }));
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div>
      <PageHeader
        title="Kullanıcı şikayetleri"
        description="Kullanıcı raporlarını inceleyin ve çözümleyin"
        icon={<FlagOutlined />}
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
        title="Rapor listesi"
        extra={
          <Space>
            <Select
              value={category}
              onChange={(value) => {
                setCategory(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 160 }}
              placeholder="Tüm kategoriler"
            >
              <Select.Option value="">Tüm kategoriler</Select.Option>
              <Select.Option value="SPAM">SPAM</Select.Option>
              <Select.Option value="ABUSE">ABUSE</Select.Option>
              <Select.Option value="OTHER">OTHER</Select.Option>
            </Select>
            <Select
              value={resolved}
              onChange={setResolved}
              style={{ width: 120 }}
              placeholder="Tümü"
            >
              <Select.Option value="">Tümü</Select.Option>
              <Select.Option value="true">Çözüldü</Select.Option>
              <Select.Option value="false">Bekleyen</Select.Option>
            </Select>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredReports}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: PAGE_SIZE,
            total: pagination.total,
            showSizeChanger: false,
            showTotal: (total) => `Toplam ${total} kayıt`,
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Rapor bulunamadı"
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default UserReports;
