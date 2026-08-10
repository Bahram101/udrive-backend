import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET!;
const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "30d";

export interface JwtPayload {
  userId: string;
  phone: string;
  role: string;
}

interface AccessTokenPayload extends JwtPayload {
  type: "access";
}

interface RefreshTokenPayload extends JwtPayload {
  type: "refresh";
}

export function signAccessToken(payload: JwtPayload): string {
  const accessPayload: AccessTokenPayload = { ...payload, type: "access" };
  return jwt.sign(accessPayload, SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, SECRET) as AccessTokenPayload;
  if (decoded.type !== "access") {
    throw new Error("Provided token is not an access token");
  }
  return decoded;
}

export function signRefreshToken(payload: JwtPayload): string {
  const refreshPayload: RefreshTokenPayload = { ...payload, type: "refresh" };
  return jwt.sign(refreshPayload, SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, SECRET) as RefreshTokenPayload;
  if (decoded.type !== "refresh") {
    throw new Error("Provided token is not a refresh token");
  }
  return decoded;
}
