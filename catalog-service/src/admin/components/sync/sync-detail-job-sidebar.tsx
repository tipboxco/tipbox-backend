import { Button, Text, IconButton } from "@medusajs/ui"
import { ArrowPath, Clock, PlaySolid } from "@medusajs/icons"
import { FilterTabs } from "../shared"
import { SyncJobItem } from "./sync-job-item"
import { useSyncDetail } from "./sync-detail-context"
import type { SyncJob } from "./types"

function groupJobsByDate(jobs: SyncJob[]): Record<string, SyncJob[]> {
  return jobs.reduce((acc, job) => {
    const date = new Date(job.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
    if (!acc[date]) acc[date] = []
    acc[date].push(job)
    return acc
  }, {} as Record<string, SyncJob[]>)
}

export function SyncDetailJobSidebar() {
  const { jobs, jobFilter, setJobFilter, selectedJob, setSelectedJob, fetchInitialData, handleRunSync } = useSyncDetail()

  const filteredJobs = jobs.filter((job) => {
    if (jobFilter === "completed") return job.status === "completed"
    if (jobFilter === "failed") return job.status === "failed"
    return true
  })
  const groupedJobs = groupJobsByDate(filteredJobs)
  const completedCount = jobs.filter((j) => j.status === "completed").length
  const failedCount = jobs.filter((j) => j.status === "failed").length

  return (
    <>
      <div className="flex items-center gap-1 px-3 py-2 border-b border-ui-border-base">
        <FilterTabs
          tabs={[
            { id: "all", label: "All", count: jobs.length },
            { id: "completed", label: "OK", count: completedCount, color: "green" },
            { id: "failed", label: "Fail", count: failedCount, color: "red" },
          ]}
          activeTab={jobFilter}
          onTabChange={(t) => setJobFilter(t as "all" | "completed" | "failed")}
        />
        <div className="flex-1" />
        <IconButton variant="transparent" size="small" onClick={fetchInitialData}>
          <ArrowPath className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center px-4">
            <Clock className="h-8 w-8 text-ui-fg-muted mb-2" />
            <Text weight="plus" className="text-sm mb-1">Henüz job yok</Text>
            <Text size="xsmall" className="text-ui-fg-muted mb-3">Sync başlatın</Text>
            <Button variant="secondary" size="small" onClick={handleRunSync}>
              <PlaySolid className="h-3 w-3 mr-1" />Başlat
            </Button>
          </div>
        ) : (
          Object.entries(groupedJobs).map(([date, dateJobs]) => (
            <div key={date}>
              <div className="px-3 py-1.5 bg-ui-bg-subtle border-b border-ui-border-base sticky top-0">
                <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase tracking-wider">{date}</Text>
              </div>
              {dateJobs.map((job) => (
                <SyncJobItem
                  key={job.id}
                  id={job.id}
                  status={job.status}
                  currentBatch={job.current_batch}
                  totalBatches={job.total_batches}
                  processedRecords={job.processed_records}
                  totalRecords={job.total_records}
                  startedAt={job.started_at}
                  createdAt={job.created_at}
                  isSelected={selectedJob?.id === job.id}
                  onClick={() => setSelectedJob(job)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </>
  )
}
