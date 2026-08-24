/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: static export ('output: export') was removed — OAuth route
  // protection requires middleware and server routes, which need a
  // Node-capable host (Vercel/Netlify free tier), not static hosting.
}

module.exports = nextConfig