import { Card, Empty } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function Notifications() {
  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Manage system notifications"
        icon={<BellOutlined />}
      />

      <Card bordered title="Notifications Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Notifications management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default Notifications;
