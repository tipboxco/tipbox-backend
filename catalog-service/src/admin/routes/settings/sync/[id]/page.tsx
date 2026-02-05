import { useParams, useNavigate } from "react-router-dom"
import { Button, Heading } from "@medusajs/ui"
import { ExclamationCircle, Spinner } from "@medusajs/icons"
import {
  SyncDetailProvider,
  useSyncDetail,
  SyncDetailHeader,
  SyncDetailStatsBar,
  SyncDetailJobSidebar,
  SyncDetailJobPlaceholder,
  SyncDetailDeleteModal,
  SyncForm,
  SyncJobDetail,
  SplitView,
} from "../../../../components"

function SyncDetailContent() {
  const navigate = useNavigate()
  const {
    config,
    stats,
    jobs,
    selectedJob,
    loading,
    editDrawerOpen,
    setEditDrawerOpen,
    saving,
    handleSave,
    handleCancelJob,
    cancellingJob,
    streamLogLines,
    streamJobId,
  } = useSyncDetail()

  const hasRunningJob = jobs.some((j) => j.status === "running" || j.status === "pending")

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <Spinner className="animate-spin h-6 w-6 text-cyan-600" />
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <ExclamationCircle className="h-10 w-10 text-ui-fg-muted mx-auto mb-3" />
          <Heading level="h2" className="text-base mb-2">Sync bulunamadı</Heading>
          <Button variant="secondary" size="small" onClick={() => navigate("/settings/sync")}>
            Geri Dön
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-ui-bg-subtle">
      <SyncDetailHeader hasRunningJob={hasRunningJob} />
      {stats && <SyncDetailStatsBar />}

      <SplitView
        leftWidth="w-[360px]"
        leftPanel={<SyncDetailJobSidebar />}
        rightPanel={
          selectedJob ? (
            <SyncJobDetail
              job={jobs.find((j) => j.id === selectedJob.id) ?? selectedJob}
              batchSize={config.batch_size}
              targetUrl={config.target_url}
              onCancel={() => handleCancelJob(selectedJob)}
              cancelling={cancellingJob === selectedJob.id}
              liveLogLines={selectedJob.id === streamJobId ? streamLogLines : undefined}
            />
          ) : (
            <SyncDetailJobPlaceholder />
          )
        }
      />

      <SyncForm
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
        initialData={{
          name: config.name,
          module_type: config.module_type,
          target_url: config.target_url,
          secret_token: config.secret_token || "",
          batch_size: config.batch_size,
          is_active: config.is_active,
        }}
        onSave={handleSave}
        isEditing
        saving={saving}
      />

      <SyncDetailDeleteModal />
    </div>
  )
}

export default function SyncDetailPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <SyncDetailProvider configId={id}>
      <SyncDetailContent />
    </SyncDetailProvider>
  )
}
