import { Card, Empty } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function ProductComparisons() {
  return (
    <div>
      <PageHeader
        title="Comparisons"
        description="Manage product comparison posts"
        icon={<SwapOutlined />}
      />

      <Card bordered title="Comparisons Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Comparisons management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default ProductComparisons;
