import { Card, Empty } from 'antd';
import { CrownOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function Subscriptions() {
  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Manage user subscriptions"
        icon={<CrownOutlined />}
      />

      <Card bordered title="Subscriptions Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Subscriptions management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default Subscriptions;
