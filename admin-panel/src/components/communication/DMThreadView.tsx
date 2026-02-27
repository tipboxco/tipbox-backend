import { useState, useEffect } from 'react';
import {
  Modal,
  List,
  Avatar,
  Space,
  Button,
  Alert,
  Spin,
  Typography,
  message,
  Input,
  Popconfirm,
  Tag,
} from 'antd';
import {
  UserOutlined,
  DeleteOutlined,
  FlagOutlined,
  DownloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  fetchDMThread,
  deleteDMMessage,
  flagDMMessage,
  deactivateDMThread,
  type AdminDMThreadDetailResponse,
} from '../../api/admin-communication';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface DMThreadViewProps {
  open: boolean;
  threadId: string;
  onClose: () => void;
}

function DMThreadView({ open, threadId, onClose }: DMThreadViewProps) {
  const [thread, setThread] = useState<AdminDMThreadDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [flaggingMessage, setFlaggingMessage] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchDMThread(threadId);
        if (!cancelled && res.data) {
          setThread(res.data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load thread');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, threadId]);

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteDMMessage(messageId);
      message.success('Message deleted successfully');

      // Refresh thread
      const res = await fetchDMThread(threadId);
      if (res.data) {
        setThread(res.data);
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to delete message');
    }
  };

  const handleFlagMessage = async (messageId: string) => {
    if (!flagReason.trim()) {
      message.error('Please provide a reason for flagging');
      return;
    }

    try {
      await flagDMMessage(messageId, flagReason);
      message.success('Message flagged successfully');
      setFlaggingMessage(null);
      setFlagReason('');

      // Refresh thread
      const res = await fetchDMThread(threadId);
      if (res.data) {
        setThread(res.data);
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to flag message');
    }
  };

  const handleDeactivateThread = async () => {
    if (!thread) return;

    try {
      await deactivateDMThread(threadId);
      message.success('Thread deactivated successfully');
      onClose();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to deactivate thread');
    }
  };

  const handleExportThread = () => {
    if (!thread) return;

    const conversationText = `
Direct Message Thread Export
=============================

User 1: ${thread.user1Username || thread.user1Email || thread.user1Id}
User 2: ${thread.user2Username || thread.user2Email || thread.user2Id}
Thread ID: ${thread.id}
Status: ${thread.isActive ? 'Active' : 'Inactive'}
Created: ${new Date(thread.createdAt).toLocaleString()}
Messages: ${thread.messageCount}

Messages:
---------

${thread.recentMessages
  .map(
    (msg, i) =>
      `[${i + 1}] ${new Date(msg.createdAt).toLocaleString()}
From: ${msg.senderUsername || 'Unknown'}
Message: ${msg.message}
`
  )
  .join('\n')}

Exported on: ${new Date().toLocaleString()}
    `.trim();

    const blob = new Blob([conversationText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dm-thread-${threadId}-${new Date().toISOString()}.txt`;
    link.click();
    window.URL.revokeObjectURL(url);

    message.success('Thread exported successfully');
  };

  return (
    <Modal
      title="Direct Message Thread"
      open={open}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="export" icon={<DownloadOutlined />} onClick={handleExportThread}>
          Export
        </Button>,
        thread?.isActive && (
          <Popconfirm
            key="deactivate"
            title="Deactivate Thread"
            description="This will prevent both users from sending new messages. Continue?"
            onConfirm={handleDeactivateThread}
            okText="Deactivate"
            okType="danger"
          >
            <Button danger icon={<StopOutlined />}>
              Deactivate Thread
            </Button>
          </Popconfirm>
        ),
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <Alert message="Error" description={error} type="error" showIcon />
      ) : thread ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            message="Thread Information"
            description={
              <Space direction="vertical" size="small">
                <Text>
                  <strong>Participants:</strong>{' '}
                  {thread.user1Username || thread.user1Email || thread.user1Id} ↔️{' '}
                  {thread.user2Username || thread.user2Email || thread.user2Id}
                </Text>
                <Text>
                  <strong>Status:</strong>{' '}
                  {thread.isActive ? (
                    <Tag color="green">Active</Tag>
                  ) : (
                    <Tag color="red">Inactive</Tag>
                  )}
                </Text>
                <Text>
                  <strong>Total Messages:</strong> {thread.messageCount}
                </Text>
                <Text>
                  <strong>Created:</strong> {new Date(thread.createdAt).toLocaleString()}
                </Text>
              </Space>
            }
            type="info"
            showIcon
          />

          <Alert
            message="Privacy Warning"
            description="You are viewing private message content. Only view and take action when investigating policy violations. All actions are logged."
            type="warning"
            showIcon
          />

          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            <List
              itemLayout="horizontal"
              dataSource={thread.recentMessages}
              renderItem={(msg) => (
                <List.Item
                  actions={[
                    flaggingMessage === msg.id ? (
                      <Space key="flag-input" direction="vertical" size="small">
                        <TextArea
                          placeholder="Reason for flagging"
                          value={flagReason}
                          onChange={(e) => setFlagReason(e.target.value)}
                          rows={2}
                          style={{ width: 200 }}
                        />
                        <Space>
                          <Button
                            size="small"
                            type="primary"
                            onClick={() => handleFlagMessage(msg.id)}
                          >
                            Submit
                          </Button>
                          <Button
                            size="small"
                            onClick={() => {
                              setFlaggingMessage(null);
                              setFlagReason('');
                            }}
                          >
                            Cancel
                          </Button>
                        </Space>
                      </Space>
                    ) : (
                      <Button
                        key="flag"
                        size="small"
                        type="text"
                        icon={<FlagOutlined />}
                        onClick={() => setFlaggingMessage(msg.id)}
                      >
                        Flag
                      </Button>
                    ),
                    <Popconfirm
                      key="delete"
                      title="Delete Message"
                      description="This action cannot be undone. Continue?"
                      onConfirm={() => handleDeleteMessage(msg.id)}
                      okText="Delete"
                      okType="danger"
                    >
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                      >
                        Delete
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} />}
                    title={
                      <Space>
                        <Text strong>{msg.senderUsername || 'Unknown User'}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(msg.createdAt).toLocaleString()}
                        </Text>
                      </Space>
                    }
                    description={<Paragraph style={{ marginBottom: 0 }}>{msg.message}</Paragraph>}
                  />
                </List.Item>
              )}
            />
          </div>

          {thread.recentMessages.length === 0 && (
            <Alert
              message="No Messages"
              description="This thread has no messages yet."
              type="info"
              showIcon
            />
          )}
        </Space>
      ) : (
        <Alert message="Thread not found" type="error" showIcon />
      )}
    </Modal>
  );
}

export default DMThreadView;
