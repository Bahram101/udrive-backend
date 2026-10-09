import { prisma } from "@/lib/prisma";

export class ClientService {
  static async updatePushToken(userId: string, pushToken: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { pushToken },
    });
    return user;
  }
}
