import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function DirectMessages() {
  return (
    <div>
      <PageHeader
        title="Direct Messages"
        description="Monitor user messaging"
        icon="fa-messages"
      />

      <DataCard title="Direct Messages Management">
        <EmptyState
          icon="fa-messages"
          title="Coming Soon"
          description="Direct Messages management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default DirectMessages;
