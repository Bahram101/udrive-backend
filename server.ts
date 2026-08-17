import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const { verifyAccessToken } = await import("./src/lib/jwt");
  const { prisma } = await import("./src/lib/prisma");
  const { setIO } = await import("./src/lib/socket");

  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url!, true));
  });

  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      next(new Error("Unauthorized"));
      return;
    }

    try {
      socket.data.user = verifyAccessToken(token);
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user as { userId: string; role: string };

    if (user.role === "DRIVER") {
      socket.join("drivers");

      const driver = await prisma.driver.findUnique({ where: { userId: user.userId } });
      if (driver) {
        socket.join(`driver:${driver.id}`);
      }
    }
  });

  setIO(io);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
