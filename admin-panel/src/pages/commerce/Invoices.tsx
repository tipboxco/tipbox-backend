import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import EmptyState from '../../components/EmptyState';

function Invoices() {
  return (
    <div>
      <PageHeader
        title="Invoices"
        description="View payment invoices"
        icon="fa-file-invoice-dollar"
      />

      <DataCard title="Invoices Management">
        <EmptyState
          icon="fa-file-invoice-dollar"
          title="Coming Soon"
          description="Invoices management interface will be implemented here."
        />
      </DataCard>
    </div>
  );
}

export default Invoices;
