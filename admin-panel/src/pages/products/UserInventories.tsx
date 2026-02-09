import { Card, Empty } from 'antd';
import { UnorderedListOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function UserInventories() {
  return (
    <div>
      <PageHeader
        title="User Inventories"
        description="View user product ownership"
        icon={<UnorderedListOutlined />}
      />

      <Card bordered title="User Inventories Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="User Inventories management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default UserInventories;
