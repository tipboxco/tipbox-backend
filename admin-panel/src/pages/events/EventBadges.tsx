import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function EventBadges() {
  return (
    <div>
      <PageHeader
        title="Event Badges"
        description="Configure event-specific badges"
        icon="fa-award"
      />

      <DataCard title="Event Badges Management">
        <EmptyState
          icon="fa-award"
          title="Coming Soon"
          description="Event Badges management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default EventBadges;
