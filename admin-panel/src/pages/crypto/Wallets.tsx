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
  Select,
  InputNumber,
  message,
  Checkbox,
  Descriptions,
  Tabs,
  List,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  WalletOutlined,
  SearchOutlined,
  EyeOutlined,
  DollarOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchWalletStats,
  fetchWallets,
  fetchWallet,
  adjustWalletBalance,
  disconnectWallet,
} from '../../api/admin-crypto';
import type {
  AdminWalletStatsResponse,
  AdminWalletListItem,
  AdminWalletDetailResponse,
  AdjustWalletBalanceInput,
} from '../../api/admin-crypto';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function Wallets() {
  const [stats, setStats] = useState<AdminWalletStatsResponse | null>(null);
  const [wallets, setWallets] = useState<AdminWalletListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<string | undefined>(undefined);
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<AdminWalletDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [adjustForm] = Form.useForm();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWalletStats();
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

  const loadWallets = async () => {
    setLoadingList(true);
    try {
      const res = await fetchWallets({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        provider: providerFilter,
        isConnected: connectedOnly || undefined,
      });
      setWallets(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load wallets');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadWallets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search, providerFilter, connectedOnly]);

  const openDetailModal = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetchWallet(id);
      setSelectedWallet(res.data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load wallet details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const openAdjustModal = (wallet: AdminWalletListItem) => {
    setSelectedWallet(wallet as AdminWalletDetailResponse);
    setAdjustModalOpen(true);
  };

  const handleAdjust = async (values: AdjustWalletBalanceInput) => {
    if (!selectedWallet) return;

    try {
      await adjustWalletBalance(selectedWallet.id, values);
      message.success('Wallet balance adjusted successfully');
      setAdjustModalOpen(false);
      adjustForm.resetFields();
      setSelectedWallet(null);
      loadWallets();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to adjust balance');
    }
  };

  const handleDisconnect = async (id: string, address: string) => {
    Modal.confirm({
      title: 'Disconnect Wallet',
      content: `Are you sure you want to disconnect wallet "${address}"?`,
      okText: 'Disconnect',
      okType: 'danger',
      onOk: async () => {
        try {
          await disconnectWallet(id);
          message.success('Wallet disconnected successfully');
          loadWallets();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to disconnect wallet');
        }
      },
    });
  };

  const truncateAddress = (address: string) => {
    if (!address) return '—';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const columns: ColumnsType<AdminWalletListItem> = [
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.userEmail ?? '—',
    },
    {
      title: 'Address',
      dataIndex: 'publicAddress',
      key: 'publicAddress',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (address) => (
        <span title={address} style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {truncateAddress(address)}
        </span>
      ),
    },
    {
      title: 'Provider',
      dataIndex: 'provider',
      key: 'provider',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      render: (provider) => <Tag>{provider}</Tag>,
    },
    {
      title: 'Balance',
      dataIndex: 'balance',
      key: 'balance',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (balance) => balance?.toFixed(2) ?? '0.00',
    },
    {
      title: 'Locked',
      dataIndex: 'lockedBalance',
      key: 'lockedBalance',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (locked) => locked?.toFixed(2) ?? '0.00',
    },
    {
      title: 'Status',
      dataIndex: 'isConnected',
      key: 'isConnected',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (connected) =>
        connected ? <Tag color="green">Connected</Tag> : <Tag color="gray">Disconnected</Tag>,
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
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON_QUAD,
      render: (_, record) => (
        <Space size="small">
          <ViewActionButton to={`/users/${record.userId}`} />
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => openDetailModal(record.id)}
          />
          <Button
            size="small"
            type="text"
            icon={<DollarOutlined />}
            onClick={() => openAdjustModal(record)}
          />
          {record.isConnected && (
            <Button
              size="small"
              type="text"
              danger
              icon={<DisconnectOutlined />}
              onClick={() => handleDisconnect(record.id, record.publicAddress)}
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
          label: 'Total Wallets',
          value: stats.total,
          icon: <WalletOutlined />,
        },
        {
          label: 'Connected',
          value: stats.connected,
          icon: <WalletOutlined />,
        },
        {
          label: 'Total Balance',
          value: stats.totalBalance?.toFixed(2) ?? '0.00',
          icon: <WalletOutlined />,
        },
        {
          label: 'Avg Balance',
          value: stats.avgBalance?.toFixed(2) ?? '0.00',
          icon: <WalletOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Wallets"
        description="Manage user crypto wallets"
        icon={<WalletOutlined />}
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
                placeholder="Search user..."
                prefix={<SearchOutlined />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 250 }}
                allowClear
              />
              <Select
                placeholder="Provider"
                value={providerFilter}
                onChange={setProviderFilter}
                style={{ width: 150 }}
                allowClear
              >
                <Select.Option value="METAMASK">MetaMask</Select.Option>
                <Select.Option value="WALLET_CONNECT">WalletConnect</Select.Option>
                <Select.Option value="COINBASE">Coinbase</Select.Option>
              </Select>
              <Checkbox checked={connectedOnly} onChange={(e) => setConnectedOnly(e.target.checked)}>
                Connected only
              </Checkbox>
            </Space>
          </Row>

          <Table
            columns={columns}
            dataSource={wallets}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} wallets`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No wallets found" />,
            }}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Wallet Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedWallet(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={900}
      >
        {loadingDetail ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
        ) : (
          selectedWallet && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="User">
                  {selectedWallet.username ?? selectedWallet.userEmail ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Provider">
                  <Tag>{selectedWallet.provider}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Address" span={2}>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    {selectedWallet.publicAddress}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="Balance">
                  {selectedWallet.balance?.toFixed(2) ?? '0.00'}
                </Descriptions.Item>
                <Descriptions.Item label="Locked Balance">
                  {selectedWallet.lockedBalance?.toFixed(2) ?? '0.00'}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  {selectedWallet.isConnected ? (
                    <Tag color="green">Connected</Tag>
                  ) : (
                    <Tag color="gray">Disconnected</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {new Date(selectedWallet.createdAt).toLocaleString('en-US')}
                </Descriptions.Item>
              </Descriptions>

              <Tabs
                items={[
                  {
                    key: 'transactions',
                    label: 'Transactions',
                    children: selectedWallet.transactions && selectedWallet.transactions.length > 0 ? (
                      <List
                        dataSource={selectedWallet.transactions}
                        renderItem={(tx) => (
                          <List.Item>
                            <List.Item.Meta
                              title={
                                <Space>
                                  <Tag>{tx.actionType}</Tag>
                                  <Tag color={tx.status === 'CONFIRMED' ? 'green' : 'orange'}>
                                    {tx.status}
                                  </Tag>
                                </Space>
                              }
                              description={
                                <div>
                                  {tx.amount && <div>Amount: {tx.amount}</div>}
                                  {tx.txHash && (
                                    <div style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                                      TX: {truncateAddress(tx.txHash)}
                                    </div>
                                  )}
                                  <div style={{ fontSize: '12px', color: '#888' }}>
                                    {new Date(tx.createdAt).toLocaleString('en-US')}
                                  </div>
                                </div>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    ) : (
                      <Empty description="No transactions" />
                    ),
                  },
                  {
                    key: 'transfers',
                    label: 'Transfers',
                    children: selectedWallet.transfers && selectedWallet.transfers.length > 0 ? (
                      <List
                        dataSource={selectedWallet.transfers}
                        renderItem={(transfer) => (
                          <List.Item>
                            <List.Item.Meta
                              title={`${transfer.amount} TIPS`}
                              description={
                                <div>
                                  <div>
                                    From: {transfer.fromUsername ?? transfer.fromEmail ?? '—'}
                                  </div>
                                  <div>
                                    To: {transfer.toUsername ?? transfer.toEmail ?? '—'}
                                  </div>
                                  {transfer.reason && <div>Reason: {transfer.reason}</div>}
                                  <div style={{ fontSize: '12px', color: '#888' }}>
                                    {new Date(transfer.createdAt).toLocaleString('en-US')}
                                  </div>
                                </div>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    ) : (
                      <Empty description="No transfers" />
                    ),
                  },
                ]}
              />
            </Space>
          )
        )}
      </Modal>

      {/* Adjust Balance Modal */}
      <Modal
        title="Adjust Wallet Balance"
        open={adjustModalOpen}
        onCancel={() => {
          setAdjustModalOpen(false);
          adjustForm.resetFields();
          setSelectedWallet(null);
        }}
        onOk={() => adjustForm.submit()}
        width={600}
      >
        <Alert
          message="Warning"
          description="This will directly modify the wallet balance. Use with caution."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={adjustForm} layout="vertical" onFinish={handleAdjust}>
          <Form.Item
            name="amount"
            label="Amount"
            rules={[{ required: true, message: 'Please enter amount' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="Use negative values to deduct"
              step={0.01}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Reason"
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <Input.TextArea rows={3} placeholder="Why is this adjustment being made?" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Wallets;
