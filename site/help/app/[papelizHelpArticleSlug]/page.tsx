import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PapelizHelpArticleView } from '@/components/papeliz-help-article'
import { findPapelizHelpArticle, papelizHelpArticles } from '@/lib/papeliz-help-content'
import { createPapelizHelpArticleJsonLd, createPapelizHelpPageMetadata, papelizHelpHomePath, serializePapelizHelpJsonLd } from '@/lib/papeliz-help-seo'

type PapelizHelpArticlePageProps = {
  params: Promise<{ papelizHelpArticleSlug: string }>
}

// Every guide is exported at build time; any other path is the 404 page.
export const dynamicParams = false

export function generateStaticParams() {
  return papelizHelpArticles.map((papelizHelpArticle) => ({ papelizHelpArticleSlug: papelizHelpArticle.papelizHelpArticleSlug }))
}

export async function generateMetadata({ params }: PapelizHelpArticlePageProps): Promise<Metadata> {
  const { papelizHelpArticleSlug } = await params
  const papelizHelpArticle = findPapelizHelpArticle(papelizHelpArticleSlug)
  if (!papelizHelpArticle) return {}
  return {
    title: papelizHelpArticle.articleTitle,
    ...createPapelizHelpPageMetadata(papelizHelpArticle.articleTitle, papelizHelpArticle.articleSummary, `${papelizHelpHomePath}${papelizHelpArticleSlug}/`),
  }
}

export default async function PapelizHelpArticlePage({ params }: PapelizHelpArticlePageProps) {
  const { papelizHelpArticleSlug } = await params
  const papelizHelpArticle = findPapelizHelpArticle(papelizHelpArticleSlug)
  if (!papelizHelpArticle) notFound()
  const papelizHelpArticleJsonLd = createPapelizHelpArticleJsonLd(
    papelizHelpArticle.articleTitle,
    papelizHelpArticle.articleSummary,
    `${papelizHelpHomePath}${papelizHelpArticleSlug}/`,
  )
  return (
    <>
      <PapelizHelpArticleView papelizHelpArticle={papelizHelpArticle} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializePapelizHelpJsonLd({ '@context': 'https://schema.org', ...papelizHelpArticleJsonLd }) }}
      />
    </>
  )
}
