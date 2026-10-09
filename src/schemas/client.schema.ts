import { z } from "zod";

export const updatePushTokenSchema = z.object({
  pushToken: z.string({ error: "pushToken is required" }),
});
