import { NextRequest } from "next/server";
import { refreshSchema } from "@/schemas/auth.schema";
import { AuthService } from "@/services/auth.service";
import { handleApiError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = refreshSchema.parse(await request.json());

    return Response.json(AuthService.refreshAccessToken(refreshToken));
  } catch (error) {
    return handleApiError(error);
  }
}
