import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function ProductGroups() {
  return (
    <div>
      <PageHeader
        title="Product Groups"
        description="Organize products into groups"
        icon="fa-boxes-stacked"
      />

      <DataCard title="Product Groups Management">
        <EmptyState
          icon="fa-boxes-stacked"
          title="Coming Soon"
          description="Product Groups management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default ProductGroups;
