import { z } from "zod";

// "YYYY-MM-DD" that is a real calendar date.
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Некорректная дата");

export const adminOrdersQuerySchema = z.object({
  status: z
    .enum(["NEW", "ACCEPTED", "ARRIVED", "STARTED", "COMPLETED", "CANCELLED", "ACTIVE"])
    .optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminOrdersQuery = z.infer<typeof adminOrdersQuerySchema>;
