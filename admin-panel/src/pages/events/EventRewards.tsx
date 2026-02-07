import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function EventRewards() {
  return (
    <div>
      <PageHeader
        title="Event Rewards"
        description="Set up event reward structures"
        icon="fa-trophy"
      />

      <DataCard title="Event Rewards Management">
        <EmptyState
          icon="fa-trophy"
          title="Coming Soon"
          description="Event Rewards management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default EventRewards;
