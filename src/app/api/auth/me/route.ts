import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppError, handleApiError } from "@/lib/errors";

import { serializeAuthUser } from "@/services/auth.service";

// /api/auth/me
export const GET = withAuth(async (request, authUser) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      include: { driver: true },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    return Response.json({
      user: serializeAuthUser(user),
    });
  } catch (error) {
    return handleApiError(error);
  }
});
