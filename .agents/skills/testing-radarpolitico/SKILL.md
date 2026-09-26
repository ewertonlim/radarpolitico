---
name: radarpolitico-browser-testing
description: Run the Radar Político SPA locally and distinguish upstream Câmara API access failures from UI regressions.
---

# Runtime setup

- Run `npm start` from the repository; the static server listens at http://localhost:3000.
- No application login, backend service, or runtime dependency installation is required.
- Use an installed Node version; this environment provides `/home/ubuntu/.nvm/versions/node/v24.19.0/bin`.
- Open a deputy card to reach the modal. Gastos is the default tab; the Notas/Fornecedores control is below the category chart. Votações and Atuação load on first selection.

# API access preflight

- Confirm both the deputy list and a deputy detail request work before recording the full feature flow. A successful list alone does not establish modal access.
- The browser calls `https://dadosabertos.camara.leg.br/api/v2` directly. Individual endpoints may return responses without CORS headers even when list endpoints work.
- If a modal shows “Erro ao carregar perfil do deputado / Failed to fetch”, inspect the browser console for CORS and network errors. The application retries automatically.
- Treat externally blocked endpoints as incomplete runtime coverage. Do not replace real responses with fixtures or disable browser security and then claim normal end-to-end behavior.

## Devin Secrets Needed

None for public read-only UI testing.
