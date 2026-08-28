import { SCHEDULE_FREQUENCY_MS } from "./constants";

// pure - given a frequency and a starting instant, returns the next run time.
export function computeNextRunAt(frequency, from) {
  const ms = SCHEDULE_FREQUENCY_MS[frequency] ?? SCHEDULE_FREQUENCY_MS.weekly;
  return new Date(from.getTime() + ms);
}
