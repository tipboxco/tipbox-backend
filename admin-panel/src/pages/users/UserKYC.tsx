import { useState, useEffect } from 'react';
import { Card, Table, Select, Space, Button, Empty, Alert } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { IdcardOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import ViewActionButton from '../../components/ViewActionButton';
import { fetchUserKycList } from '../../api/admin-kyc';
import type { AdminKycListItem } from '../../types/admin';

const PAGE_SIZE = 20;

function UserKYC() {
  const [records, setRecords] = useState<AdminKycListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [reviewStatus, setReviewStatus] = useState<string>('');
  const [reviewResult, setReviewResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchUserKycList({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          reviewStatus: reviewStatus || undefined,
          reviewResult: reviewResult || undefined,
        });
        if (!cancelled) {
          setRecords(res.data ?? []);
          if (res.pagination) setPagination(res.pagination);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load list');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.offset, reviewStatus, reviewResult]);

  const columns: ColumnsType<AdminKycListItem> = [
    {
      title: 'User',
      key: 'user',
      render: (_, record) => record.userEmail ?? record.userId,
    },
    {
      title: 'Sumsub ID',
      dataIndex: 'sumsubApplicantId',
      key: 'sumsubApplicantId',
      ellipsis: true,
      render: (text) => text?.slice(0, 12) + '…',
    },
    {
      title: 'Review status',
      dataIndex: 'reviewStatus',
      key: 'reviewStatus',
    },
    {
      title: 'Result',
      dataIndex: 'reviewResult',
      key: 'reviewResult',
    },
    {
      title: 'KYC level',
      dataIndex: 'kycLevel',
      key: 'kycLevel',
      render: (text) => text ?? '—',
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('en-US'),
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <ViewActionButton to={`/users/kyc/${record.userId}`} label="Review" />
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
        title="KYC verification"
        description="Review and approve user KYC records"
        icon={<IdcardOutlined />}
      />

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 24 }}
        />
      )}

      <Card
        bordered
        title="KYC records"
        extra={
          <Space>
            <Select
              value={reviewStatus}
              onChange={(value) => {
                setReviewStatus(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 140 }}
              placeholder="All statuses"
            >
              <Select.Option value="">All statuses</Select.Option>
              <Select.Option value="INIT">INIT</Select.Option>
              <Select.Option value="PENDING">PENDING</Select.Option>
              <Select.Option value="COMPLETED">COMPLETED</Select.Option>
              <Select.Option value="DECLINED">DECLINED</Select.Option>
              <Select.Option value="ON_HOLD">ON_HOLD</Select.Option>
            </Select>
            <Select
              value={reviewResult}
              onChange={(value) => {
                setReviewResult(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 140 }}
              placeholder="All results"
            >
              <Select.Option value="">All results</Select.Option>
              <Select.Option value="GREEN">GREEN</Select.Option>
              <Select.Option value="YELLOW">YELLOW</Select.Option>
              <Select.Option value="RED">RED</Select.Option>
            </Select>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: PAGE_SIZE,
            total: pagination.total,
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} records`,
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No KYC records found"
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default UserKYC;
