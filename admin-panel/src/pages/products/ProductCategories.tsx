import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function ProductCategories() {
  return (
    <div>
      <PageHeader
        title="Categories"
        description="Manage product categories"
        icon="fa-layer-group"
      />

      <DataCard title="Categories Management">
        <EmptyState
          icon="fa-layer-group"
          title="Coming Soon"
          description="Categories management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default ProductCategories;
