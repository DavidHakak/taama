import { loadEnvConfig } from '@next/env'
import postgres from 'postgres'

loadEnvConfig(process.cwd())

async function run() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set in .env.local')
    process.exit(1)
  }

  const sql = postgres(url)
  try {
    console.log('Updating all shop product images...')
    const targetImage = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQGirJPyNAqNzGsT40EId470mj67XOEqBDzBziov1N4xVDRflq9LRpfH4M&s=10'
    const result = await sql`
      UPDATE public.shop_products
      SET image_url = ${targetImage};
    `
    console.log('Successfully updated product images! Result:', result)
  } catch (err) {
    console.error('Error updating product images:', err)
  } finally {
    await sql.end()
  }
}

run()
