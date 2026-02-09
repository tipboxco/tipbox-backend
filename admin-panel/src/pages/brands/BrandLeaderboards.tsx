import { Card, Empty } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function BrandLeaderboards() {
  return (
    <div>
      <PageHeader
        title="Leaderboards"
        description="View brand engagement leaderboards"
        icon={<TrophyOutlined />}
      />

      <Card bordered title="Leaderboards Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Leaderboards management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default BrandLeaderboards;
