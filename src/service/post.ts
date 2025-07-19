"use server";

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import { Post } from "@/src/components/declaration/blog";

const postsDirectory = path.join(process.cwd(), "src/contents/post");

export async function getAllPostSlugs() {
  return fs.readdirSync(postsDirectory).map((filename) => ({
    params: { slug: filename.replace(/\.md$/, "") }
  }));
}

export async function getSortedPostsData() {
  const fileNames = fs.readdirSync(postsDirectory);
  return fileNames.map((fileName) => {
    const slug = fileName.replace(/\.md$/, "");
    const fullPath = path.join(postsDirectory, fileName);
    const fileContents = fs.readFileSync(fullPath, "utf8");
    const { data } = matter(fileContents);
    return {
      id: data.id ?? slug,
      title: data.title ?? "",
      slug: slug,
      date: data.date ?? "",
      excerpt: data.excerpt ?? "",
      coverImage: data.coverImage ?? "",
      author: data.author ?? "",
      readTime: data.readTime ?? 0,
      tags: data.tags ?? [],
      content: data.content ?? ""
    } as Post;
  });
}

export async function getPostData(slug: string) {
  const fullPath = path.join(postsDirectory, `${slug}.md`);
  const fileContents = fs.readFileSync(fullPath, "utf8");

  const { data, content } = matter(fileContents);
  const processedContent = await remark().use(html).process(content);
  const contentHtml = processedContent.toString();

  return { slug, content: contentHtml, ...data };
}
