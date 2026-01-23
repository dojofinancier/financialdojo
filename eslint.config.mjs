import nextConfig from "eslint-config-next/core-web-vitals";

const baseConfig = Array.isArray(nextConfig) ? nextConfig : [nextConfig];

const config = [
  ...baseConfig,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/static-components": "off",
      "react-hooks/immutability": "off",
      "react/no-unescaped-entities": "off",
    },
  },
];

export default config;
