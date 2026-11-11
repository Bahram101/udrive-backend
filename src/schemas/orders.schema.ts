import { z } from "zod";

export const createOrderSchema = z
  .object({
    fromAddress: z.string({ error: "fromAddress is required" }).min(1, "fromAddress is required"),
    fromLat: z.number({ error: "fromLat is required" }),
    fromLng: z.number({ error: "fromLng is required" }),
    toAddress: z.string().min(1).optional(),
    toLat: z.number().optional(),
    toLng: z.number().optional(),
  })
  .refine(
    (data) => (data.toLat === undefined) === (data.toLng === undefined),
    { message: "toLat and toLng are required together" },
  );

