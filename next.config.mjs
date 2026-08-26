/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next generates AGENTS.md/CLAUDE.md by default; this repo keeps its own docs.
  agentRules: false,
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'nodemailer'],
};

export default nextConfig;
