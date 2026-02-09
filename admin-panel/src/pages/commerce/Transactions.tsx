import { Card, Empty } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function Transactions() {
  return (
    <div>
      <PageHeader
        title="Transactions"
        description="View all platform transactions"
        icon={<FileTextOutlined />}
      />

      <Card bordered title="Transactions Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Transactions management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default Transactions;
