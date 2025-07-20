"use client";

import { Calendar, Clock, ArrowLeft, Share2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import Link from "next/link";
import { Post } from "../declaration/blog";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { getPostData } from "@/src/service/post";
import DisqusComments from "./comment";

export function BlogPost({ slug }: { slug: string }) {
  const b = useTranslations("Common");
  const [post, setPost] = useState<Post>();
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const post = (await getPostData(slug)) as Post;
    if (!post) {
      notFound();
    }
    setPost(post);
  }
  return (
    post && (
      <article className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/blog">
            <Button variant="ghost" className="pl-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {b("back")}
            </Button>
          </Link>
        </div>

        <header className="space-y-6 mb-12">
          <div className="flex flex-wrap gap-2">
            {post.tags?.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>

          <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
            {post.title}
          </h1>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6 text-muted-foreground">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                {post.date}
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                {post.readTime}
              </div>
            </div>

            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              {b("share")}
            </Button>
          </div>
        </header>

        <div className="prose prose-lg max-w-none dark:prose-invert mb-12">
          <div
            dangerouslySetInnerHTML={{
              __html: post.content.replace(/\n/g, "<br>")
            }}
          />
        </div>

        <DisqusComments
          pageId={post.slug}
          pageTitle={post.title}
          pageUrl={`${process.env.NEXT_PUBLIC_BASE_URL}${post.slug}`}
        />
      </article>
    )
  );
}
