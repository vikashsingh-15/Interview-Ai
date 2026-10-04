const fs=require('node:fs');
const path=require('node:path');
const envFile=path.resolve(__dirname,'../.env');
// Only load frontend configuration; provider/database/OAuth secrets stay backend-only.
if(!process.env.BACKEND_API_URL && fs.existsSync(envFile)) {
  const entry=fs.readFileSync(envFile,'utf8').match(/^\s*BACKEND_API_URL\s*=\s*(.*?)\s*$/m);
  if(entry)process.env.BACKEND_API_URL=entry[1].replace(/^(['"])(.*)\1$/, '$2');
}
const backend=(process.env.BACKEND_API_URL || 'http://localhost:3001').replace(/\/$/,'');
const target=new URL(backend);
if(!['http:','https:'].includes(target.protocol) || target.username || target.password || target.pathname!=='/' || target.search || target.hash)
  throw new Error('BACKEND_API_URL must be a plain backend origin without credentials or a path');
if(process.env.VERCEL && target.protocol!=='https:')
  throw new Error('Set BACKEND_API_URL to your HTTPS Render origin in Vercel');
/** @type {import('next').NextConfig} */
module.exports={
  // Development and production builds must not concurrently overwrite manifests.
  distDir:process.env.NODE_ENV==='production' ? '.next-production' : '.next',
  outputFileTracingRoot:__dirname,
  reactStrictMode:true,
  images:{remotePatterns:[{protocol:'https',hostname:'images.unsplash.com'}]},
  async rewrites(){return [{source:'/api/:path*',destination:backend+'/api/:path*'}];},
};
