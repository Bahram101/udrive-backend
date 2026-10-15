import { withAdmin } from "@/lib/auth";
import { AdminService } from "@/services/admin.service";
import { adminOrdersQuerySchema } from "@/schemas/admin.schema";
import { handleApiError } from "@/lib/errors";

// GET /api/admin/orders
export const GET = withAdmin(async (request) => {
  try {
    const query = adminOrdersQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    return Response.json(await AdminService.getOrders(query));
  } catch (error) {
    return handleApiError(error);
  }
});
