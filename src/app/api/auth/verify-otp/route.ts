import { NextRequest } from "next/server";
import { verifyOtpSchema } from "@/schemas/auth.schema";
import { AuthService } from "@/services/auth.service";
import { handleApiError } from "@/lib/errors";

// /api/auth/verify-otp
export async function POST(request: NextRequest) {
  try {
    const body = verifyOtpSchema.parse(await request.json());

    const result = await AuthService.verifyOtp(body);

    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
