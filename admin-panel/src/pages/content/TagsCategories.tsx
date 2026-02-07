import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function TagsCategories() {
  return (
    <div>
      <PageHeader
        title="Tags & Categories"
        description="Manage content tags and categories"
        icon="fa-tags"
      />

      <DataCard title="Tags & Categories Management">
        <EmptyState
          icon="fa-tags"
          title="Coming Soon"
          description="Tags & Categories management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default TagsCategories;
