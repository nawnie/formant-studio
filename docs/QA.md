# FORMANT quality notes

The release checklist is intentionally reproducible from the project root:

```sh
npm run build
npm test
npm run test:mcp
node scripts/verify-mcp.mjs --export
```

The browser workflow receipt lives in `docs/reviews/ui-verification.json`. It covers editing, undo, transport, audio rendering, WAV download, project round trips, and visible MCP control. The screenshots in that folder are independent Chromium captures at desktop, laptop, and mobile widths.
