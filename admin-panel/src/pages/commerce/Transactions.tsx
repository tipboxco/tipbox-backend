import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function Transactions() {
  return (
    <div>
      <PageHeader
        title="Transactions"
        description="View all platform transactions"
        icon="fa-receipt"
      />

      <DataCard title="Transactions Management">
        <EmptyState
          icon="fa-receipt"
          title="Coming Soon"
          description="Transactions management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default Transactions;
