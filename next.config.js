const dotenv = require('dotenv');

/** @type {import('next').NextConfig} */
const page_prefix = process.env.NEXT_PUBLIC_PAGE_PREFIX || dotenv.config().parsed?.page_prefix || ''; 

module.exports = {
  basePath: page_prefix,
  assetPrefix: page_prefix,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = {
        ...config.resolve,
        fallback: {
          // fixes proxy-agent dependencies
          net: false,
          dns: false,
          tls: false,
          assert: false,
          // fixes next-i18next dependencies
          path: false,
          fs: false,
          // fixes mapbox dependencies
          events: false,
          // fixes sentry dependencies
          process: false,
        },
      };
    }

    return config;
  },
};
