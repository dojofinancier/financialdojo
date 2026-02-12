import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  // Suppress webpack warnings from Next.js internals
  webpack: (config, { dev }) => {
    if (dev) {
      config.ignoreWarnings = [
        { module: /node_modules\/next\// },
        { file: /node_modules\/next\// },
      ];
    }
    return config;
  },
  // Add empty turbopack config to allow webpack config to work
  turbopack: {},

  // Security headers - only apply CSP in production to avoid blocking Stripe in dev
  async headers() {
    // Skip CSP in development to allow all connections
    if (process.env.NODE_ENV !== "production") {
      return [];
    }
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Fonts
              "font-src 'self' data: https: blob:",
              // Google Analytics + Google Ads + Tag Manager + Stripe + Vimeo
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://googleads.g.doubleclick.net https://www.googleadservices.com https://js.stripe.com https://m.stripe.network https://*.stripe.com https://player.vimeo.com",
              // Frames: Stripe + Google Tag Manager + Vimeo
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.stripe.com https://www.googletagmanager.com https://td.doubleclick.net https://player.vimeo.com",
              // Connections: GA + Google Ads + Stripe + Supabase
              "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.google.com https://googleads.g.doubleclick.net https://stats.g.doubleclick.net https://*.stripe.com https://*.stripe.network https://*.supabase.co wss://*.supabase.co",
              // Images: GA tracking pixels + Google Ads + Stripe
              "img-src 'self' data: blob: https://*.stripe.com https://www.google-analytics.com https://www.google.com https://googleads.g.doubleclick.net https://www.googleadservices.com https://www.google.ca https://www.google.fr https://imagedelivery.net",
              "style-src 'self' 'unsafe-inline'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // Performance optimizations
  // Enable cacheComponents for better performance (moved from experimental)
  cacheComponents: true,


  // Enable experimental features for better performance
  experimental: {
    // Optimize package imports - tree-shake unused exports
    optimizePackageImports: [
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      'lucide-react',
      'recharts',
    ],
  },

  // Compiler optimizations
  compiler: {
    // Remove console.log in production to reduce bundle size
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // Keep error and warn logs
    } : false,
  },

  // Image optimization
  images: {
    // Enable image optimization
    formats: ['image/avif', 'image/webp'],
    // Add your image domains if using external images
    // remotePatterns: [],
  },

  // Enable compression
  compress: true,

  // PoweredBy header removal (security + performance)
  poweredByHeader: false,

  // Set output file tracing root to fix lockfile detection warning
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;

