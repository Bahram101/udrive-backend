import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth";
import { updatePushTokenSchema } from "@/schemas/driver.schema";
import { DriverService } from "@/services/driver.service";
import { handleApiError } from "@/lib/errors";

// PATCH /api/driver/push-token
export const PATCH = withAuth(async (request: NextRequest, authUser) => {
  try {
    const { pushToken } = updatePushTokenSchema.parse(await request.json());

    const driver = await DriverService.updatePushToken(
      authUser.userId,
      pushToken,
    );

    return Response.json({ driver });
  } catch (error) {
    return handleApiError(error);
  }
});
