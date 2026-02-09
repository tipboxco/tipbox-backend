import { Card, Empty } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function ProductGroups() {
  return (
    <div>
      <PageHeader
        title="Product Groups"
        description="Organize products into groups"
        icon={<FolderOpenOutlined />}
      />

      <Card bordered title="Product Groups Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Product Groups management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default ProductGroups;
