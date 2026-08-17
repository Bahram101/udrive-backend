import { Server } from "socket.io";

const globalForIO = globalThis as unknown as { io?: Server };

export function setIO(io: Server): void {
  globalForIO.io = io;
}

export function getIO(): Server {
  if (!globalForIO.io) {
    throw new Error("Socket.IO server has not been initialized");
  }
  return globalForIO.io;
}
