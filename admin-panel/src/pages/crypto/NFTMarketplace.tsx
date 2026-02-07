import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function NFTMarketplace() {
  return (
    <div>
      <PageHeader
        title="NFT Marketplace"
        description="Monitor NFT marketplace activity"
        icon="fa-shop"
      />

      <DataCard title="NFT Marketplace Management">
        <EmptyState
          icon="fa-shop"
          title="Coming Soon"
          description="NFT Marketplace management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default NFTMarketplace;
