import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Input,
  Space,
  Button,
  Tag,
  Empty,
  Alert,
  Row,
  Modal,
  Select,
  Descriptions,
  message,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  ShopOutlined,
  SearchOutlined,
  EyeOutlined,
  StopOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchMarketplaceStats,
  fetchMarketplaceListings,
  fetchMarketplaceListing,
  delistNFT,
} from '../../api/admin-crypto';
import type {
  AdminMarketplaceStatsResponse,
  AdminMarketplaceListingItem,
  AdminMarketplaceListingDetailResponse,
} from '../../api/admin-crypto';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

type ListingStatus = 'ACTIVE' | 'SOLD' | 'CANCELLED';

function NFTMarketplace() {
  const [stats, setStats] = useState<AdminMarketplaceStatsResponse | null>(null);
  const [listings, setListings] = useState<AdminMarketplaceListingItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ListingStatus | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<AdminMarketplaceListingDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchMarketplaceStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load statistics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadListings = async () => {
    setLoadingList(true);
    try {
      const res = await fetchMarketplaceListings({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        status: statusFilter,
      });
      setListings(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load marketplace listings');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search, statusFilter]);

  const openDetailModal = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetchMarketplaceListing(id);
      setSelectedListing(res.data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load listing details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDelist = async (id: string, nftName: string) => {
    Modal.confirm({
      title: 'Delist NFT',
      content: `Are you sure you want to remove "${nftName}" from the marketplace?`,
      okText: 'Delist',
      okType: 'danger',
      onOk: async () => {
        try {
          await delistNFT(id);
          message.success('NFT delisted successfully');
          loadListings();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to delist NFT');
        }
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'green';
      case 'SOLD':
        return 'blue';
      case 'CANCELLED':
        return 'red';
      default:
        return 'default';
    }
  };

  const columns: ColumnsType<AdminMarketplaceListingItem> = [
    {
      title: 'NFT',
      dataIndex: 'nftName',
      key: 'nftName',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
    },
    {
      title: 'Seller',
      dataIndex: 'sellerUsername',
      key: 'sellerUsername',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.sellerEmail ?? '—',
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (price) => `${price?.toFixed(2) ?? '0.00'} TIPS`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    {
      title: 'Listed',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: 'Sold',
      dataIndex: 'soldAt',
      key: 'soldAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON_TRIPLE,
      render: (_, record) => (
        <Space size="small">
          <ViewActionButton to={`/users/${record.sellerId}`} />
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => openDetailModal(record.id)}
          />
          {record.status === 'ACTIVE' && (
            <Button
              size="small"
              type="text"
              danger
              icon={<StopOutlined />}
              onClick={() => handleDelist(record.id, record.nftName)}
            />
          )}
        </Space>
      ),
    },
  ];

  const handleTableChange = (pag: TablePaginationConfig) => {
    const newOffset = ((pag.current ?? 1) - 1) * PAGE_SIZE;
    setPagination((prev) => ({ ...prev, offset: newOffset }));
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Listings',
          value: stats.total,
          icon: <ShopOutlined />,
        },
        {
          label: 'Active',
          value: stats.active,
          icon: <ShopOutlined />,
        },
        {
          label: 'Sold',
          value: stats.sold,
          icon: <ShopOutlined />,
        },
        {
          label: 'Total Volume',
          value: `${stats.totalVolume?.toFixed(2) ?? '0.00'} TIPS`,
          icon: <ShopOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="NFT Marketplace"
        description="Monitor NFT marketplace activity"
        icon={<ShopOutlined />}
        statsData={statsData}
        statsLoading={loading}
      />

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <Space wrap>
              <Input
                placeholder="Search NFTs..."
                prefix={<SearchOutlined />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 250 }}
                allowClear
              />
              <Select
                placeholder="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
                allowClear
              >
                <Select.Option value="ACTIVE">Active</Select.Option>
                <Select.Option value="SOLD">Sold</Select.Option>
                <Select.Option value="CANCELLED">Cancelled</Select.Option>
              </Select>
            </Space>
          </Row>

          <Table
            columns={columns}
            dataSource={listings}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} listings`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No marketplace listings found" />,
            }}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Listing Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedListing(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={800}
      >
        {loadingDetail ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
        ) : (
          selectedListing && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="NFT" span={2}>
                  {selectedListing.nftName}
                </Descriptions.Item>
                <Descriptions.Item label="Seller">
                  {selectedListing.sellerUsername ?? selectedListing.sellerEmail ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Price">
                  {selectedListing.price?.toFixed(2) ?? '0.00'} TIPS
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={getStatusColor(selectedListing.status)}>{selectedListing.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Listed">
                  {new Date(selectedListing.createdAt).toLocaleString('en-US')}
                </Descriptions.Item>
                {selectedListing.soldAt && (
                  <>
                    <Descriptions.Item label="Sold At">
                      {new Date(selectedListing.soldAt).toLocaleString('en-US')}
                    </Descriptions.Item>
                    <Descriptions.Item label="Buyer">
                      {selectedListing.buyerUsername ?? selectedListing.buyerEmail ?? '—'}
                    </Descriptions.Item>
                  </>
                )}
                {selectedListing.cancelledAt && (
                  <Descriptions.Item label="Cancelled At" span={2}>
                    {new Date(selectedListing.cancelledAt).toLocaleString('en-US')}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Space>
          )
        )}
      </Modal>
    </div>
  );
}

export default NFTMarketplace;
