import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function BrandLeaderboards() {
  return (
    <div>
      <PageHeader
        title="Leaderboards"
        description="View brand engagement leaderboards"
        icon="fa-ranking-star"
      />

      <DataCard title="Leaderboards Management">
        <EmptyState
          icon="fa-ranking-star"
          title="Coming Soon"
          description="Leaderboards management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default BrandLeaderboards;
