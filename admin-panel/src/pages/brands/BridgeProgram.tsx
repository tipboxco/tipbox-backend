import { Card, Empty } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function BridgeProgram() {
  return (
    <div>
      <PageHeader
        title="Bridge Program"
        description="Manage brand community engagement"
        icon={<LinkOutlined />}
      />

      <Card bordered title="Bridge Program Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Bridge Program management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default BridgeProgram;
