import { Card, Empty } from 'antd';
import { CustomerServiceOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function SupportRequests() {
  return (
    <div>
      <PageHeader
        title="Support Requests"
        description="Handle user support tickets"
        icon={<CustomerServiceOutlined />}
      />

      <Card bordered title="Support Requests Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Support Requests management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default SupportRequests;
