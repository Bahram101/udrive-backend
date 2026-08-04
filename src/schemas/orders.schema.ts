import { z } from "zod";

export const createOrderSchema = z.object({
  fromAddress: z.string({ error: "fromAddress is required" }).min(1, "fromAddress is required"),
  toAddress: z.string({ error: "toAddress is required" }).min(1, "toAddress is required"),
});
