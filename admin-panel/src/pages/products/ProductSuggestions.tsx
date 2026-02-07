import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function ProductSuggestions() {
  return (
    <div>
      <PageHeader
        title="Product Suggestions"
        description="Review user-submitted products"
        icon="fa-lightbulb"
      />

      <DataCard title="Product Suggestions Management">
        <EmptyState
          icon="fa-lightbulb"
          title="Coming Soon"
          description="Product Suggestions management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default ProductSuggestions;
