import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth";
import { AuthService } from "@/services/auth.service";
import { handleApiError } from "@/lib/errors";

// PATCH /api/auth/switch-role
export const PATCH = withAuth(async (_request: NextRequest, authUser) => {
  try {
    const result = await AuthService.switchRole(authUser.userId);
    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
});
