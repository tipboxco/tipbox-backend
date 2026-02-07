import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function NFTs() {
  return (
    <div>
      <PageHeader
        title="NFTs"
        description="Manage platform NFT assets"
        icon="fa-image"
      />

      <DataCard title="NFTs Management">
        <EmptyState
          icon="fa-image"
          title="Coming Soon"
          description="NFTs management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default NFTs;
