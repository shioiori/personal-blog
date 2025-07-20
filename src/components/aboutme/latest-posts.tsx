"use client";

import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { getSortedPostsData } from "../../service/post";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Post } from "../declaration/blog";

export function LatestPosts() {
  const t = useTranslations("Home");
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const posts = await getSortedPostsData();
    setPosts(posts);
  };

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">{t("latestPosts")}</h2>
        <Link href="/blog">
          <Button variant="outline">
            {t("viewAll")}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post, index) => (
          <Card
            key={index}
            className="group hover:shadow-lg transition-shadow duration-300"
          >
            <CardHeader>
              <div className="flex items-center text-sm text-muted-foreground mb-2">
                <Calendar className="h-4 w-4 mr-1" />
                {post.date}
                <span className="mx-2">•</span>
                {post.readTime}
              </div>
              <CardTitle className="group-hover:text-primary transition-colors">
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground line-clamp-3">
                {post.excerpt}
              </p>
              <div className="flex flex-wrap gap-2">
                {post.tags?.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
