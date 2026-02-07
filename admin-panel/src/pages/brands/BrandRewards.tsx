import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function BrandRewards() {
  return (
    <div>
      <PageHeader
        title="Rewards"
        description="Manage brand rewards and incentives"
        icon="fa-gift"
      />

      <DataCard title="Rewards Management">
        <EmptyState
          icon="fa-gift"
          title="Coming Soon"
          description="Rewards management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default BrandRewards;
