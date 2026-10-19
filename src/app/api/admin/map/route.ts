import { withAdmin } from "@/lib/auth";
import { AdminService } from "@/services/admin.service";
import { handleApiError } from "@/lib/errors";

// GET /api/admin/map
export const GET = withAdmin(async () => {
  try {
    return Response.json(await AdminService.getMapData());
  } catch (error) {
    return handleApiError(error);
  }
});
