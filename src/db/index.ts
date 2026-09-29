import { createPool } from 'mysql2'
import { drizzle } from 'drizzle-orm/mysql2'

import * as schema from './schema.ts'

const pool = createPool({
  uri: process.env.DATABASE_URL!,
  supportBigNumbers: true,
})

// Force UTC per connection so MySQL doesn't apply a second timezone shift on
// top of Drizzle's own UTC handling for timestamp columns.
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'")
})

export const db = drizzle({ client: pool, schema, mode: 'default' })
