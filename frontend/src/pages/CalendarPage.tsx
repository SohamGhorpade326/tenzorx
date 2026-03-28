import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, addDays, parseISO } from 'date-fns';
import { CalendarDays, ExternalLink, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCalendarEvents, MeetingScheduleEvent } from '@/lib/api';

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => getCalendarEvents(),
  });

  const events = data?.events ?? [];

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, MeetingScheduleEvent[]>();
    for (const event of events) {
      const existing = grouped.get(event.event_date) ?? [];
      existing.push(event);
      grouped.set(event.event_date, existing);
    }
    return grouped;
  }, [events]);

  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selectedEvents = selectedDateKey ? eventsByDate.get(selectedDateKey) ?? [] : [];

  const scheduledDays = useMemo(() => {
    return Array.from(eventsByDate.keys()).map((dateStr) => parseISO(dateStr));
  }, [eventsByDate]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Meeting Calendar
            </CardTitle>
            <CardDescription>
              Dates are auto-extracted from transcripts when phrases like "next meeting on 29th March 2026" are found.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
          <div className="rounded-xl border bg-muted/20 p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={{ scheduled: scheduledDays }}
              modifiersClassNames={{
                scheduled: 'bg-green-600 text-white hover:bg-green-600 hover:text-white rounded-md',
              }}
              className="w-full"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">
                {selectedDate ? format(selectedDate, 'dd MMMM yyyy') : 'Select a date'}
              </h3>
              <Badge variant="secondary">{selectedEvents.length} scheduled</Badge>
            </div>

            {selectedEvents.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground"
              >
                No meeting is scheduled on this date.
              </motion.div>
            ) : (
              <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-3">
                <AnimatePresence>
                  {selectedEvents.map((event) => (
                    <motion.div key={event.id} variants={itemVariants} layout exit={{ opacity: 0, scale: 0.95 }}>
                      <Card className="border shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold">
                            {event.source_title || 'Meeting'}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Decided in: {event.decided_in_meeting_title || event.source_title || 'Unknown meeting'}
                            {event.decided_in_meeting_date ? ` on ${format(parseISO(event.decided_in_meeting_date), 'dd MMM yyyy')}` : ''}
                          </CardDescription>
                          <CardDescription className="text-xs">{event.source_text || 'Scheduled from transcript'}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <a
                            href={buildGoogleCalendarUrl(event)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                          >
                            Add to Google Calendar
                            <ExternalLink className="ml-1 h-3.5 w-3.5" />
                          </a>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

            <div className="rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground">
              Automatic write-back to your Google Calendar needs Google OAuth + Calendar API credentials.
              This page already supports one-click Google event creation via prefilled links.
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function buildGoogleCalendarUrl(event: MeetingScheduleEvent): string {
  const start = format(parseISO(event.event_date), 'yyyyMMdd');
  const end = format(addDays(parseISO(event.event_date), 1), 'yyyyMMdd');
  const title = event.source_title || 'Scheduled Meeting';
  const context = `${event.decided_in_meeting_title || event.source_title || 'Meeting'}${event.decided_in_meeting_date ? ` on ${event.decided_in_meeting_date}` : ''}`;
  const details = `${event.source_text || 'Created from Workstream-AI transcript extraction'}\n\nDecided in: ${context}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
