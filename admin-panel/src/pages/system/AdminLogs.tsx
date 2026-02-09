import { useState, useEffect } from 'react';
import { Card, Table, Empty, Alert } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import PageHeader from '../../components/PageHeader';
import { fetchAdminLogs } from '../../api/admin-logs';
import type { AdminLogListItem } from '../../types/admin';

const PAGE_SIZE = 50;

function AdminLogs() {
  const [logs, setLogs] = useState<AdminLogListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchAdminLogs({ limit: PAGE_SIZE, offset: pagination.offset });
        if (!cancelled) {
          setLogs(res.data ?? []);
          if (res.pagination) setPagination(res.pagination);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Loglar yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pagination.offset]);

  const columns: ColumnsType<AdminLogListItem> = [
    {
      title: 'Kayıt ID',
      dataIndex: 'id',
      key: 'id',
      ellipsis: true,
      width: 120,
      render: (id: string) => (
        <span title={id} style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {id}
        </span>
      ),
    },
    {
      title: 'Tarih',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('tr-TR'),
    },
    {
      title: 'Admin ID',
      dataIndex: 'adminId',
      key: 'adminId',
      ellipsis: true,
      width: 120,
      render: (id: string) => (
        <span title={id} style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {id}
        </span>
      ),
    },
    {
      title: 'İşlem',
      dataIndex: 'action',
      key: 'action',
      width: 150,
    },
    {
      title: 'Açıklama',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string | null) => desc ?? '—',
    },
    {
      title: 'Entity',
      key: 'entity',
      width: 150,
      render: (_, record) => (
        <>
          {record.entityType} {record.entityId ? `#${record.entityId}` : ''}
        </>
      ),
    },
  ];

  const tablePagination: TablePaginationConfig = {
    current: Math.floor(pagination.offset / pagination.limit) + 1,
    pageSize: pagination.limit,
    total: pagination.total,
    showSizeChanger: false,
    showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} kayıt`,
    onChange: (page) => {
      setPagination((p) => ({ ...p, offset: (page - 1) * p.limit }));
    },
  };

  return (
    <div>
      <PageHeader
        title="Admin Logs"
        description="Admin işlem geçmişi"
        icon={<HistoryOutlined />}
      />

      {error && <Alert message={error} type="error" showIcon closable style={{ marginBottom: 16 }} />}

      <Card bordered title="Admin işlem logları">
        <Table<AdminLogListItem>
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={tablePagination}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Henüz admin log kaydı bulunmuyor."
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default AdminLogs;
