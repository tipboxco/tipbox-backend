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
  Form,
  InputNumber,
  message,
  Select,
  Descriptions,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  PictureOutlined,
  SearchOutlined,
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import NFTCreateModal from './modals/NFTCreateModal';
import NFTEditModal from './modals/NFTEditModal';
import {
  fetchNFTStats,
  fetchNFTs,
  fetchNFT,
  deleteNFT,
  transferNFT,
} from '../../api/admin-crypto';
import type {
  AdminNFTStatsResponse,
  AdminNFTListItem,
  AdminNFTDetailResponse,
  TransferNFTInput,
} from '../../api/admin-crypto';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

type NFTType = 'BADGE' | 'COSMETIC' | 'LOOTBOX';
type NFTRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

function NFTs() {
  const [stats, setStats] = useState<AdminNFTStatsResponse | null>(null);
  const [nfts, setNFTs] = useState<AdminNFTListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<NFTType | undefined>(undefined);
  const [rarityFilter, setRarityFilter] = useState<NFTRarity | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState<AdminNFTDetailResponse | null>(null);
  const [selectedNFTId, setSelectedNFTId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [transferForm] = Form.useForm();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchNFTStats();
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

  const loadNFTs = async () => {
    setLoadingList(true);
    try {
      const res = await fetchNFTs({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        type: typeFilter,
        rarity: rarityFilter,
      });
      setNFTs(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load NFTs');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadNFTs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search, typeFilter, rarityFilter]);

  const openDetailModal = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetchNFT(id);
      setSelectedNFT(res.data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load NFT details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const openEditModal = (nftId: string) => {
    setSelectedNFTId(nftId);
    setEditModalOpen(true);
  };

  const handleCreateSuccess = () => {
    setPagination((prev) => ({ ...prev, offset: 0 }));
    loadNFTs();
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setSelectedNFTId(null);
    loadNFTs();
  };

  const openTransferModal = (nft: AdminNFTListItem) => {
    setSelectedNFT(nft as AdminNFTDetailResponse);
    setTransferModalOpen(true);
  };

  const handleTransfer = async (values: TransferNFTInput) => {
    if (!selectedNFT) return;

    try {
      await transferNFT(selectedNFT.id, values);
      message.success('NFT transferred successfully');
      setTransferModalOpen(false);
      transferForm.resetFields();
      setSelectedNFT(null);
      loadNFTs();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to transfer NFT');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    Modal.confirm({
      title: 'Delete NFT',
      content: `Are you sure you want to delete NFT "${name}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteNFT(id);
          message.success('NFT deleted successfully');
          loadNFTs();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to delete NFT');
        }
      },
    });
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'COMMON':
        return 'default';
      case 'UNCOMMON':
        return 'green';
      case 'RARE':
        return 'blue';
      case 'EPIC':
        return 'purple';
      case 'LEGENDARY':
        return 'gold';
      default:
        return 'default';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'BADGE':
        return 'blue';
      case 'COSMETIC':
        return 'purple';
      case 'LOOTBOX':
        return 'orange';
      default:
        return 'default';
    }
  };

  const columns: ColumnsType<AdminNFTListItem> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      render: (type) => <Tag color={getTypeColor(type)}>{type}</Tag>,
    },
    {
      title: 'Rarity',
      dataIndex: 'rarity',
      key: 'rarity',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      render: (rarity) => <Tag color={getRarityColor(rarity)}>{rarity}</Tag>,
    },
    {
      title: 'Owner',
      dataIndex: 'ownerUsername',
      key: 'ownerUsername',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.ownerEmail ?? '—',
    },
    {
      title: 'Views',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (count) => count ?? 0,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON_QUAD + 40,
      render: (_, record) => (
        <Space size="small">
          <ViewActionButton to={`/users/${record.ownerId}`} />
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => openDetailModal(record.id)}
          />
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record.id)}
          />
          <Button
            size="small"
            type="text"
            icon={<SwapOutlined />}
            onClick={() => openTransferModal(record)}
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id, record.name)}
          />
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
          label: 'Total NFTs',
          value: stats.total,
          icon: <PictureOutlined />,
        },
        {
          label: 'Minted',
          value: stats.minted,
          icon: <PictureOutlined />,
        },
        {
          label: 'Transferred',
          value: stats.transferred,
          icon: <PictureOutlined />,
        },
        {
          label: 'Avg Views',
          value: stats.avgViews?.toFixed(1) ?? '0.0',
          icon: <PictureOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="NFTs"
        description="Manage platform NFT assets"
        icon={<PictureOutlined />}
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
                placeholder="Type"
                value={typeFilter}
                onChange={setTypeFilter}
                style={{ width: 150 }}
                allowClear
              >
                <Select.Option value="BADGE">Badge</Select.Option>
                <Select.Option value="COSMETIC">Cosmetic</Select.Option>
              </Select>
              <Select
                placeholder="Rarity"
                value={rarityFilter}
                onChange={setRarityFilter}
                style={{ width: 150 }}
                allowClear
              >
                <Select.Option value="COMMON">Common</Select.Option>
                <Select.Option value="UNCOMMON">Uncommon</Select.Option>
                <Select.Option value="RARE">Rare</Select.Option>
                <Select.Option value="EPIC">Epic</Select.Option>
                <Select.Option value="LEGENDARY">Legendary</Select.Option>
              </Select>
            </Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create NFT
            </Button>
          </Row>

          <Table
            columns={columns}
            dataSource={nfts}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} NFTs`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No NFTs found" />,
            }}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="NFT Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedNFT(null);
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
          selectedNFT && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              {selectedNFT.imageUrl && (
                <div style={{ textAlign: 'center' }}>
                  <img
                    src={selectedNFT.imageUrl}
                    alt={selectedNFT.name}
                    style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
                  />
                </div>
              )}
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="Name" span={2}>
                  {selectedNFT.name}
                </Descriptions.Item>
                <Descriptions.Item label="Type">
                  <Tag color={getTypeColor(selectedNFT.type)}>{selectedNFT.type}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Rarity">
                  <Tag color={getRarityColor(selectedNFT.rarity)}>{selectedNFT.rarity}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Owner" span={2}>
                  {selectedNFT.ownerUsername ?? selectedNFT.ownerEmail ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Description" span={2}>
                  {selectedNFT.description || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Views">
                  {selectedNFT.viewCount ?? 0}
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {new Date(selectedNFT.createdAt).toLocaleString('en-US')}
                </Descriptions.Item>
                {selectedNFT.attributes && Object.keys(selectedNFT.attributes).length > 0 && (
                  <Descriptions.Item label="Attributes" span={2}>
                    <pre style={{ margin: 0, fontSize: '12px' }}>
                      {JSON.stringify(selectedNFT.attributes, null, 2)}
                    </pre>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Space>
          )
        )}
      </Modal>

      {/* Create NFT Modal */}
      <NFTCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit NFT Modal */}
      {selectedNFTId && (
        <NFTEditModal
          open={editModalOpen}
          nftId={selectedNFTId}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedNFTId(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Transfer Modal */}
      <Modal
        title="Transfer NFT"
        open={transferModalOpen}
        onCancel={() => {
          setTransferModalOpen(false);
          transferForm.resetFields();
          setSelectedNFT(null);
        }}
        onOk={() => transferForm.submit()}
        width={600}
      >
        <Alert
          message="Warning"
          description="This will transfer the NFT to another user. Ensure the recipient ID is correct."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={transferForm} layout="vertical" onFinish={handleTransfer}>
          <Form.Item
            name="toUserId"
            label="Recipient User ID"
            rules={[{ required: true, message: 'Please enter recipient user ID' }]}
          >
            <Input placeholder="User UUID" />
          </Form.Item>
          <Form.Item name="reason" label="Reason">
            <Input.TextArea rows={3} placeholder="Why is this NFT being transferred?" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default NFTs;
