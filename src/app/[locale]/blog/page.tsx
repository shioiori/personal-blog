"use client";

import { BlogList } from "@/src/components/blog/blog-list";
import { Post } from "@/src/components/declaration/blog";
import { getSortedPostsData } from "@/src/service/post";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export default function BlogPage() {
  const t = useTranslations("Blog");

  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const posts = await getSortedPostsData();
    setPosts(posts);
  };

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
