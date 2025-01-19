import { format, parseISO } from 'date-fns';

export const formatDate = (date: string | Date): string => {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return format(parsedDate, 'PPP');
};

export const toISODate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};