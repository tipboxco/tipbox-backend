import { useState, useEffect, useCallback } from 'react';
import {
  Steps,
  Button,
  Input,
  Rate,
  Radio,
  Select,
  Space,
  Typography,
  Spin,
  Alert,
  Descriptions,
  Divider,
  message,
} from 'antd';
import {
  ThunderboltOutlined,
} from '@ant-design/icons';
import UserSearchSelect from '../UserSearchSelect';
import ProductSearchSelect from '../ProductSearchSelect';
import EventSearchSelect from '../EventSearchSelect';
import ImageUploadList from './ImageUploadList';
import {
  splitExperience,
  fetchExperienceOptions,
  type SplitExperienceResponse,
  type ExperienceOptionsResponse,
} from '../../api/admin-content';

const { TextArea } = Input;
const { Text, Title } = Typography;

export interface ExperiencePostData {
  userId: string;
  contextType: 'PRODUCT';
  contextId: string;
  content: string;
  experience: { type: 'price_and_shopping' | 'product_and_usage'; content: string; rating: number }[];
  status: 'own' | 'tested';
  selectedDurationId: string | null;
  selectedLocationId: string | null;
  selectedPurposeId: string | null;
  experienceSnippetId: string;
  images: string[];
  eventId: string | null;
}

interface ExperiencePostWizardProps {
  onFinish: (data: ExperiencePostData) => void;
  onCancel: () => void;
  loading?: boolean;
}

