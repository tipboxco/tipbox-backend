import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function ModerationQueue() {
  return (
    <div>
      <PageHeader
        title="Moderation Queue"
        description="Review flagged content"
        icon="fa-shield-halved"
      />

      <DataCard title="Moderation Queue Management">
        <EmptyState
          icon="fa-shield-halved"
          title="Coming Soon"
          description="Moderation Queue management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default ModerationQueue;
