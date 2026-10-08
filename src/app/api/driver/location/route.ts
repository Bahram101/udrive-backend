import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth";
import { updateDriverLocationSchema } from "@/schemas/driver.schema";
import { DriverService } from "@/services/driver.service";
import { handleApiError } from "@/lib/errors";

// PATCH /api/driver/location
export const PATCH = withAuth(async (request: NextRequest, authUser) => {
  try {
    if (authUser.role !== "DRIVER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { lat, lng } = updateDriverLocationSchema.parse(await request.json());

    const driver = await DriverService.updateDriverLocation(
      authUser.userId,
      lat,
      lng,
    );

    return Response.json({ driver });
  } catch (error) {
    return handleApiError(error);
  }
});
