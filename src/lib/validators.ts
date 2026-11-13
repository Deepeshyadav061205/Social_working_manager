import { z } from "zod";
import { CALENDAR_STATUSES, PLATFORMS, TONES } from "@/lib/types";

/** Shared zod schemas — used by both client forms and API routes. */

export const platformSchema = z.enum(PLATFORMS, {
  errorMap: () => ({ message: "Please choose a platform." }),
});
export const toneSchema = z.enum(TONES, {
  errorMap: () => ({ message: "Please choose a tone." }),
});

// ---------- Auth ----------
export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
    email: z.string().trim().email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be at most 72 characters."),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

// ---------- Generation (FR-7 … FR-12) ----------
export const generateSchema = z.object({
  inputText: z
    .string()
    .trim()
    .min(5, "Please enter at least 5 characters.")
    .max(5000, "Input must be 5,000 characters or fewer."),
  platform: platformSchema,
  tone: toneSchema,
  templateId: z.string().uuid().nullable().optional(),
});
export type GenerateInput = z.infer<typeof generateSchema>;

export const refineSchema = z.object({
  text: z.string().trim().min(5, "There is nothing to refine yet.").max(20000),
  platform: platformSchema,
  tone: toneSchema,
});

// ---------- Drafts ----------
export const draftCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  body: z.string().min(1, "Draft body cannot be empty.").max(50000),
  platform: platformSchema,
  tone: toneSchema,
  contentId: z.string().uuid().nullable().optional(),
});
export const draftUpdateSchema = draftCreateSchema.partial().omit({ contentId: true });

// ---------- Templates ----------
export const templateSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  structureText: z.string().trim().min(1, "Structure is required.").max(5000),
  defaultPlatform: platformSchema,
  defaultTone: toneSchema,
});
export const templateUpdateSchema = templateSchema.partial();

// ---------- Calendar ----------
export const calendarEntrySchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  platform: platformSchema,
  scheduledFor: z.string().datetime({ offset: true, message: "Pick a valid date and time." }),
  draftId: z.string().uuid().nullable().optional(),
  status: z.enum(CALENDAR_STATUSES).optional(),
});
export const calendarEntryUpdateSchema = calendarEntrySchema.partial();

// ---------- Publish ----------
export const publishSchema = z
  .object({
    body: z.string().trim().min(1, "Nothing to publish.").max(50000),
    platform: platformSchema,
    contentId: z.string().uuid().nullable().optional(),
    draftId: z.string().uuid().nullable().optional(),
    /** Force the transfer path even if a connection exists. */
    forceTransfer: z.boolean().optional(),
  });

// ---------- Settings ----------
export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  defaultPlatform: platformSchema,
  defaultTone: toneSchema,
  blogCmsUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\/\S+$/i.test(v), "CMS URL must start with https://")
    .optional(),
});

export const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters.").max(72),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
