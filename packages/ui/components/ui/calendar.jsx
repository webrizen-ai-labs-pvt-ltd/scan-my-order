import * as React from "react"
import { ArrowLeft01Icon, ArrowRight01Icon } from "hugeicons-react"
import { cn } from "@ui/lib/utils"

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

function isSameDay(d1, d2) {
  if (!d1 || !d2) return false
  const date1 = new Date(d1)
  const date2 = new Date(d2)
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

function isDateInRange(date, from, to) {
  if (!date || !from || !to) return false
  const d = new Date(date).setHours(0, 0, 0, 0)
  const f = new Date(from).setHours(0, 0, 0, 0)
  const t = new Date(to).setHours(0, 0, 0, 0)
  return d >= Math.min(f, t) && d <= Math.max(f, t)
}

export function Calendar({
  mode = "single", // "single" | "range"
  selected,
  onSelect,
  className,
  initialMonth,
  minDate,
  maxDate
}) {
  const getInitialDate = () => {
    if (initialMonth) return new Date(initialMonth)
    if (mode === "single" && selected) return new Date(selected)
    if (mode === "range" && selected?.from) return new Date(selected.from)
    return new Date()
  }

  const [currentMonthDate, setCurrentMonthDate] = React.useState(getInitialDate)
  const [hoverDate, setHoverDate] = React.useState(null)

  const year = currentMonthDate.getFullYear()
  const month = currentMonthDate.getMonth()

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1))
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentMonthDate(new Date(today.getFullYear(), today.getMonth(), 1))
    if (mode === "single" && onSelect) {
      onSelect(today)
    }
  }

  // Generate calendar grid
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const calendarDays = []

  // Leading days from previous month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const prevDate = new Date(year, month - 1, daysInPrevMonth - i)
    calendarDays.push({
      date: prevDate,
      isCurrentMonth: false
    })
  }

  // Days in current month
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    calendarDays.push({
      date,
      isCurrentMonth: true
    })
  }

  // Trailing days to fill 42 cells (6 rows of 7)
  const remainingDays = 42 - calendarDays.length
  for (let i = 1; i <= remainingDays; i++) {
    const nextDate = new Date(year, month + 1, i)
    calendarDays.push({
      date: nextDate,
      isCurrentMonth: false
    })
  }

  const handleDayClick = (date) => {
    if (!onSelect) return

    if (mode === "single") {
      onSelect(date)
    } else if (mode === "range") {
      const from = selected?.from ? new Date(selected.from) : null
      const to = selected?.to ? new Date(selected.to) : null

      if (!from || (from && to)) {
        // Start fresh range
        onSelect({ from: date, to: null })
      } else {
        // Complete range
        if (date < from) {
          onSelect({ from: date, to: from })
        } else {
          onSelect({ from, to: date })
        }
      }
    }
  }

  const today = new Date()

  return (
    <div className={cn("p-3 select-none space-y-3 bg-white dark:bg-zinc-900", className)}>
      {/* Month & Year Navigation Header */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
          aria-label="Previous month"
        >
          <ArrowLeft01Icon size={16} />
        </button>

        <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <span>{MONTH_NAMES[month]}</span>
          <span className="text-zinc-500 font-normal">{year}</span>
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
          aria-label="Next month"
        >
          <ArrowRight01Icon size={16} />
        </button>
      </div>

      {/* Days of Week Row */}
      <div className="grid grid-cols-7 text-center">
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day Cells Grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {calendarDays.map(({ date, isCurrentMonth }, idx) => {
          const isTodayDate = isSameDay(date, today)

          let isSelected = false
          let isRangeStart = false
          let isRangeEnd = false
          let isInRange = false

          if (mode === "single") {
            isSelected = isSameDay(date, selected)
          } else if (mode === "range") {
            const from = selected?.from ? new Date(selected.from) : null
            const to = selected?.to ? new Date(selected.to) : null

            isRangeStart = isSameDay(date, from)
            isRangeEnd = isSameDay(date, to)
            isSelected = isRangeStart || isRangeEnd

            if (from && to) {
              isInRange = isDateInRange(date, from, to)
            } else if (from && !to && hoverDate) {
              isInRange = isDateInRange(date, from, hoverDate)
            }
          }

          const isDisabled =
            (minDate && date < new Date(minDate).setHours(0, 0, 0, 0)) ||
            (maxDate && date > new Date(maxDate).setHours(23, 59, 59, 999))

          return (
            <div
              key={idx}
              className={cn(
                "relative flex items-center justify-center p-0.5",
                isInRange && !isSelected && "bg-yellow-500/10 dark:bg-yellow-500/15",
                isRangeStart && selected?.to && "rounded-l-lg bg-yellow-500/20",
                isRangeEnd && selected?.from && "rounded-r-lg bg-yellow-500/20"
              )}
            >
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => handleDayClick(date)}
                onMouseEnter={() => mode === "range" && setHoverDate(date)}
                className={cn(
                  "size-8 text-xs rounded-lg flex items-center justify-center transition-all cursor-pointer font-medium",
                  !isCurrentMonth && "text-zinc-300 dark:text-zinc-600 opacity-60",
                  isCurrentMonth && !isSelected && !isInRange && "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                  isTodayDate && !isSelected && "border border-yellow-500/50 text-yellow-600 dark:text-yellow-400 font-bold",
                  isSelected && "bg-yellow-500 text-zinc-950 font-bold shadow-xs hover:bg-yellow-400",
                  isDisabled && "opacity-25 cursor-not-allowed pointer-events-none"
                )}
              >
                {date.getDate()}
              </button>
            </div>
          )
        })}
      </div>

      {/* Footer Quick Action */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-xs">
        <button
          type="button"
          onClick={handleToday}
          className="text-xs text-yellow-600 dark:text-yellow-400 hover:underline font-medium"
        >
          Jump to Today
        </button>
        {mode === "range" && selected?.from && (
          <span className="text-[10px] text-zinc-400">
            {selected.to ? "Range selected" : "Click end date"}
          </span>
        )}
      </div>
    </div>
  )
}
