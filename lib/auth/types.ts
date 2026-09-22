export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

export type Session =
  | { authenticated: true; user: AuthUser; expiresAt: number }
  | { authenticated: false };

export interface LoginResponse extends AuthUser {
  token: string;
}
