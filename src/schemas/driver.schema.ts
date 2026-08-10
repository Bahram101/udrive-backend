import { z } from "zod";

export const updateDriverStatusSchema = z.object({
  isOnline: z.boolean({ error: "isOnline is required" }),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
