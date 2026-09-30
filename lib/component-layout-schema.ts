import { z } from 'zod';

/** Presentation metadata only; robot addresses and behavior live on the hardware records. */
export const componentLayoutSchema=z.record(
  z.string().regex(/^(motor|device):[A-Za-z][A-Za-z0-9_]{0,39}$/),
  z.object({x:z.number().finite().min(0).max(1),y:z.number().finite().min(0).max(1)}).strict(),
).refine(value=>Object.keys(value).length<=120,'Too many component positions.');
