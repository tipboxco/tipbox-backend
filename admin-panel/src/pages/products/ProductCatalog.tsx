import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function ProductCatalog() {
  return (
    <div>
      <PageHeader
        title="Product Catalog"
        description="Manage product database"
        icon="fa-box"
      />

      <DataCard title="Product Catalog Management">
        <EmptyState
          icon="fa-box"
          title="Coming Soon"
          description="Product Catalog management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default ProductCatalog;
