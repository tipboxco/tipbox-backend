import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function ExpertRequests() {
  return (
    <div>
      <PageHeader
        title="Expert Requests"
        description="Manage expert Q&A system"
        icon="fa-user-tie"
      />

      <DataCard title="Expert Requests Management">
        <EmptyState
          icon="fa-user-tie"
          title="Coming Soon"
          description="Expert Requests management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default ExpertRequests;
