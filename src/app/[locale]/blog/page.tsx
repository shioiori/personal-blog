import { BlogList } from "@/src/components/blog/BlogList";
import { getSortedPostsData } from "@/src/service/post";
import { getTranslations } from "next-intl/server";

export default async function BlogPage() {
  const t = await getTranslations("Blog");
  const posts = (await getSortedPostsData()) || [];

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          {t("title")}
        </h1>
        <p className="text-xl text-muted-foreground">{t("description")}</p>
      </div>
      <BlogList posts={posts} />
    </div>
  );
}
