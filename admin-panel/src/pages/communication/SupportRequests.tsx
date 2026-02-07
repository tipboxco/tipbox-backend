import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function SupportRequests() {
  return (
    <div>
      <PageHeader
        title="Support Requests"
        description="Handle user support tickets"
        icon="fa-headset"
      />

      <DataCard title="Support Requests Management">
        <EmptyState
          icon="fa-headset"
          title="Coming Soon"
          description="Support Requests management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default SupportRequests;
