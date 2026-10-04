'use client';

import { InterviewCalendar } from '@/components/calendar/InterviewCalendar';

/** Keep the old URL available for bookmarks while exposing the calendar in History. */
export default function CalendarPage() {
  return <InterviewCalendar />;
}
