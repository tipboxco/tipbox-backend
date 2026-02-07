import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function Lootboxes() {
  return (
    <div>
      <PageHeader
        title="Lootboxes"
        description="Manage lootbox system"
        icon="fa-box-open"
      />

      <DataCard title="Lootboxes Management">
        <EmptyState
          icon="fa-box-open"
          title="Coming Soon"
          description="Lootboxes management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default Lootboxes;
