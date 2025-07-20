import { notFound } from "next/navigation";
import { BlogPost } from "@/src/components/blog/blog-post";
import { getPostData } from "@/src/service/post";
import { Post } from "@/src/components/declaration/blog";
import { use, useEffect, useState } from "react";

export default async function Page({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!slug) {
    notFound();
  }

  return (
    <>
      <BlogPost slug={slug} />
    </>
  );
}
