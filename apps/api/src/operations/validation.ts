import { z } from 'zod';
import { dateSchema, phoneSchema } from '../core/validation';

const localized = z.object({ ar: z.string().max(12000), en: z.string().max(12000) }).strict();
const title = z
  .object({ ar: z.string().trim().min(1).max(250), en: z.string().trim().min(1).max(250) })
  .strict();
export const catalogueIdSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/);
export const imageSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    if (/^\/assets\/[a-zA-Z0-9_./-]+$/.test(value)) return !value.split('/').includes('..');
    const base = process.env.MEDIA_PUBLIC_URL;
    if (!base) return false;
    try {
      const url = new URL(value);
      const allowed = new URL(base.endsWith('/') ? base : `${base}/`);
      return (
        url.origin === allowed.origin &&
        url.pathname.startsWith(allowed.pathname) &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  }, 'Use a club asset or an uploaded media URL');
const optionalPublicUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Use an HTTPS URL');
const money = z
  .number()
  .finite()
  .nonnegative()
  .max(1000000)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001,
    'Use at most two decimal places',
  );
export const settingsSchema = z
  .object({
    name: title,
    tagline: title,
    phone: z.string().regex(/^[+0-9 ()-]{8,25}$/),
    whatsapp: phoneSchema,
    email: z.string().email().max(254),
    address: title,
    hours: localized,
    mapUrl: optionalPublicUrl,
    instagram: optionalPublicUrl,
    warningDays: z.number().int().min(0).max(90),
    metaDescription: localized.optional(),
    currencyLabel: localized.optional(),
    countryCode: z
      .string()
      .regex(/^\d{1,4}$/)
      .optional(),
    marquee: localized.optional(),
    weekStart: z.number().int().min(0).max(6).optional(),
    footerText: localized.optional(),
    socialLinks: z
      .object({ x: optionalPublicUrl, snapchat: optionalPublicUrl, tiktok: optionalPublicUrl })
      .strict()
      .optional(),
    notificationText: z
      .object({ expiring: title, expired: title, renewed: title })
      .strict()
      .optional(),
  })
  .strict();
export const planInputSchema = z
  .object({
    name: title,
    price: money,
    oldPrice: money.nullable(),
    currency: z.literal('SAR'),
    durationDays: z.number().int().min(1).max(3660),
    durationLabel: title,
    sportLimit: z.number().int().min(1).max(20).nullable(),
    benefits: z.array(title).max(30),
    featured: z.boolean(),
    visible: z.boolean(),
    badge: localized.optional(),
    position: z.number().int().nonnegative().max(10000).optional(),
  })
  .strict();
export const planSchema = planInputSchema.extend({ id: catalogueIdSchema });
export const offerInputSchema = z
  .object({
    title,
    description: localized,
    badge: title,
    terms: localized,
    startsOn: dateSchema,
    endsOn: dateSchema,
    visible: z.boolean(),
  })
  .strict()
  .refine((offer) => offer.endsOn >= offer.startsOn, 'Offer end date cannot precede its start');
export const offerSchema = offerInputSchema.safeExtend({ id: catalogueIdSchema });
export const coachInputSchema = z
  .object({
    name: title,
    bio: localized,
    image: imageSchema,
    sports: z.array(catalogueIdSchema).max(20),
  })
  .strict();
export const coachSchema = coachInputSchema.extend({ id: catalogueIdSchema });
export const sportSchema = z
  .object({ id: catalogueIdSchema, name: title, description: localized, available: z.boolean() })
  .strict();
export const contentBlockSchema = z
  .object({
    id: catalogueIdSchema,
    type: z.enum([
      'hero',
      'about',
      'programs',
      'plans',
      'offers',
      'schedule',
      'coaches',
      'corporate',
      'faq',
      'contact',
      'gallery',
    ]),
    title,
    body: localized,
    visible: z.boolean(),
    position: z.number().int().min(0).max(1000),
    items: z
      .array(z.object({ title, body: localized, image: imageSchema.optional() }).strict())
      .max(100),
  })
  .strict();
const blocksSchema = z
  .array(contentBlockSchema)
  .max(100)
  .refine(
    (blocks) => new Set(blocks.map((block) => block.id)).size === blocks.length,
    'Content section IDs must be unique',
  );
export const revisionSchema = z.number().int().nonnegative();
export const draftSchema = z
  .object({ blocks: blocksSchema, expectedRevision: revisionSchema })
  .strict();
export const publishSchema = z.object({ expectedRevision: revisionSchema }).strict();
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const classSchema = z
  .object({
    id: z.string().uuid(),
    date: dateSchema,
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    sportId: catalogueIdSchema,
    title,
    ageGroup: title,
    coachId: catalogueIdSchema.nullable(),
    room: z.string().max(200),
    notes: localized,
    status: z.enum(['scheduled', 'cancelled']),
  })
  .strict();

export const storedBlocksSchema = blocksSchema;
