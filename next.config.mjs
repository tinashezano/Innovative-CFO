/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'nodemailer'],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
