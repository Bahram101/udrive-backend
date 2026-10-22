import { z } from "zod";

export const updateDriverStatusSchema = z.object({
  isOnline: z.boolean({ error: "isOnline is required" }),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const updatePushTokenSchema = z.object({
  pushToken: z.string({ error: "pushToken is required" }),
});

export const updateDriverLocationSchema = z.object({
  lat: z.number({ error: "lat is required" }),
  lng: z.number({ error: "lng is required" }),
});

export const updateDriverProfileSchema = z.object({
  carBrand: z.string().trim().min(1).optional(),
  carModel: z.string().trim().min(1).optional(),
  carColor: z.string().trim().min(1).optional(),
  email: z
    .string()
    .trim()
    .email({ error: "Некорректный email" })
    .optional()
    .or(z.literal("")),
});
