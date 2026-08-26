import next from "eslint-config-next";

/**
 * ESLint flat config. eslint-config-next ships a ready-made flat config array,
 * so it is spread in directly -- no FlatCompat shim needed.
 */
const eslintConfig = [
  ...next,
  {
    ignores: [".next/**", "node_modules/**", "drizzle/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
