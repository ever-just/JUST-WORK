# JUST-WORK.app

**Comprehensive business directory and opportunity tracking platform for mid-market Minnesota companies ($100K - $100M ARR)**

This React + TypeScript + Vite application provides a powerful search and discovery platform for legitimate mid-market businesses in Minnesota. Built with clean, normalized company data and advanced search capabilities.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

## Dataset location

Place the raw CSV export in the `public/` directory. The file name expected by the application and conversion script is:

```
public/ForMinnesotacompanies.org $10M + 10+ ppl + MN Only.csv
```

## Converting CSV to JSON

Run the following command to convert the CSV file into a JSON dataset:

```bash
pnpm run convert
```

The script writes `public/companies.json` and performs a simple deduplication based on `Company Name`. The source CSV currently contains **2765** lines. After deduplication the resulting JSON contains **2762** records.

## Development

Install dependencies and start the development server:

```bash
pnpm install
pnpm run dev
```

## Building

To create a production build run:

```bash
pnpm run build
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```
