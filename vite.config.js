import { defineConfig } from 'vite';

// Relative base so the build works on a GitHub Pages project URL and on a custom domain.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});
