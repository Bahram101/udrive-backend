import { NextRequest } from "next/server";
import { withAdmin } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";
import { createPriceZoneSchema } from "@/schemas/priceZone.schema";
import { PriceZoneService } from "@/services/priceZone.service";

// GET /api/admin/price-zones
export const GET = withAdmin(async () => {
  try {
    const zones = await PriceZoneService.list();
    return Response.json({ zones });
  } catch (error) {
    return handleApiError(error);
  }
});

// POST /api/admin/price-zones
export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const input = createPriceZoneSchema.parse(await request.json());
    const zone = await PriceZoneService.create(input);
    return Response.json({ zone }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
});
