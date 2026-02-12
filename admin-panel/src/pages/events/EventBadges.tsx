import { Card, Empty } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function EventBadges() {
  return (
    <div>
      <PageHeader
        title="Event Badges"
        description="Configure event-specific badges"
        icon={<CalendarOutlined />}
      />

      <Card bordered title="Event Badges Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Event Badges management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default EventBadges;
