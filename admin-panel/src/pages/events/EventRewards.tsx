import { Card, Empty } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function EventRewards() {
  return (
    <div>
      <PageHeader
        title="Event Rewards"
        description="Set up event reward structures"
        icon={<CalendarOutlined />}
      />

      <Card bordered title="Event Rewards Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Event Rewards management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default EventRewards;
