import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function ContentPosts() {
  return (
    <div>
      <PageHeader
        title="All Posts"
        description="Manage user-generated content posts"
        icon="fa-newspaper"
      />

      <DataCard title="All Posts Management">
        <EmptyState
          icon="fa-newspaper"
          title="Coming Soon"
          description="All Posts management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default ContentPosts;
