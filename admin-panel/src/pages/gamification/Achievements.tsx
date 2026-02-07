import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function Achievements() {
  return (
    <div>
      <PageHeader
        title="Achievements"
        description="Define user achievements"
        icon="fa-trophy"
      />

      <DataCard title="Achievements Management">
        <EmptyState
          icon="fa-trophy"
          title="Coming Soon"
          description="Achievements management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default Achievements;
