import { z } from "zod";
import { PHONE_REGEX } from "@/lib/constants";

const phoneSchema = z
  .string({ error: "phone is required" })
  .regex(PHONE_REGEX, "Invalid phone number. Must be in format +7XXXXXXXXXX");

export const sendOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string({ error: "code is required" }).min(1, "code is required"),
  name: z.string().min(1).optional(),
  role: z.enum(["CLIENT", "DRIVER"]).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string({ error: "Refresh token is required" }).min(1, "Refresh token is required"),
});
