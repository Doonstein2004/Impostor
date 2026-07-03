import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.daily(
  'purge old rooms',
  { hourUTC: 4, minuteUTC: 0 },
  internal.cleanup.purgeOldRooms,
);

export default crons;
