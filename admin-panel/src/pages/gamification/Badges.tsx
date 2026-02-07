import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function Badges() {
  return (
    <div>
      <PageHeader
        title="Badges"
        description="Manage platform badges"
        icon="fa-medal"
      />

      <DataCard title="Badges Management">
        <EmptyState
          icon="fa-medal"
          title="Coming Soon"
          description="Badges management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default Badges;
