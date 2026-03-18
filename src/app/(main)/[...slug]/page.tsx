import { UnderConstruction } from '@/components/common/UnderConstruction'

type MainFallbackPageProps = {
  params: Promise<{
    slug: string[]
  }>
}

export default async function MainFallbackPage({ params }: MainFallbackPageProps) {
  const { slug } = await params
  const requestedPath = `/${slug.join('/')}`

  return <UnderConstruction requestedPath={requestedPath} />
}
