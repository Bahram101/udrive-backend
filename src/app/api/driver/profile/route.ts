import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth";
import { updateDriverProfileSchema } from "@/schemas/driver.schema";
import { DriverService } from "@/services/driver.service";
import { handleApiError } from "@/lib/errors";

// GET /api/driver/profile
export const GET = withAuth(async (_request: NextRequest, authUser) => {
  try {
    const profile = await DriverService.getDriverProfile(authUser.userId);
    return Response.json(profile);
  } catch (error) {
    return handleApiError(error);
  }
});

// PATCH /api/driver/profile
export const PATCH = withAuth(async (request: NextRequest, authUser) => {
  try {
    const { carBrand, carModel, carColor, email } =
      updateDriverProfileSchema.parse(await request.json());

    const profile = await DriverService.updateDriverProfile({
      userId: authUser.userId,
      carBrand,
      carModel,
      carColor,
      email,
    });

    return Response.json(profile);
  } catch (error) {
    return handleApiError(error);
  }
});
