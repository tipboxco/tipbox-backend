import { clx } from "@medusajs/ui"
import { ReactNode } from "react"

type SplitViewProps = {
  leftPanel: ReactNode
  rightPanel: ReactNode
  leftWidth?: string
  className?: string
}

export const SplitView = ({ 
  leftPanel, 
  rightPanel, 
  leftWidth = "w-[380px]",
  className 
}: SplitViewProps) => {
  return (
    <div className={clx("flex flex-1 overflow-hidden", className)}>
      <div className={clx(leftWidth, "border-r border-ui-border-base flex flex-col bg-white")}>
        {leftPanel}
      </div>
      <div className="flex-1 overflow-y-auto bg-white">
        {rightPanel}
      </div>
    </div>
  )
}

