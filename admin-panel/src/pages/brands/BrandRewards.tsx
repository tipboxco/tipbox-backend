import { Card, Empty } from 'antd';
import { GiftOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function BrandRewards() {
  return (
    <div>
      <PageHeader
        title="Rewards"
        description="Manage brand rewards and incentives"
        icon={<GiftOutlined />}
      />

      <Card bordered title="Rewards Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Rewards management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default BrandRewards;
