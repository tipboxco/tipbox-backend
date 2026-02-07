import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function ModerationActions() {
  return (
    <div>
      <PageHeader
        title="Moderation Actions"
        description="Review moderation history"
        icon="fa-shield"
      />

      <DataCard title="Moderation Actions Management">
        <EmptyState
          icon="fa-shield"
          title="Coming Soon"
          description="Moderation Actions management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default ModerationActions;
