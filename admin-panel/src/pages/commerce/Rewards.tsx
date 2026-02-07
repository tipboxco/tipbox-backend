import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function Rewards() {
  return (
    <div>
      <PageHeader
        title="Rewards"
        description="Manage reward claims and distribution"
        icon="fa-coins"
      />

      <DataCard title="Rewards Management">
        <EmptyState
          icon="fa-coins"
          title="Coming Soon"
          description="Rewards management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default Rewards;
