import { Card, Empty } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function SystemSettings() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure system settings"
        icon={<SettingOutlined />}
      />

      <Card bordered title="Settings Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Settings management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default SystemSettings;
