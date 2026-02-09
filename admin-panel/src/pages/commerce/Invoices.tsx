import { Card, Empty } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function Invoices() {
  return (
    <div>
      <PageHeader
        title="Invoices"
        description="View payment invoices"
        icon={<FileTextOutlined />}
      />

      <Card bordered title="Invoices Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Invoices management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default Invoices;
