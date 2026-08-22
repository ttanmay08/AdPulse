export interface DateRangePreset {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
}

export const DATASET_START = '2024-01-01';
export const DATASET_END = '2024-12-30';

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  { key: 'full_year', label: 'Full year 2024', startDate: '2024-01-01', endDate: '2024-12-31' },
  { key: 'q1', label: 'Q1 2024', startDate: '2024-01-01', endDate: '2024-03-31' },
  { key: 'q2', label: 'Q2 2024', startDate: '2024-04-01', endDate: '2024-06-30' },
  { key: 'q3', label: 'Q3 2024', startDate: '2024-07-01', endDate: '2024-09-30' },
  { key: 'q4', label: 'Q4 2024', startDate: '2024-10-01', endDate: '2024-12-31' },
];

export function matchingPresetKey(startDate: string, endDate: string): string | null {
  const preset = DATE_RANGE_PRESETS.find((p) => p.startDate === startDate && p.endDate === endDate);
  return preset?.key ?? null;
}
