import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth";
import { updateDriverStatusSchema } from "@/schemas/driver.schema";
import { DriverService } from "@/services/driver.service";
import { handleApiError } from "@/lib/errors";

// GET /api/driver/status
export const GET = withAuth(async (_request: NextRequest, authUser) => {
  try {
    const driver = await DriverService.getDriverStatus(authUser.userId);
    return Response.json({ driver });
  } catch (error) {
    return handleApiError(error);
  }
});

// PATCH /api/driver/status
export const PATCH = withAuth(async (request: NextRequest, authUser) => {
  try {
    const { isOnline, lat, lng } = updateDriverStatusSchema.parse(
      await request.json(),
    );

    const driver = await DriverService.updateDriverStatus({
      userId: authUser.userId,
      isOnline,
      lat,
      lng,
    });

    return Response.json({ driver });
  } catch (error) {
    return handleApiError(error);
  }
});
