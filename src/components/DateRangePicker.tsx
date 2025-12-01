"use client"

import * as React from "react"
import { addDays, format, subDays, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, startOfYear, subYears } from 'date-fns';
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

export function DatePickerWithRange({
    className,
    date,
    setDate,
}: React.HTMLAttributes<HTMLDivElement> & {
    date: DateRange | undefined
    setDate: (date: DateRange | undefined) => void
}) {
    const [isOpen, setIsOpen] = React.useState(false);

    const [selectedPreset, setSelectedPreset] = React.useState<string | null>(null);

    const presets = [
        {
            label: 'Today',
            getValue: () => ({
                from: startOfDay(new Date()),
                to: endOfDay(new Date()),
            }),
        },
        {
            label: 'Yesterday',
            getValue: () => ({
                from: startOfDay(subDays(new Date(), 1)),
                to: endOfDay(subDays(new Date(), 1)),
            }),
        },
        {
            label: 'Last 7 days',
            getValue: () => ({
                from: startOfDay(subDays(new Date(), 7)),
                to: endOfDay(new Date()),
            }),
        },
        {
            label: 'Last 14 days',
            getValue: () => ({
                from: startOfDay(subDays(new Date(), 14)),
                to: endOfDay(new Date()),
            }),
        },
        {
            label: 'Last 30 days',
            getValue: () => ({
                from: startOfDay(subDays(new Date(), 30)),
                to: endOfDay(new Date()),
            }),
        },
        {
            label: 'Last 60 days',
            getValue: () => ({
                from: startOfDay(subDays(new Date(), 60)),
                to: endOfDay(new Date()),
            }),
        },
        {
            label: 'Last 90 days',
            getValue: () => ({
                from: startOfDay(subDays(new Date(), 90)),
                to: endOfDay(new Date()),
            }),
        },
        {
            label: 'This Month',
            getValue: () => ({
                from: startOfMonth(new Date()),
                to: endOfMonth(new Date()),
            }),
        },
        {
            label: 'Last Month',
            getValue: () => ({
                from: startOfMonth(subMonths(new Date(), 1)),
                to: endOfMonth(subMonths(new Date(), 1)),
            }),
        },
        {
            label: 'Last 3 Months',
            getValue: () => ({
                from: startOfMonth(subMonths(new Date(), 3)),
                to: endOfDay(new Date()),
            }),
        },
        {
            label: 'Last 6 Months',
            getValue: () => ({
                from: startOfMonth(subMonths(new Date(), 6)),
                to: endOfDay(new Date()),
            }),
        },
        {
            label: 'This Year',
            getValue: () => ({
                from: startOfYear(new Date()),
                to: endOfDay(new Date()),
            }),
        },
        {
            label: 'Last Year',
            getValue: () => ({
                from: startOfYear(subYears(new Date(), 1)),
                to: endOfDay(subYears(new Date(), 1)),
            }),
        },
        {
            label: 'Maximum',
            getValue: () => ({
                from: startOfDay(new Date(2020, 0, 1)), // ตั้งแต่ 1 มกราคม 2020
                to: endOfDay(new Date()),
            }),
        },
    ];

    const handlePresetSelect = (preset: { label: string, getValue: () => DateRange }) => {
        setSelectedPreset(preset.label);
        setDate(preset.getValue());
        setIsOpen(false); // ปิดทันทีหลังเลือก
    };

    const handleCalendarSelect = (newDate: DateRange | undefined) => {
        setSelectedPreset(null); // Clear preset when using calendar
        setDate(newDate);
    };

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-[300px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "LLL dd, y")} -{" "}
                                    {format(date.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Pick a date</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <div className="flex">
                        {/* ปรับความกว้างของ sidebar presets ตรงนี้: w-[140px] */}
                        <div className="border-r p-2 space-y-0.5 w-[180px]">
                            {presets.map((preset) => (
                                <button
                                    key={preset.label}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-100 rounded transition-colors text-left"
                                    onClick={() => handlePresetSelect(preset)}
                                >
                                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedPreset === preset.label ? 'border-blue-500' : 'border-gray-300'}`}>
                                        {selectedPreset === preset.label && (
                                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                                        )}
                                    </span>
                                    {/* ปรับขนาดตัวอักษรของ preset label ตรงนี้: text-sm หรือ text-xs */}
                                    <span className="text-gray-700 text-sm">{preset.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="p-2">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={handleCalendarSelect}
                                numberOfMonths={2}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                                <Button onClick={() => setIsOpen(false)}>Apply</Button>
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
