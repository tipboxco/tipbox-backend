import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Table, Select, Space, Button, Empty, Alert } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { IdcardOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
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
          setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
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
      title: 'Kullanıcı',
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
      title: 'İnceleme durumu',
      dataIndex: 'reviewStatus',
      key: 'reviewStatus',
    },
    {
      title: 'Sonuç',
      dataIndex: 'reviewResult',
      key: 'reviewResult',
    },
    {
      title: 'KYC seviye',
      dataIndex: 'kycLevel',
      key: 'kycLevel',
      render: (text) => text ?? '—',
    },
    {
      title: 'Tarih',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('tr-TR'),
    },
    {
      title: '',
      key: 'action',
      render: (_, record) => (
        <Link to={`/users/kyc/${record.userId}`}>
          <Button type="link" size="small">
            İncele
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
        title="KYC doğrulama"
        description="Kullanıcı KYC kayıtlarını inceleyin ve onaylayın"
        icon={<IdcardOutlined />}
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
        title="KYC kayıtları"
        extra={
          <Space>
            <Select
              value={reviewStatus}
              onChange={(value) => {
                setReviewStatus(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 140 }}
              placeholder="Tüm durumlar"
            >
              <Select.Option value="">Tüm durumlar</Select.Option>
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
              placeholder="Tüm sonuçlar"
            >
              <Select.Option value="">Tüm sonuçlar</Select.Option>
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
            showTotal: (total) => `Toplam ${total} kayıt`,
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="KYC kaydı bulunamadı"
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default UserKYC;
