import { useState, KeyboardEvent } from "react"
import { Input, Badge, IconButton, Text } from "@medusajs/ui"
import { XMark, PlusMini } from "@medusajs/icons"

type TagInputProps = {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  label?: string
  description?: string
}

export const TagInput = ({
  value = [],
  onChange,
  placeholder = "Tag ekleyin ve Enter'a basın...",
  label,
  description,
}: TagInputProps) => {
  const [inputValue, setInputValue] = useState("")

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault()
      addTag(inputValue.trim())
    }
  }

  const addTag = (tag: string) => {
    if (tag && !value.includes(tag)) {
      onChange([...value, tag])
      setInputValue("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove))
  }

  const handleAddClick = () => {
    if (inputValue.trim()) {
      addTag(inputValue.trim())
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <Text size="small" weight="plus" className="text-ui-fg-base">
          {label}
        </Text>
      )}
      
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <IconButton
            variant="transparent"
            size="small"
            onClick={handleAddClick}
            disabled={!inputValue.trim()}
            type="button"
          >
            <PlusMini className="h-4 w-4" />
          </IconButton>
        </div>

        {value.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 bg-ui-bg-subtle rounded-lg border border-ui-border-base min-h-[60px]">
            {value.map((tag, index) => (
              <Badge
                key={index}
                color="blue"
                size="small"
                className="flex items-center gap-1 pr-1"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-1 hover:bg-ui-bg-base-hover rounded-full p-0.5 transition-colors"
                  aria-label={`${tag} tag'ini kaldır`}
                >
                  <XMark className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {description && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {description}
        </Text>
      )}
    </div>
  )
}
