import Link from "next/link";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Post } from "../declaration/blog";
import { useState, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@radix-ui/react-dropdown-menu";
import { useTranslations } from "next-intl";

export function BlogList({ posts }: { posts: Post[] }) {
  const t = useTranslations("Blog");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((post) => {
      post.tags?.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return counts;
  }, [posts]);

  const allTags = useMemo(() => Object.keys(tagCounts), [tagCounts]);

  const filteredPosts = useMemo(() => {
    if (!selectedTags.length) return posts;
    return posts.filter((post) =>
      selectedTags.every((tag) => post.tags?.includes(tag))
    );
  }, [posts, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearTags = () => setSelectedTags([]);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex justify-end gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {selectedTags.length
                  ? `${t("tag")}: ${selectedTags.join(", ")}`
                  : t("filterByTags")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="min-w-[180px] max-h-72 overflow-y-auto p-2 rounded-lg shadow-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
            >
              {allTags.map((tag) => (
                <DropdownMenuItem
                  key={tag}
                  onSelect={(e) => {
                    e.preventDefault();
                    toggleTag(tag);
                  }}
                  className={`rounded px-2 py-1.5 cursor-pointer flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                    selectedTags.includes(tag)
                      ? "bg-zinc-100 dark:bg-zinc-800 font-semibold text-primary"
                      : ""
                  }`}
                >
                  {selectedTags.includes(tag) && (
                    <span className="text-primary">✓</span>
                  )}
                  <span>
                    {tag}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({tagCounts[tag]})
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {selectedTags.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearTags}>
              {t("clearFilter")}
            </Button>
          )}
        </div>
        <div className="grid gap-6">
          {filteredPosts.map((post) => (
            <Card
              key={post.id}
              className="group hover:shadow-lg transition-shadow duration-300"
            >
              <CardHeader>
                <div className="flex items-center text-sm text-muted-foreground mb-2">
                  <Calendar className="h-4 w-4 mr-1" />
                  {post.date}
                  <span className="mx-2">•</span>
                  <Clock className="h-4 w-4 mr-1" />
                  {post.readTime}
                </div>
                <CardTitle className="group-hover:text-primary transition-colors">
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{post.excerpt}</p>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {post.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <Link href={`/blog/${post.slug}`}>
                    <Button variant="ghost" size="sm" className="group/btn">
                      {t("readMore")}
                      <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
