import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function AchievementChains() {
  return (
    <div>
      <PageHeader
        title="Achievement Chains"
        description="Create progressive achievement chains"
        icon="fa-link"
      />

      <DataCard title="Achievement Chains Management">
        <EmptyState
          icon="fa-link"
          title="Coming Soon"
          description="Achievement Chains management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default AchievementChains;
