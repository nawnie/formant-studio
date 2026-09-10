import { fileURLToPath } from "node:url";
console.log(
  JSON.stringify(
    {
      mcpServers: {
        formant: {
          command: process.execPath,
          args: [fileURLToPath(new URL("../server/mcp.mjs", import.meta.url))],
          env: {
            FORMANT_URL: `http://127.0.0.1:${Number(process.env.FORMANT_PORT || 4317)}`,
          },
        },
      },
    },
    null,
    2,
  ),
);
