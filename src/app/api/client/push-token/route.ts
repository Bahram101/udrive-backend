import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth";
import { updatePushTokenSchema } from "@/schemas/client.schema";
import { ClientService } from "@/services/client.service";
import { handleApiError } from "@/lib/errors";

// PATCH /api/client/push-token
export const PATCH = withAuth(async (request: NextRequest, authUser) => {
  try {
    const { pushToken } = updatePushTokenSchema.parse(await request.json());

    const client = await ClientService.updatePushToken(
      authUser.userId,
      pushToken,
    );

    return Response.json({ client });
  } catch (error) {
    return handleApiError(error);
  }
});
