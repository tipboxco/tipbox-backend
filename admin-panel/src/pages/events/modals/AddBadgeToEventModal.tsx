import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Form,
  InputNumber,
  Button,
  Alert,
  Space,
  Select,
  Avatar,
  Tag,
  Spin,
  message as antdMessage,
} from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { addEventBadge } from '../../../api/admin-events';
import { fetchBadges } from '../../../api/admin-badges-collections';
import type { AdminBadgeListItem } from '../../../types/admin';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

interface AddBadgeToEventModalProps {
  open: boolean;
  eventId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  badgeId: string;
  rank: number;
  displayOrder?: number;
}

const RARITY_COLORS: Record<string, string> = {
  COMMON: 'default',
  RARE: 'blue',
  EPIC: 'purple',
};

function AddBadgeToEventModal({ open, eventId, onClose, onSuccess }: AddBadgeToEventModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badges, setBadges] = useState<AdminBadgeListItem[]>([]);
  const [loadingBadges, setLoadingBadges] = useState(false);
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    (async () => {
      setLoadingBadges(true);
      try {
        const res = await fetchBadges({ type: 'EVENT', limit: 200 });
        if (!cancelled && res.data) {
          setBadges(res.data);
        }
      } catch (err) {
        console.error('Failed to load badges:', err);
        if (!cancelled) {
          antdMessage.error('Failed to load badges');
        }
      } finally {
        if (!cancelled) {
          setLoadingBadges(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const badgeOptions = useMemo(
    () =>
      badges.map((badge) => ({
        value: badge.id,
        label: badge.name,
        badge,
      })),
    [badges],
  );

  const selectedBadge = useMemo(
    () => badges.find((b) => b.id === selectedBadgeId) ?? null,
    [badges, selectedBadgeId],
  );

  const handleSubmit = async (values: FormValues) => {
    setSaving(true);
    setError(null);
    try {
      await addEventBadge(eventId, {
        badgeId: values.badgeId,
        rank: values.rank,
        displayOrder: values.displayOrder ?? null,
      });
      antdMessage.success('Badge added to event successfully');
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add badge to event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add Badge to Event"
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnHidden
    >
      <Form
        form={form}
        {...FORM_LAYOUT_VERTICAL}
        onFinish={handleSubmit}
        initialValues={{
          rank: 1,
        }}
      >
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

        <Form.Item
          label="Badge"
          name="badgeId"
          rules={[{ required: true, message: 'Please select a badge' }]}
          extra="Select an EVENT type badge to add to this event"
        >
          <Select
            showSearch
            placeholder="Search badges by name..."
            loading={loadingBadges}
            notFoundContent={loadingBadges ? <Spin size="small" /> : 'No badges found'}
            filterOption={(input, option) => {
              if (!option) return false;
              const badge = badges.find((b) => b.id === option.value);
              if (!badge) return false;
              return badge.name.toLowerCase().includes(input.toLowerCase());
            }}
            optionRender={(option) => {
              const badge = badges.find((b) => b.id === option.value);
              if (!badge) return option.label;
              return (
                <Space>
                  <Avatar
                    src={badge.imageUrl}
                    icon={!badge.imageUrl ? <TrophyOutlined /> : undefined}
                    size="small"
                  />
                  <span>{badge.name}</span>
                  <Tag color={RARITY_COLORS[badge.rarity] ?? 'default'}>
                    {badge.rarity}
                  </Tag>
                </Space>
              );
            }}
            options={badgeOptions}
            onChange={(value: string) => {
              setSelectedBadgeId(value);
            }}
          />
        </Form.Item>

        {selectedBadge && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              marginBottom: 16,
              background: '#fafafa',
              borderRadius: 8,
              border: '1px solid #f0f0f0',
            }}
          >
            <Avatar
              src={selectedBadge.imageUrl}
              icon={!selectedBadge.imageUrl ? <TrophyOutlined /> : undefined}
              size={48}
            />
            <div>
              <div style={{ fontWeight: 500 }}>{selectedBadge.name}</div>
              <Space size={4}>
                <Tag color={RARITY_COLORS[selectedBadge.rarity] ?? 'default'}>
                  {selectedBadge.rarity}
                </Tag>
                {selectedBadge.categoryName && (
                  <Tag>{selectedBadge.categoryName}</Tag>
                )}
              </Space>
            </div>
          </div>
        )}

        <Form.Item
          label="Rank"
          name="rank"
          rules={[
            { required: true, message: 'Rank is required' },
            { type: 'number', min: 1, message: 'Rank must be at least 1' },
          ]}
          extra="The rank determines the badge tier or importance"
        >
          <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 1" />
        </Form.Item>

        <Form.Item
          label="Display Order (Optional)"
          name="displayOrder"
          rules={[{ type: 'number', min: 0, message: 'Display order must be 0 or greater' }]}
          extra="Optional: Controls the order in which badges are displayed"
        >
          <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 0" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              Add Badge
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default AddBadgeToEventModal;
