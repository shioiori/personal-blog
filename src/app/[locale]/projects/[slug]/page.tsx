import { notFound } from "next/navigation";
import { ProjectDetail } from "@/src/components/project/ProjectDetail";

export default async function ProjectDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!slug) {
    notFound();
  }

  return <ProjectDetail slug={slug} />;
}