function ExperiencePostWizard({ onFinish, onCancel, loading }: ExperiencePostWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1: User & Product
  const [userId, setUserId] = useState('');
  const [productId, setProductId] = useState('');

  // Step 2: Experience text & AI Split
  const [experienceText, setExperienceText] = useState('');
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitResult, setSplitResult] = useState<SplitExperienceResponse | null>(null);
  const [splitError, setSplitError] = useState<string | null>(null);

  // Step 3: Edit split results & ratings
  const [priceContent, setPriceContent] = useState('');
  const [priceRating, setPriceRating] = useState(0);
  const [usageContent, setUsageContent] = useState('');
  const [usageRating, setUsageRating] = useState(0);

  // Step 4: Duration, Location, Purpose
  const [options, setOptions] = useState<ExperienceOptionsResponse | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [selectedDurationId, setSelectedDurationId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedPurposeId, setSelectedPurposeId] = useState<string | null>(null);

  // Step 5: Status & Images
  const [status, setStatus] = useState<'own' | 'tested'>('own');
  const [images, setImages] = useState<string[]>([]);

  // Step 6: Event (optional)
  const [eventId, setEventId] = useState<string | null>(null);

  // Load experience options on mount
  useEffect(() => {
    setOptionsLoading(true);
    fetchExperienceOptions()
      .then((res) => setOptions(res.data ?? null))
      .catch(() => message.error('Failed to load experience options'))
      .finally(() => setOptionsLoading(false));
  }, []);

  const handleSplit = useCallback(async () => {
    if (!userId || !productId || experienceText.length < 3) return;
    setSplitLoading(true);
    setSplitError(null);
    try {
      const res = await splitExperience({ userId, productId, content: experienceText });
      if (res.data) {
        setSplitResult(res.data);
        setPriceContent(res.data.priceAndShopping?.content ?? '');
        setPriceRating(res.data.priceAndShopping?.rating ?? 3);
        setUsageContent(res.data.productAndUsage?.content ?? '');
        setUsageRating(res.data.productAndUsage?.rating ?? 3);
      }
    } catch (err) {
      setSplitError(err instanceof Error ? err.message : 'AI Split failed');
    } finally {
      setSplitLoading(false);
    }
  }, [userId, productId, experienceText]);

  const handleFinish = () => {
    if (!splitResult) return;
    onFinish({
      userId,
      contextType: 'PRODUCT',
      contextId: productId,
      content: experienceText,
      experience: [
        { type: 'price_and_shopping', content: priceContent, rating: priceRating },
        { type: 'product_and_usage', content: usageContent, rating: usageRating },
      ],
      status,
      selectedDurationId,
      selectedLocationId,
      selectedPurposeId,
      experienceSnippetId: splitResult.experienceSnippetId,
      images,
      eventId,
    });
  };

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 0: return !!userId && !!productId;
      case 1: return !!splitResult;
      case 2: return priceRating > 0 && usageRating > 0;
      case 3: return true; // Duration/location/purpose are optional
      case 4: return true; // Status has default, images optional
      case 5: return true; // Review step
      default: return false;
    }
  };

  const steps = [
    { title: 'User & Product' },
    { title: 'AI Split' },
    { title: 'Edit & Rate' },
    { title: 'Tags' },
    { title: 'Status' },
    { title: 'Review' },
  ];

  return (
    <div>
      <Steps current={currentStep} size="small" items={steps} style={{ marginBottom: 24 }} />

      {/* Step 1: User & Product */}
      {currentStep === 0 && (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>User *</Text>
            <UserSearchSelect value={userId} onChange={(v) => setUserId(v)} style={{ width: '100%', marginTop: 4 }} />
          </div>
          <div>
            <Text strong>Product *</Text>
            <ProductSearchSelect value={productId} onChange={(v) => setProductId(v)} style={{ width: '100%', marginTop: 4 }} />
          </div>
        </Space>
      )}

      {/* Step 2: Experience Text & AI Split */}
      {currentStep === 1 && (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>Experience Text *</Text>
            <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
              Write your raw experience narrative (3-5000 characters). AI will split it into price/shopping and product/usage categories.
            </Text>
            <TextArea
              rows={8}
              value={experienceText}
              onChange={(e) => setExperienceText(e.target.value)}
              maxLength={5000}
              showCount
              placeholder="Write the experience text here..."
            />
          </div>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleSplit}
            loading={splitLoading}
            disabled={experienceText.length < 3 || !userId || !productId}
            size="large"
            block
          >
            {splitLoading ? 'AI Processing...' : 'Run AI Split'}
          </Button>
          {splitError && <Alert type="error" message={splitError} showIcon />}
          {splitResult && (
            <Alert
              type="success"
              message="AI Split completed successfully"
              description={`Snippet ID: ${splitResult.experienceSnippetId} | Processing: ${splitResult.metadata.processingTimeMs}ms`}
              showIcon
            />
          )}
        </Space>
      )}

      {/* Step 3: Edit Split Results & Rate */}
      {currentStep === 2 && (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Title level={5}>Price & Shopping Experience</Title>
            <TextArea
              rows={4}
              value={priceContent}
              onChange={(e) => setPriceContent(e.target.value)}
              placeholder="Price and shopping experience..."
            />
            <div style={{ marginTop: 8 }}>
              <Text>Rating: </Text>
              <Rate value={priceRating} onChange={setPriceRating} />
            </div>
          </div>
          <Divider />
          <div>
            <Title level={5}>Product & Usage Experience</Title>
            <TextArea
              rows={4}
              value={usageContent}
              onChange={(e) => setUsageContent(e.target.value)}
              placeholder="Product and usage experience..."
            />
            <div style={{ marginTop: 8 }}>
              <Text>Rating: </Text>
              <Rate value={usageRating} onChange={setUsageRating} />
            </div>
          </div>
        </Space>
      )}

      {/* Step 4: Duration, Location, Purpose */}
      {currentStep === 3 && (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {optionsLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : (
            <>
              <div>
                <Text strong>Duration</Text>
                <Select
                  value={selectedDurationId}
                  onChange={setSelectedDurationId}
                  allowClear
                  placeholder="Select duration..."
                  style={{ width: '100%', marginTop: 4 }}
                  options={options?.durations.map((d) => ({ value: d.id, label: d.name })) ?? []}
                />
              </div>
              <div>
                <Text strong>Location</Text>
                <Select
                  value={selectedLocationId}
                  onChange={setSelectedLocationId}
                  allowClear
                  placeholder="Select location..."
                  style={{ width: '100%', marginTop: 4 }}
                  options={options?.locations.map((l) => ({ value: l.id, label: l.name })) ?? []}
                />
              </div>
              <div>
                <Text strong>Purpose</Text>
                <Select
                  value={selectedPurposeId}
                  onChange={setSelectedPurposeId}
                  allowClear
                  placeholder="Select purpose..."
                  style={{ width: '100%', marginTop: 4 }}
                  options={options?.purposes.map((p) => ({ value: p.id, label: p.name })) ?? []}
                />
              </div>
            </>
          )}
        </Space>
      )}

      {/* Step 5: Status & Images */}
      {currentStep === 4 && (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>Ownership Status *</Text>
            <div style={{ marginTop: 8 }}>
              <Radio.Group value={status} onChange={(e) => setStatus(e.target.value)}>
                <Radio.Button value="own">I Own This (Sahip)</Radio.Button>
                <Radio.Button value="tested">I Tested This (Denedim)</Radio.Button>
              </Radio.Group>
            </div>
          </div>
          <Divider />
          <div>
            <Text strong>Event (Optional)</Text>
            <EventSearchSelect
              value={eventId ?? undefined}
              onChange={(v) => setEventId(v || null)}
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <Divider />
          <ImageUploadList images={images} onChange={setImages} />
        </Space>
      )}

      {/* Step 6: Review */}
      {currentStep === 5 && (
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="User ID">{userId}</Descriptions.Item>
          <Descriptions.Item label="Product ID">{productId}</Descriptions.Item>
          <Descriptions.Item label="Experience Text">{experienceText.slice(0, 200)}...</Descriptions.Item>
          <Descriptions.Item label="Price & Shopping">{priceContent.slice(0, 100)}... (Rating: {priceRating}/5)</Descriptions.Item>
          <Descriptions.Item label="Product & Usage">{usageContent.slice(0, 100)}... (Rating: {usageRating}/5)</Descriptions.Item>
          <Descriptions.Item label="Status">{status}</Descriptions.Item>
          <Descriptions.Item label="Duration">{options?.durations.find((d) => d.id === selectedDurationId)?.name ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Location">{options?.locations.find((l) => l.id === selectedLocationId)?.name ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Purpose">{options?.purposes.find((p) => p.id === selectedPurposeId)?.name ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Images">{images.filter(Boolean).length} image(s)</Descriptions.Item>
          <Descriptions.Item label="Event ID">{eventId ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Snippet ID">{splitResult?.experienceSnippetId ?? '-'}</Descriptions.Item>
        </Descriptions>
      )}

      {/* Navigation */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={currentStep === 0 ? onCancel : () => setCurrentStep(currentStep - 1)}>
          {currentStep === 0 ? 'Cancel' : 'Previous'}
        </Button>
        <Space>
          {currentStep < steps.length - 1 && (
            <Button
              type="primary"
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canGoNext()}
            >
              Next
            </Button>
          )}
          {currentStep === steps.length - 1 && (
            <Button type="primary" onClick={handleFinish} loading={loading} disabled={!splitResult}>
              Create Experience Post
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
}

export default ExperiencePostWizard;
