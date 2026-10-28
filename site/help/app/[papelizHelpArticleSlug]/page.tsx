import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PapelizHelpArticleView } from '@/components/papeliz-help-article'
import { findPapelizHelpArticle, papelizHelpArticles } from '@/lib/papeliz-help-content'

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
  return { title: papelizHelpArticle.articleTitle, description: papelizHelpArticle.articleSummary }
}

export default async function PapelizHelpArticlePage({ params }: PapelizHelpArticlePageProps) {
  const { papelizHelpArticleSlug } = await params
  const papelizHelpArticle = findPapelizHelpArticle(papelizHelpArticleSlug)
  if (!papelizHelpArticle) notFound()
  return <PapelizHelpArticleView papelizHelpArticle={papelizHelpArticle} />
}
