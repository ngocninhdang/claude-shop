import { loadEnvConfig } from '@next/env'
import { resolve } from 'node:path'

loadEnvConfig(resolve(process.cwd()), true)
