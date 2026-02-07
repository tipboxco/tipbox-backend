import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function BrandList() {
  return (
    <div>
      <PageHeader
        title="Brands"
        description="Manage brand partnerships"
        icon="fa-store"
      />

      <DataCard title="Brands Management">
        <EmptyState
          icon="fa-store"
          title="Coming Soon"
          description="Brands management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default BrandList;
