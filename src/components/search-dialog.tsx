import { useEffect, useState } from "react";
import { Search, FileText, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import Link from "next/link";
import { getSortedPostsData } from "../service/post";
import { useTranslations } from "next-intl";
import { Post } from "./declaration/blog";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const t = useTranslations("Search");
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilterPosts] = useState<Post[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const filteredPosts = posts.filter(
      (post) =>
        post.title.toLowerCase().includes(query.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(query.toLowerCase())
    );
    setFilterPosts(filteredPosts);
  }, [query, posts]);

  const fetchData = async () => {
    const posts = await getSortedPostsData();
    setPosts(posts);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nhập từ khóa tìm kiếm..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
        </div>

        <div className="mt-4 max-h-[400px] overflow-y-auto">
          {query === "" ? (
            <div className="text-center text-muted-foreground py-8">
              {t("searchPlaceholder")}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {t("noResult")}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  onClick={() => onOpenChange(false)}
                >
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-auto p-4 text-left"
                  >
                    <div className="flex items-start space-x-3">
                      <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{post.title}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {post.excerpt}
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3 mr-1" />
                          {post.date}
                        </div>
                      </div>
                    </div>
                  </Button>
                </Link>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
