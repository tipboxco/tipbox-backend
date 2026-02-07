import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function TokenTransfers() {
  return (
    <div>
      <PageHeader
        title="Token Transfers"
        description="View TIPS token transactions"
        icon="fa-arrow-right-arrow-left"
      />

      <DataCard title="Token Transfers Management">
        <EmptyState
          icon="fa-arrow-right-arrow-left"
          title="Coming Soon"
          description="Token Transfers management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default TokenTransfers;
