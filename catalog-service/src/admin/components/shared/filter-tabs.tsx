import { clx } from "@medusajs/ui"

type FilterTab = {
  id: string
  label: string
  count?: number
  color?: "default" | "green" | "red"
}

type FilterTabsProps = {
  tabs: FilterTab[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export const FilterTabs = ({ tabs, activeTab, onTabChange }: FilterTabsProps) => {
  return (
    <div className="flex items-center gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={clx(
            "px-2.5 py-1 text-xs rounded transition-all font-medium",
            activeTab === tab.id
              ? tab.color === "green"
                ? "bg-emerald-50 text-emerald-700"
                : tab.color === "red"
                ? "bg-red-50 text-red-700"
                : "bg-ui-bg-base text-ui-fg-base shadow-sm"
              : "text-ui-fg-muted hover:text-ui-fg-base hover:bg-ui-bg-subtle"
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1 opacity-60">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

