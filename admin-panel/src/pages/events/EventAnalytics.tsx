import { Card, Empty } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function EventAnalytics() {
  return (
    <div>
      <PageHeader
        title="Event Analytics"
        description="View event performance metrics"
        icon={<CalendarOutlined />}
      />

      <Card bordered title="Event Analytics Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Event Analytics management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default EventAnalytics;
