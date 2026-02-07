import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function SystemSettings() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure system settings"
        icon="fa-sliders"
      />

      <DataCard title="Settings Management">
        <EmptyState
          icon="fa-sliders"
          title="Coming Soon"
          description="Settings management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default SystemSettings;
