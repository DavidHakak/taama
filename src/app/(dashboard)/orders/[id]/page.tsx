import OrderBuilder from '@/components/OrderBuilder'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditOrderPage({ params }: PageProps) {
  const { id } = await params
  return <OrderBuilder orderId={id} />
}
