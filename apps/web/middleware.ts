import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token as any;
    // リフレッシュトークンが失効した場合はログインページへリダイレクト
    if (token?.error === 'RefreshAccessTokenError') {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('error', 'SessionExpired');
      return NextResponse.redirect(loginUrl);
    }
    const role = token?.role;
    const pathname = req.nextUrl.pathname;
    const clientAllowed = [
      '/portal',
      '/evaluation-models',
      '/api-keys',
      '/answers',
      '/results',
      '/respond',
    ];
    if (role && role !== 'SUPER_ADMIN' && !clientAllowed.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
      return NextResponse.redirect(new URL('/portal', req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/projects/:path*',
    '/evaluation-models/:path*',
    '/results/:path*',
    '/answers/:path*',
    '/users/:path*',
    '/tenants/:path*',
    '/sessions/:path*',
  ],
};
