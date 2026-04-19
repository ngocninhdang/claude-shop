// Wrapper: load .env.production via @next/env before booting the Next.js
// standalone server. Guarantees \$ escape sequences are handled correctly.
const path = require('node:path')
const { loadEnvConfig } = require('@next/env')

loadEnvConfig(process.cwd(), false)

require(path.join(process.cwd(), 'server.js'))
