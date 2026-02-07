import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function BadgeCollections() {
  return (
    <div>
      <PageHeader
        title="Badge Collections"
        description="Organize badges into collections"
        icon="fa-folder-open"
      />

      <DataCard title="Badge Collections Management">
        <EmptyState
          icon="fa-folder-open"
          title="Coming Soon"
          description="Badge Collections management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default BadgeCollections;
