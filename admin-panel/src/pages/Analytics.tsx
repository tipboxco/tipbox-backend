import { Card, Empty, Button } from 'antd';
import { PieChartOutlined, DownloadOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';

function Analytics() {
  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Manage platform analytics"
        icon={<PieChartOutlined />}
        actions={<Button icon={<DownloadOutlined />}>Export Report</Button>}
      />

      <Card bordered title="Analytics Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Analytics management interface will be implemented here."
        >
          <Button>Learn More</Button>
        </Empty>
      </Card>
    </div>
  );
}

export default Analytics;
