import { NextResponse } from 'next/server';

/**
 * Health check endpoint for the web application
 * Used for monitoring and load balancer health checks
 */
export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'sportzen-web',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  };

  return NextResponse.json(health, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

/**
 * HEAD request for simple health check
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
