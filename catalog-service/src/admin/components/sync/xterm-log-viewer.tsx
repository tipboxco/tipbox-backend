import { useEffect, useRef } from "react"
import { Terminal } from "@xterm/xterm"
import "@xterm/xterm/css/xterm.css"
import { Text } from "@medusajs/ui"

export type LogLine = { type: "stdout" | "stderr"; line: string }

const ANSI = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
}

type XTermLogViewerProps = {
  lines: LogLine[]
  count: number
  isLive: boolean
}

export function XTermLogViewer({ lines, count, isLive }: XTermLogViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const lastCountRef = useRef(0)

  useEffect(() => {
    if (!containerRef.current) return
    const term = new Terminal({
      theme: {
        background: "#0c0c0c",
        foreground: "#33ff33",
        cursor: "#33ff33",
        cursorAccent: "#0c0c0c",
        selectionBackground: "rgba(51, 255, 51, 0.3)",
      },
      fontSize: 13,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 10000,
      convertEol: true,
      disableStdin: true,
      allowProposedApi: false,
    })
    term.open(containerRef.current)
    terminalRef.current = term
    return () => {
      term.dispose()
      terminalRef.current = null
      lastCountRef.current = 0
    }
  }, [])

  useEffect(() => {
    const term = terminalRef.current
    if (!term) return

    if (lines.length < lastCountRef.current) {
      term.clear()
      lastCountRef.current = 0
    }

    for (let i = lastCountRef.current; i < lines.length; i++) {
      const { type, line } = lines[i]
      const color = type === "stderr" ? ANSI.red : ANSI.green
      const text = (line || " ").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
      term.write(color + text + ANSI.reset + "\r\n")
    }
    lastCountRef.current = lines.length
    term.scrollToBottom()
  }, [lines])

  return (
    <div className="flex flex-col flex-1 min-h-0 rounded-lg overflow-hidden border border-[#2d2d2d] bg-[#0c0c0c] shadow-lg">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2d2d2d] bg-[#1a1a1a] flex-shrink-0">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
        </div>
        <Text size="xsmall" className="text-[#8e8e8e] font-medium ml-2">
          Log — {count} satır{isLive ? " · Canlı" : ""}
        </Text>
      </div>
      <div
        ref={containerRef}
        className="flex-1 min-h-[50vh] w-full overflow-hidden"
        style={{ padding: "12px" }}
      />
    </div>
  )
}
