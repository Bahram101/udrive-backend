import { z } from "zod";

const priceZoneFields = {
  name: z.string().trim().min(1),
  points: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      }),
    )
    .min(3),
  priceModifier: z.number().int().min(0),
};

export const createPriceZoneSchema = z.object({
  ...priceZoneFields,
  isActive: z.boolean().optional().default(true),
});

export const updatePriceZoneSchema = z.object({
  name: priceZoneFields.name.optional(),
  points: priceZoneFields.points.optional(),
  priceModifier: priceZoneFields.priceModifier.optional(),
  isActive: z.boolean().optional(),
});

export type CreatePriceZoneInput = z.infer<typeof createPriceZoneSchema>;
export type UpdatePriceZoneInput = z.infer<typeof updatePriceZoneSchema>;
