import { Card, Empty } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function DirectMessages() {
  return (
    <div>
      <PageHeader
        title="Direct Messages"
        description="Monitor user messaging"
        icon={<MessageOutlined />}
      />

      <Card bordered title="Direct Messages Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Direct Messages management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default DirectMessages;
