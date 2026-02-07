import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function Subscriptions() {
  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Manage user subscriptions"
        icon="fa-crown"
      />

      <DataCard title="Subscriptions Management">
        <EmptyState
          icon="fa-crown"
          title="Coming Soon"
          description="Subscriptions management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default Subscriptions;
