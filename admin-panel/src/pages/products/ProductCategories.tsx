import { Card, Empty } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function ProductCategories() {
  return (
    <div>
      <PageHeader
        title="Categories"
        description="Manage product categories"
        icon={<AppstoreOutlined />}
      />

      <Card bordered title="Categories Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Categories management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default ProductCategories;
