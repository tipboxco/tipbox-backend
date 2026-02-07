import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function UserInventories() {
  return (
    <div>
      <PageHeader
        title="User Inventories"
        description="View user product ownership"
        icon="fa-clipboard-list"
      />

      <DataCard title="User Inventories Management">
        <EmptyState
          icon="fa-clipboard-list"
          title="Coming Soon"
          description="User Inventories management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default UserInventories;
