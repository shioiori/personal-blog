export interface Post {
  id: any;
  title: string;
  slug: string;
  date: string;
  readTime: string;
  excerpt: string;
  tags: string[];
  content: string;
}

export interface Comment {
  id: number;
  name: string;
  email?: string;
  content: string;
  date: string;
}
