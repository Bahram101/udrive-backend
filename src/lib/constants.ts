import type { OrderStatus } from "@/generated/prisma/client";

export const PHONE_REGEX = /^\+77[0-9]{9}$/;

export const OTP_TTL_MS = 5 * 60 * 1000;

export const OTP_MAX_ATTEMPTS = 5;

export const FINISHED_ORDER_STATUSES: OrderStatus[] = ["COMPLETED", "CANCELLED"];

// Share of order price the platform takes; 0 = not charged yet.
export const PLATFORM_COMMISSION_RATE = 0;
