import { useEffect, useRef } from "react"
import { Drawer, Button, Text, clx } from "@medusajs/ui"
import type { LogLine } from "./types"

type StreamLogDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  lines: LogLine[]
  loading?: boolean
  jobId?: string | null
}

export const StreamLogDrawer = ({ open, onOpenChange, title, lines, loading, jobId }: StreamLogDrawerProps) => {
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [lines])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <div className="flex items-center justify-between w-full">
            <div>
              <Drawer.Title className="text-sm">Seed çıktısı — {title}</Drawer.Title>
              <Text size="xsmall" className="text-ui-fg-muted mt-0.5">
                {loading ? "Çalışıyor… (gerçek zamanlı)" : "Console çıktısı"}
                {jobId && ` · Job: ${jobId.slice(0, 8)}…`}
              </Text>
            </div>
            <Button variant="secondary" size="small" onClick={() => onOpenChange(false)}>Kapat</Button>
          </div>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col p-0 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 bg-ui-bg-subtle min-h-[60vh]">
            <pre className="text-xs font-mono whitespace-pre-wrap break-words m-0">
              {lines.length === 0 && loading && <div className="text-ui-fg-muted">Loglar geliyor…</div>}
              {lines.map(({ type, line }, i) => (
                <div key={i} className={clx(type === "stderr" && "text-red-600")}>{line}</div>
              ))}
              <div ref={endRef} />
            </pre>
          </div>
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  )
}
