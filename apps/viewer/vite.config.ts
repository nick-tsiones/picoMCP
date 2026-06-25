import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { analyticsReport, graphSnapshot } from "@qdcli/core";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "qd-graph-api",
      configureServer(server) {
        server.middlewares.use("/api/graph", async (_req, res) => {
          try {
            const root = process.env.QD_ROOT ?? process.cwd();
            const snapshot = await graphSnapshot(root);
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(snapshot));
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
          }
        });
        server.middlewares.use("/api/analytics", async (_req, res) => {
          try {
            const root = process.env.QD_ROOT ?? process.cwd();
            const report = await analyticsReport(root);
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(report));
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
          }
        });
      },
    },
  ],
});
