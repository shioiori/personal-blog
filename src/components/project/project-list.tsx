import Link from "next/link";
import { ExternalLink, Github, Calendar, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import Image from "next/image";

const projects = [
  {
    id: 1,
    title: "E-commerce Platform",
    description:
      "Nền tảng thương mại điện tử hoàn chỉnh với React, Next.js và Stripe integration. Hỗ trợ thanh toán online, quản lý đơn hàng và dashboard admin.",
    image: "/placeholder.svg?height=200&width=400",
    status: "completed",
    date: "2024-01-15",
    technologies: ["Next.js", "React", "TypeScript", "Stripe", "Prisma"],
    githubUrl: "https://github.com",
    liveUrl: "https://example.com",
    teamSize: 3
  },
  {
    id: 2,
    title: "Task Management App",
    description:
      "Ứng dụng quản lý công việc với tính năng real-time collaboration, drag & drop, và notification system. Sử dụng Socket.io cho real-time features.",
    image: "/placeholder.svg?height=200&width=400",
    status: "in-progress",
    date: "2024-01-01",
    technologies: ["React", "Node.js", "Socket.io", "MongoDB", "Tailwind CSS"],
    githubUrl: "https://github.com",
    teamSize: 2
  },
  {
    id: 3,
    title: "AI Content Generator",
    description:
      "Công cụ tạo nội dung tự động sử dụng AI, hỗ trợ tạo blog posts, social media content và email marketing. Tích hợp OpenAI API.",
    image: "/placeholder.svg?height=200&width=400",
    status: "upcoming",
    date: "2024-02-01",
    technologies: ["Next.js", "OpenAI API", "Vercel AI SDK", "PostgreSQL"],
    teamSize: 1
  },
  {
    id: 4,
    title: "Learning Management System",
    description:
      "Hệ thống quản lý học tập online với video streaming, quiz system, progress tracking và certificate generation.",
    image: "/placeholder.svg?height=200&width=400",
    status: "completed",
    date: "2023-12-01",
    technologies: ["React", "Express.js", "MySQL", "AWS S3", "JWT"],
    githubUrl: "https://github.com",
    liveUrl: "https://example.com",
    teamSize: 4
  }
];

const statusConfig = {
  completed: {
    label: "Hoàn thành",
    variant: "default" as const,
    color: "bg-green-500"
  },
  "in-progress": {
    label: "Đang phát triển",
    variant: "secondary" as const,
    color: "bg-blue-500"
  },
  upcoming: {
    label: "Sắp triển khai",
    variant: "outline" as const,
    color: "bg-orange-500"
  }
};

export function ProjectList() {
  return (
    <div className="space-y-8">
      {Object.entries(
        projects.reduce((acc, project) => {
          if (!acc[project.status]) acc[project.status] = [];
          acc[project.status].push(project);
          return acc;
        }, {} as Record<string, typeof projects>)
      ).map(([status, statusProjects]) => (
        <div key={status} className="space-y-6">
          <div className="flex items-center space-x-3">
            <div
              className={`w-3 h-3 rounded-full ${
                statusConfig[status as keyof typeof statusConfig].color
              }`}
            ></div>
            <h2 className="text-2xl font-semibold">
              {statusConfig[status as keyof typeof statusConfig].label}
            </h2>
            <Badge
              variant={
                statusConfig[status as keyof typeof statusConfig].variant
              }
            >
              {statusProjects.length} dự án
            </Badge>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {statusProjects.map((project) => (
              <Card
                key={project.id}
                className="group hover:shadow-lg transition-all duration-300"
              >
                <div className="relative overflow-hidden rounded-t-lg">
                  <Image
                    src={project.image || "/placeholder.svg"}
                    alt={project.title}
                    width={400}
                    height={200}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-4 right-4">
                    <Badge
                      variant={
                        statusConfig[
                          project.status as keyof typeof statusConfig
                        ].variant
                      }
                    >
                      {
                        statusConfig[
                          project.status as keyof typeof statusConfig
                        ].label
                      }
                    </Badge>
                  </div>
                </div>

                <CardHeader>
                  <CardTitle className="group-hover:text-primary transition-colors">
                    <Link
                      href={`/projects/${
                        project.id === 1
                          ? "e-commerce-platform"
                          : project.id === 2
                          ? "task-management-app"
                          : "ai-content-generator"
                      }`}
                    >
                      {project.title}
                    </Link>
                  </CardTitle>
                  <div className="flex items-center text-sm text-muted-foreground space-x-4">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {project.date}
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      {project.teamSize} người
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">{project.description}</p>

                  <div className="flex flex-wrap gap-2">
                    {project.technologies.map((tech) => (
                      <Badge key={tech} variant="secondary" className="text-xs">
                        {tech}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <Link
                      href={`/projects/${
                        project.id === 1
                          ? "e-commerce-platform"
                          : project.id === 2
                          ? "task-management-app"
                          : "ai-content-generator"
                      }`}
                    >
                      <Button variant="default" size="sm">
                        Xem chi tiết
                      </Button>
                    </Link>
                    {project.githubUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={project.githubUrl} target="_blank">
                          <Github className="h-4 w-4 mr-2" />
                          Code
                        </Link>
                      </Button>
                    )}
                    {project.liveUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={project.liveUrl} target="_blank">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Demo
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
