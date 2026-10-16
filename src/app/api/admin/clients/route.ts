import { withAdmin } from "@/lib/auth";
import { AdminService } from "@/services/admin.service";
import { adminClientsQuerySchema } from "@/schemas/admin.schema";
import { handleApiError } from "@/lib/errors";

// GET /api/admin/clients
export const GET = withAdmin(async (request) => {
  try {
    const query = adminClientsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    return Response.json(await AdminService.getClients(query));
  } catch (error) {
    return handleApiError(error);
  }
});
