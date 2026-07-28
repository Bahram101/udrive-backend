import { NextRequest } from "next/server";
import { refreshSchema } from "@/schemas/auth.schema";
import { refreshAccessToken } from "@/services/auth.service";
import { handleApiError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = refreshSchema.parse(await request.json());

    return Response.json(refreshAccessToken(refreshToken));
  } catch (error) {
    return handleApiError(error);
  }
}
