import { Card, Empty } from 'antd';
import { PictureOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function NFTs() {
  return (
    <div>
      <PageHeader
        title="NFTs"
        description="Manage platform NFT assets"
        icon={<PictureOutlined />}
      />

      <Card bordered title="NFTs Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="NFTs management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default NFTs;
