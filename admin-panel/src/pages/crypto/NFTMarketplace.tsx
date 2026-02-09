import { Card, Empty } from 'antd';
import { ShopOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function NFTMarketplace() {
  return (
    <div>
      <PageHeader
        title="NFT Marketplace"
        description="Monitor NFT marketplace activity"
        icon={<ShopOutlined />}
      />

      <Card bordered title="NFT Marketplace Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="NFT Marketplace management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default NFTMarketplace;
