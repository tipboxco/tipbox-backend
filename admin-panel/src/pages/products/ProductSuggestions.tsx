import { Card, Empty } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function ProductSuggestions() {
  return (
    <div>
      <PageHeader
        title="Product Suggestions"
        description="Review user-submitted products"
        icon={<BulbOutlined />}
      />

      <Card bordered title="Product Suggestions Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Product Suggestions management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default ProductSuggestions;
