import { Card, Empty } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function TokenTransfers() {
  return (
    <div>
      <PageHeader
        title="Token Transfers"
        description="View TIPS token transactions"
        icon={<SwapOutlined />}
      />

      <Card bordered title="Token Transfers Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Token Transfers management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default TokenTransfers;
