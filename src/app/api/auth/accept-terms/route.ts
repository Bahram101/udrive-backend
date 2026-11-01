import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";

import { serializeAuthUser } from "@/services/auth.service";

// /api/auth/accept-terms
export const POST = withAuth(async (request, authUser) => {
  try {
    const user = await prisma.user.update({
      where: { id: authUser.userId },
      data: { termsAcceptedAt: new Date() },
      include: { driver: true },
    });

    return Response.json({
      user: serializeAuthUser(user),
    });
  } catch (error) {
    return handleApiError(error);
  }
});
