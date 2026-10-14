module.exports = {
  apps: [
    {
      name: "acessanet-lab",
      cwd: __dirname,
      script: "node_modules/vite/bin/vite.js",
      args: "preview --host 0.0.0.0 --port 4198 --strictPort",
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
