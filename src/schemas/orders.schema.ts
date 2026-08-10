import { z } from "zod";

export const createOrderSchema = z.object({
  fromAddress: z.string({ error: "fromAddress is required" }).min(1, "fromAddress is required"),
  fromLat: z.number({ error: "fromLat is required" }),
  fromLng: z.number({ error: "fromLng is required" }),
});
