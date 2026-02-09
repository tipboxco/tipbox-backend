import { Card, Empty } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function UserProgress() {
  return (
    <div>
      <PageHeader
        title="User Progress"
        description="Track user achievement progress"
        icon={<LineChartOutlined />}
      />

      <Card bordered title="User Progress Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="User Progress management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default UserProgress;
