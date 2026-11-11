import { NextRequest } from "next/server";
import { withAdmin } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";
import { updatePriceZoneSchema } from "@/schemas/priceZone.schema";
import { PriceZoneService } from "@/services/priceZone.service";

// PATCH /api/admin/price-zones/:id
export const PATCH = withAdmin<{ id: string }>(
  async (request: NextRequest, _authUser, { params }) => {
    try {
      const { id } = await params;
      const input = updatePriceZoneSchema.parse(await request.json());
      const zone = await PriceZoneService.update(id, input);

      return Response.json({ zone });
    } catch (error) {
      return handleApiError(error);
    }
  },
);

// DELETE /api/admin/price-zones/:id
export const DELETE = withAdmin<{ id: string }>(
  async (_request: NextRequest, _authUser, { params }) => {
    try {
      const { id } = await params;
      await PriceZoneService.delete(id);

      return Response.json({ success: true });
    } catch (error) {
      return handleApiError(error);
    }
  },
);
