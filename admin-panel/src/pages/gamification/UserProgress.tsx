import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function UserProgress() {
  return (
    <div>
      <PageHeader
        title="User Progress"
        description="Track user achievement progress"
        icon="fa-chart-line"
      />

      <DataCard title="User Progress Management">
        <EmptyState
          icon="fa-chart-line"
          title="Coming Soon"
          description="User Progress management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default UserProgress;
