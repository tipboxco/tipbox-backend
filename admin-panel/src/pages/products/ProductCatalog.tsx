import { Card, Empty } from 'antd';
import { ShoppingOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function ProductCatalog() {
  return (
    <div>
      <PageHeader
        title="Product Catalog"
        description="Manage product database"
        icon={<ShoppingOutlined />}
      />

      <Card bordered title="Product Catalog Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Product Catalog management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default ProductCatalog;
