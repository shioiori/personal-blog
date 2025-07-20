"use server";

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import { Project } from "../components/declaration/project";

const postsDirectory = path.join(process.cwd(), "src/contents/project");

export async function getAllProjectSlugs() {
  return fs.readdirSync(postsDirectory).map((filename) => ({
    params: { slug: filename.replace(/\.md$/, "") }
  }));
}

export async function getProjectList() {
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
      description: data.description ?? "",
      startDate: data.startDate ?? "",
      status: data.status ?? "",
      technologies: data.technologies ?? [],
      githubUrl: data.githubUrl ?? "",
      liveUrl: data.liveUrl ?? "",
      teamSize: data.teamSize ?? 1,
      duration: data.duration ?? ""
    } as Project;
  });
}

export async function getProject(slug: string) {
  const fullPath = path.join(postsDirectory, `${slug}.md`);
  const fileContents = fs.readFileSync(fullPath, "utf8");

  const { data, content } = matter(fileContents);
  const processedContent = await remark().use(html).process(content);
  const contentHtml = processedContent.toString();

  return { slug, content: contentHtml, ...data };
}
