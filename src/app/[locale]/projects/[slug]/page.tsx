import { notFound } from "next/navigation";
import { ProjectDetail } from "@/src/components/project/project-detail";

// Mock data cho project details
const projectDetails = [
  {
    slug: "e-commerce-platform",
    title: "E-commerce Platform",
    description:
      "Nền tảng thương mại điện tử hoàn chỉnh với React, Next.js và Stripe integration",
    fullDescription: `
# E-commerce Platform

Dự án này là một nền tảng thương mại điện tử hoàn chỉnh được xây dựng với các công nghệ hiện đại nhất.

## Tính năng chính

### Frontend
- **Giao diện người dùng**: Thiết kế responsive với Tailwind CSS
- **Quản lý state**: Redux Toolkit cho state management
- **Authentication**: NextAuth.js cho đăng nhập/đăng ký
- **Shopping Cart**: Giỏ hàng với localStorage persistence

### Backend
- **API Routes**: Next.js API routes cho backend logic
- **Database**: PostgreSQL với Prisma ORM
- **Payment**: Stripe integration cho thanh toán online
- **File Upload**: Cloudinary cho quản lý hình ảnh

### Admin Dashboard
- **Quản lý sản phẩm**: CRUD operations cho products
- **Quản lý đơn hàng**: Theo dõi và xử lý orders
- **Analytics**: Dashboard với charts và statistics
- **User Management**: Quản lý customers và permissions

## Thách thức và giải pháp

### Performance Optimization
- Implement lazy loading cho images
- Code splitting với dynamic imports
- Server-side rendering cho SEO

### Security
- Input validation với Zod
- CSRF protection
- Rate limiting cho API endpoints

## Kết quả

Dự án đã được deploy thành công và đang phục vụ hơn 1000+ users với:
- 99.9% uptime
- Average page load time < 2s
- Mobile-first responsive design
    `,
    image: "/placeholder.svg?height=400&width=800",
    date: "2024-01-15",
    status: "completed",
    technologies: [
      "Next.js",
      "React",
      "TypeScript",
      "Stripe",
      "Prisma",
      "PostgreSQL"
    ],
    githubUrl: "https://github.com",
    liveUrl: "https://example.com",
    teamSize: 3,
    duration: "6 tháng",
    role: "Full-stack Developer & Team Lead"
  },
  {
    slug: "task-management-app",
    title: "Task Management App",
    description:
      "Ứng dụng quản lý công việc với tính năng real-time collaboration",
    fullDescription: `
# Task Management App

Ứng dụng quản lý công việc hiện đại với khả năng collaboration real-time.

## Tính năng

- Real-time collaboration với Socket.io
- Drag & drop interface
- Notification system
- Team management
- Progress tracking

## Công nghệ sử dụng

- React với TypeScript
- Node.js backend
- Socket.io cho real-time features
- MongoDB database
- Tailwind CSS cho styling
    `,
    image: "/placeholder.svg?height=400&width=800",
    date: "2024-01-01",
    status: "in-progress",
    technologies: ["React", "Node.js", "Socket.io", "MongoDB", "Tailwind CSS"],
    githubUrl: "https://github.com",
    teamSize: 2,
    duration: "4 tháng",
    role: "Frontend Developer"
  }
];

interface ProjectDetailPageProps {
  params: {
    slug: string;
  };
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const project = projectDetails.find((p) => p.slug === params.slug);

  if (!project) {
    notFound();
  }

  return <ProjectDetail project={project} />;
}
