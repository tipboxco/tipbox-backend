import { Card, Empty } from 'antd';
import { GiftOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function Lootboxes() {
  return (
    <div>
      <PageHeader
        title="Lootboxes"
        description="Manage lootbox system"
        icon={<GiftOutlined />}
      />

      <Card bordered title="Lootboxes Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Lootboxes management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default Lootboxes;
