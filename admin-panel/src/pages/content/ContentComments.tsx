import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function ContentComments() {
  return (
    <div>
      <PageHeader
        title="Comments"
        description="Moderate user comments"
        icon="fa-comments"
      />

      <DataCard title="Comments Management">
        <EmptyState
          icon="fa-comments"
          title="Coming Soon"
          description="Comments management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default ContentComments;
