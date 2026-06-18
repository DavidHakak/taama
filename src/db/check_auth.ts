import fs from 'fs'
import path from 'path'
import postgres from 'postgres'

const envPath = path.join(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const env: Record<string, string> = {}
envContent.split('\n').forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (match) {
    let value = match[2] ? match[2].trim() : ''
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1)
    }
    env[match[1]] = value
  }
})

const url = env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set in .env.local')
  process.exit(1)
}

async function run() {
  const sql = postgres(url)
  try {
    const users = await sql`SELECT id, email, encrypted_password FROM auth.users;`
    console.log('Auth Users currently in DB:')
    console.log(JSON.stringify(users, null, 2))
  } catch (err) {
    console.error('Error:', err)
  } finally {
    await sql.end()
  }
}

run()
