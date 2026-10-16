import { withAdmin } from "@/lib/auth";
import { AdminService } from "@/services/admin.service";
import { adminDriversQuerySchema } from "@/schemas/admin.schema";
import { handleApiError } from "@/lib/errors";

// GET /api/admin/drivers
export const GET = withAdmin(async (request) => {
  try {
    const query = adminDriversQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    return Response.json(await AdminService.getDrivers(query));
  } catch (error) {
    return handleApiError(error);
  }
});
