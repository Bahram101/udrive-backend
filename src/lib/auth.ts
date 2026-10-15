import { NextRequest } from "next/server";
import { JwtPayload, verifyAccessToken } from "./jwt";
import { prisma } from "./prisma";

type RouteContext<T> = { params: Promise<T> };

type AuthedHandler<T = unknown> = (
  request: NextRequest,
  user: JwtPayload,
  context: RouteContext<T>,
) => Promise<Response>;

export function withAuth<T = unknown>(handler: AuthedHandler<T>) {
  return async (
    request: NextRequest,
    context: RouteContext<T>,
  ): Promise<Response> => {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return Response.json(
        { error: "Access token is required" },
        { status: 401 },
      );
    }
    const token = authHeader.slice(7);
    let user: JwtPayload;
    try {
      user = verifyAccessToken(token);
    } catch {
      return Response.json(
        { error: "Invalid or expired access token" },
        { status: 401 },
      );
    }

    return handler(request, user, context);
  };
}

// Role is checked in the DB, not trusted from the token.
export function withAdmin<T = unknown>(handler: AuthedHandler<T>) {
  return withAuth<T>(async (request, user, context) => {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { role: true },
    });

    if (dbUser?.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    return handler(request, user, context);
  });
}
