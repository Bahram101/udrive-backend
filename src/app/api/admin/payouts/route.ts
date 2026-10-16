import { withAdmin } from "@/lib/auth";
import { AdminService } from "@/services/admin.service";
import { adminPayoutsQuerySchema } from "@/schemas/admin.schema";
import { handleApiError } from "@/lib/errors";

// GET /api/admin/payouts
export const GET = withAdmin(async (request) => {
  try {
    const query = adminPayoutsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    return Response.json(await AdminService.getPayouts(query));
  } catch (error) {
    return handleApiError(error);
  }
});
