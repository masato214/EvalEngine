import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// アクセストークンの有効期限（秒）。APIの JWT_EXPIRY と合わせる。
const ACCESS_TOKEN_EXPIRY_SEC = parseInt(process.env.JWT_EXPIRY_SEC ?? '840', 10); // default 14 min

async function refreshAccessToken(token: Record<string, unknown>) {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
    });
    if (!res.ok) {
      throw new Error(`Refresh failed: ${res.status}`);
    }
    const json = await res.json();
    const accessToken = json.data?.accessToken ?? json.accessToken;
    return {
      ...token,
      accessToken,
      accessTokenExpiresAt: Date.now() + ACCESS_TOKEN_EXPIRY_SEC * 1000,
      error: undefined,
    };
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' as const };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        tenantId: { label: 'Tenant ID', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials) return null;
        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
              tenantId: credentials.tenantId,
            }),
          });
          if (!res.ok) return null;
          const json = await res.json();
          const { data } = json;
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.email,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            tenantId: data.user.tenantId,
            role: data.user.role,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // 初回ログイン時
      if (user) {
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        token.tenantId = (user as any).tenantId;
        token.role = (user as any).role;
        token.accessTokenExpiresAt = Date.now() + ACCESS_TOKEN_EXPIRY_SEC * 1000;
        return token;
      }

      // アクセストークンがまだ有効な場合はそのまま返す（1分の余裕を持つ）
      if (Date.now() < (token.accessTokenExpiresAt as number) - 60_000) {
        return token;
      }

      // 期限切れ（または間近）→ リフレッシュ
      return refreshAccessToken(token as Record<string, unknown>);
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      (session as any).tenantId = token.tenantId;
      (session as any).role = token.role;
      (session as any).error = token.error;
      return session;
    },
  },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
};
