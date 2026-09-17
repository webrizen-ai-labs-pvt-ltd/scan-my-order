import * as React from "react"
import { format } from "date-fns"
import { Calendar01Icon } from "hugeicons-react"
import { cn } from "@ui/lib/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

export function DatePicker({
  date,
  setDate,
  placeholder = "Pick a date",
  className,
  disabled = false,
  minDate,
  maxDate
}) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (selectedDate) => {
    if (setDate) setDate(selectedDate)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-9 text-xs px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800",
            !date && "text-zinc-500 dark:text-zinc-400",
            className
          )}
        >
          <Calendar01Icon className="mr-2 h-4 w-4 shrink-0 text-zinc-500" />
          {date ? format(new Date(date), "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          minDate={minDate}
          maxDate={maxDate}
        />
      </PopoverContent>
    </Popover>
  )
}

export function DateRangePicker({
  dateRange, // { from, to }
  onDateRangeChange,
  placeholder = "Select date range",
  className,
  disabled = false,
  minDate,
  maxDate,
  align = "start"
}) {
  const [open, setOpen] = React.useState(false)

  const from = dateRange?.from ? new Date(dateRange.from) : null
  const to = dateRange?.to ? new Date(dateRange.to) : null

  const formattedRange = React.useMemo(() => {
    if (!from) return placeholder
    if (!to) return format(from, "MMM dd, yyyy")
    return `${format(from, "MMM dd, yyyy")} - ${format(to, "MMM dd, yyyy")}`
  }, [from, to, placeholder])

  const handleSelect = (range) => {
    if (onDateRangeChange) {
      onDateRangeChange(range)
    }
    if (range?.from && range?.to) {
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-9 text-xs px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800",
            !from && "text-zinc-500 dark:text-zinc-400",
            className
          )}
        >
          <Calendar01Icon className="mr-2 h-4 w-4 shrink-0 text-zinc-500" />
          <span className="truncate">{formattedRange}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800" align={align}>
        <Calendar
          mode="range"
          selected={{ from, to }}
          onSelect={handleSelect}
          minDate={minDate}
          maxDate={maxDate}
        />
      </PopoverContent>
    </Popover>
  )
}
