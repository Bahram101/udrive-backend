import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppError, handleApiError } from "@/lib/errors";

// /api/auth/me
export const GET = withAuth(async (request, authUser) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: authUser.userId } });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    return Response.json({
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        email: user.email,
        avatar: user.avatar,
        rating: user.rating,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
});
