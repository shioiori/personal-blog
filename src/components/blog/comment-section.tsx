"use client";

import type React from "react";

import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";
import { CommentList } from "./comment-list";
import { useTranslations } from "next-intl";

interface Comment {
  id: number;
  name: string;
  email?: string;
  content: string;
  date: string;
}

export function CommentSection() {
  const t = useTranslations("Comment");
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState({
    name: "",
    email: "",
    content: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.name.trim() || !newComment.content.trim()) return;

    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const comment: Comment = {
      id: comments.length + 1,
      name: newComment.name,
      email: newComment.email || undefined,
      content: newComment.content,
      date: new Date().toISOString().split("T")[0]
    };

    setComments([comment, ...comments]);
    setNewComment({ name: "", email: "", content: "" });
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageCircle className="h-5 w-5 mr-2" />
            {t("title")} ({comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 mb-8">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("name")} *</Label>
                <Input
                  id="name"
                  placeholder={t("namePlaceholder")}
                  value={newComment.name}
                  onChange={(e) =>
                    setNewComment({ ...newComment, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={newComment.email}
                  onChange={(e) =>
                    setNewComment({ ...newComment, email: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">{t("comment")} *</Label>
              <Textarea
                id="content"
                placeholder={t("commentPlaceholder")}
                rows={4}
                value={newComment.content}
                onChange={(e) =>
                  setNewComment({ ...newComment, content: e.target.value })
                }
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full md:w-auto"
            >
              {isSubmitting ? (
                t("submitting")
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {t("submit")}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      <CommentList comments={comments} />
    </div>
  );
}
