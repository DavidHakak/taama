import { redirect } from 'next/navigation'

export default async function BrandRootPage({
  params,
}: {
  params: Promise<{ brand: string }>
}) {
  const { brand } = await params
  redirect(`/shop-admin/${brand}/products`)
}
