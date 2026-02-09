import { Card, Empty } from 'antd';
import { ShopOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function BrandList() {
  return (
    <div>
      <PageHeader
        title="Brands"
        description="Manage brand partnerships"
        icon={<ShopOutlined />}
      />

      <Card bordered title="Brands Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Brands management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default BrandList;
