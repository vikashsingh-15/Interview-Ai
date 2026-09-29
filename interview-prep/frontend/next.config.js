const fs=require('node:fs');
const path=require('node:path');
const envFile=path.resolve(__dirname,'../.env');
if(fs.existsSync(envFile))process.loadEnvFile(envFile);
const backend=(process.env.BACKEND_API_URL || 'http://localhost:3001').replace(/\/$/,'');
const target=new URL(backend);
if(!['http:','https:'].includes(target.protocol) || target.username || target.password || target.pathname!=='/')
  throw new Error('BACKEND_API_URL must be a plain backend origin without credentials or a path');
if(process.env.VERCEL && target.protocol!=='https:')
  throw new Error('Set BACKEND_API_URL to your HTTPS Render origin in Vercel');
/** @type {import('next').NextConfig} */
module.exports={
  reactStrictMode:true,
  images:{remotePatterns:[{protocol:'https',hostname:'images.unsplash.com'}]},
  async rewrites(){return [{source:'/api/:path*',destination:backend+'/api/:path*'}];},
};
