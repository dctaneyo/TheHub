import { createYoga } from 'graphql-yoga'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { readFileSync } from 'fs'
import { join } from 'path'
import { resolvers } from '@/graphql/resolvers'
import { createContext } from '@/graphql/context'

// Read the schema file
const typeDefs = readFileSync(
  join(process.cwd(), 'src/graphql/schema.graphql'),
  'utf-8'
)

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
})

const yoga = createYoga({
  schema,
  context: createContext,
  graphqlEndpoint: '/api/graphql',
  fetchAPI: { Response },
})

export { yoga as GET, yoga as POST }
