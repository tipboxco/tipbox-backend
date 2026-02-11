import { useState, useEffect } from 'react';
import { Card, Table, Empty, Alert } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import PageHeader from '../../components/PageHeader';
import IdDisplay from '../../components/IdDisplay';
import { fetchAdminLogs } from '../../api/admin-logs';
import type { AdminLogListItem } from '../../types/admin';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

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
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load logs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pagination.offset]);

  const columns: ColumnsType<AdminLogListItem> = [
    {
      title: 'Record ID',
      dataIndex: 'id',
      key: 'id',
      ellipsis: true,
      width: 120,
      render: (id: string) => <IdDisplay id={id} variant="compact" />,
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATETIME_FULL,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Admin ID',
      dataIndex: 'adminId',
      key: 'adminId',
      ellipsis: true,
      width: 120,
      render: (id: string) => <IdDisplay id={id} variant="compact" />,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 150,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: TABLE_COLUMN_WIDTHS.VERY_LONG_TEXT - 50,
      ellipsis: true,
      render: (desc: string | null) => desc ?? '—',
    },
    {
      title: 'Entity',
      key: 'entity',
      width: 150,
      ellipsis: true,
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
    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`,
    onChange: (page) => {
      setPagination((p) => ({ ...p, offset: (page - 1) * p.limit }));
    },
  };

  return (
    <div>
      <PageHeader
        title="Admin Logs"
        description="Admin action history"
        icon={<HistoryOutlined />}
      />

      {error && <Alert message={error} type="error" showIcon closable style={{ marginBottom: 16 }} />}

      <Card bordered title="Admin action logs">
        <Table<AdminLogListItem>
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          scroll={TABLE_SCROLL_CONFIGS.AUTO}
          pagination={tablePagination}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No admin log records yet."
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default AdminLogs;
