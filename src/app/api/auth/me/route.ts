import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// /api/auth/me
export const GET = withAuth(async (request, authUser) => {
  const user = await prisma.user.findUnique({ where: { id: authUser.userId } });

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
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
});
