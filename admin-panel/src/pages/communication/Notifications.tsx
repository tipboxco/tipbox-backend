import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function Notifications() {
  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Manage system notifications"
        icon="fa-bell"
      />

      <DataCard title="Notifications Management">
        <EmptyState
          icon="fa-bell"
          title="Coming Soon"
          description="Notifications management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default Notifications;
