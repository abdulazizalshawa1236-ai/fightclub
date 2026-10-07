import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException({
      code: 'INVALID_INPUT',
      message: result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; '),
    });
  return result.data;
}
export const nationalIdSchema = z
  .string()
  .regex(/^[12]\d{9}$/, 'Use a valid 10 digit National ID or Iqama');
export const phoneSchema = z
  .string()
  .transform((value) =>
    value
      .replace(/[\s()+-]/g, '')
      .replace(/^00/, '')
      .replace(/^05/, '9665'),
  )
  .pipe(z.string().regex(/^9665\d{8}$/, 'Use a Saudi mobile number'));
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
    'Invalid calendar date',
  );
export const uuidSchema = z.string().uuid();
