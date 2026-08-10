import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth";
import { updateDriverStatusSchema } from "@/schemas/driver.schema";
import { updateDriverStatus } from "@/services/driver.service";
import { handleApiError } from "@/lib/errors";

// PATCH /api/driver/status
export const PATCH = withAuth(async (request: NextRequest, authUser) => {
  try {
    const { isOnline, lat, lng } = updateDriverStatusSchema.parse(
      await request.json(),
    );

    const driver = await updateDriverStatus({
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
