import { Card, Empty } from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function Rewards() {
  return (
    <div>
      <PageHeader
        title="Rewards"
        description="Manage reward claims and distribution"
        icon={<DollarOutlined />}
      />

      <Card bordered title="Rewards Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Rewards management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default Rewards;
