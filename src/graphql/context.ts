import { getSession, type AuthPayload } from '@/lib/auth'
import { db, sqlite, schema } from '@/lib/db'

export interface GraphQLContext {
  session: AuthPayload | null
  db: typeof db
  sqlite: typeof sqlite
  schema: typeof schema
}

export async function createContext(): Promise<GraphQLContext> {
  const session = await getSession()

  return {
    session,
    db,
    sqlite,
    schema,
  }
}
