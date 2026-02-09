import { Card, Empty } from 'antd';
import { FormOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

function BrandSurveys() {
  return (
    <div>
      <PageHeader
        title="Brand Surveys"
        description="Create and manage brand surveys"
        icon={<FormOutlined />}
      />

      <Card bordered title="Brand Surveys Management">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Brand Surveys management interface will be implemented here."
        />
      </Card>
    </div>
  );
}

export default BrandSurveys;
