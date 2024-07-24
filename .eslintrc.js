const config = {
  "env": {
    "browser": true,
    "es2021": true,
    "node": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    /* Should be last */
    "plugin:prettier/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "plugins": ["@typescript-eslint", "prettier"],
  "rules": {
    "@typescript-eslint/no-explicit-any": 0,
    "import/no-unresolved": 0, // using root path so they can't be resolved
    "import/default": 0,
    "@typescript-eslint/consistent-type-imports": [2, {
      fixStyle: 'inline-type-imports',
      prefer: 'type-imports'
    }]
  },

}

module.exports = config;