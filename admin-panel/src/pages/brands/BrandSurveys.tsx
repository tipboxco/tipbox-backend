import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function BrandSurveys() {
  return (
    <div>
      <PageHeader
        title="Brand Surveys"
        description="Create and manage brand surveys"
        icon="fa-clipboard-question"
      />

      <DataCard title="Brand Surveys Management">
        <EmptyState
          icon="fa-clipboard-question"
          title="Coming Soon"
          description="Brand Surveys management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default BrandSurveys;
