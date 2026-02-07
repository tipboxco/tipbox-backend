import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function Wallets() {
  return (
    <div>
      <PageHeader
        title="Wallets"
        description="Manage user crypto wallets"
        icon="fa-wallet"
      />

      <DataCard title="Wallets Management">
        <EmptyState
          icon="fa-wallet"
          title="Coming Soon"
          description="Wallets management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default Wallets;
