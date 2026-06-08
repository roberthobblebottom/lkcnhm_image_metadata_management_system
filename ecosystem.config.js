module.exports = {
  apps: [{
    name: "image-metadata-management-system",
    script: "./server.ts",
    interpreter: "ts-node",
    interpreter_args: "-P ./tsconfig.json",
    env: {
      NODE_ENV: "development",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      TS_NODE_TRANSPILE_ONLY: 'true',
      HOST: '0.0.0.0',
      PORT: 3001
    }
  }]
}

