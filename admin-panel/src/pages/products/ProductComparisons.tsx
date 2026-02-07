import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function ProductComparisons() {
  return (
    <div>
      <PageHeader
        title="Comparisons"
        description="Manage product comparison posts"
        icon="fa-code-compare"
      />

      <DataCard title="Comparisons Management">
        <EmptyState
          icon="fa-code-compare"
          title="Coming Soon"
          description="Comparisons management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default ProductComparisons;
