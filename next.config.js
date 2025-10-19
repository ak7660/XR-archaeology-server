const dotenv = require('dotenv');

/** @type {import('next').NextConfig} */
const page_prefix = process.env.NEXT_PUBLIC_PAGE_PREFIX || dotenv.config().parsed?.page_prefix || ''; 

// Only set basePath if it's not empty
const config = {
  // Ensure public directory assets are served correctly with basePath
  publicRuntimeConfig: {
    basePath: page_prefix,
  },
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

// Only add basePath and assetPrefix if prefix is not empty
if (page_prefix && page_prefix.length > 0) {
  config.basePath = page_prefix;
  config.assetPrefix = page_prefix;
}

module.exports = config;
