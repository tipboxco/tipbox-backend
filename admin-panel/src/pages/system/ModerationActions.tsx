import { Card, Empty } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function ModerationActions() {
  return (
    <div>
      <PageHeader
        title="Moderation Actions"
        description="Review moderation history"
        icon={<SafetyOutlined />}
      />

      <Card bordered title="Moderation Actions Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Moderation Actions management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default ModerationActions;
