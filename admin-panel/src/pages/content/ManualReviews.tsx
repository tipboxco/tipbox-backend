import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function ManualReviews() {
  return (
    <div>
      <PageHeader
        title="Manual Reviews"
        description="Content flagged for manual review"
        icon="fa-magnifying-glass"
      />

      <DataCard title="Manual Reviews Management">
        <EmptyState
          icon="fa-magnifying-glass"
          title="Coming Soon"
          description="Manual Reviews management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default ManualReviews;
