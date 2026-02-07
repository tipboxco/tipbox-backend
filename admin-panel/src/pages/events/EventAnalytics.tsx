import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function EventAnalytics() {
  return (
    <div>
      <PageHeader
        title="Event Analytics"
        description="View event performance metrics"
        icon="fa-chart-column"
      />

      <DataCard title="Event Analytics Management">
        <EmptyState
          icon="fa-chart-column"
          title="Coming Soon"
          description="Event Analytics management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default EventAnalytics;
