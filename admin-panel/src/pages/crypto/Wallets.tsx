import { Card, Empty } from 'antd';
import { WalletOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function Wallets() {
  return (
    <div>
      <PageHeader
        title="Wallets"
        description="Manage user crypto wallets"
        icon={<WalletOutlined />}
      />

      <Card bordered title="Wallets Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Wallets management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default Wallets;
