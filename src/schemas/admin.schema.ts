import { z } from "zod";

// "YYYY-MM-DD" that is a real calendar date.
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Некорректная дата");

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const searchQuery = z.string().trim().min(1).max(100).optional();

export const adminOrdersQuerySchema = paginationSchema.extend({
  status: z
    .enum(["NEW", "ACCEPTED", "ARRIVED", "STARTED", "COMPLETED", "CANCELLED", "ACTIVE"])
    .optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  q: searchQuery,
});

export type AdminOrdersQuery = z.infer<typeof adminOrdersQuerySchema>;

export const ADMIN_DRIVER_STATUSES = ["ONLINE", "FREE", "BUSY", "OFFLINE"] as const;
export type AdminDriverStatus = (typeof ADMIN_DRIVER_STATUSES)[number];

export const adminDriversQuerySchema = paginationSchema.extend({
  status: z.enum(ADMIN_DRIVER_STATUSES).optional(),
  q: searchQuery,
});

export type AdminDriversQuery = z.infer<typeof adminDriversQuerySchema>;

export const ADMIN_CLIENT_STATUSES = ["ACTIVE", "NO_ORDERS"] as const;
export type AdminClientStatus = (typeof ADMIN_CLIENT_STATUSES)[number];

export const adminClientsQuerySchema = paginationSchema.extend({
  status: z.enum(ADMIN_CLIENT_STATUSES).optional(),
  q: searchQuery,
});

export type AdminClientsQuery = z.infer<typeof adminClientsQuerySchema>;

export const adminPayoutsQuerySchema = paginationSchema.extend({
  from: dateString.optional(),
  to: dateString.optional(),
  q: searchQuery,
});

export type AdminPayoutsQuery = z.infer<typeof adminPayoutsQuerySchema>;
