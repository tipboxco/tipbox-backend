import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function TrendingPosts() {
  return (
    <div>
      <PageHeader
        title="Trending Posts"
        description="View and manage trending content"
        icon="fa-fire"
      />

      <DataCard title="Trending Posts Management">
        <EmptyState
          icon="fa-fire"
          title="Coming Soon"
          description="Trending Posts management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default TrendingPosts;
