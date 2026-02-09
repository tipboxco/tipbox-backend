import { Card, Empty } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function ExpertRequests() {
  return (
    <div>
      <PageHeader
        title="Expert Requests"
        description="Manage expert Q&A system"
        icon={<UserOutlined />}
      />

      <Card bordered title="Expert Requests Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Expert Requests management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default ExpertRequests;
