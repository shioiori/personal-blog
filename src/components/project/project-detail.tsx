import {
  Calendar,
  Clock,
  ArrowLeft,
  ExternalLink,
  Github,
  Users,
  Briefcase
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent } from "@/src/components/ui/card";
import Link from "next/link";
import Image from "next/image";

interface ProjectDetailProps {
  project: {
    title: string;
    description: string;
    fullDescription: string;
    image: string;
    date: string;
    status: string;
    technologies: string[];
    githubUrl?: string;
    liveUrl?: string;
    teamSize: number;
    duration: string;
    role: string;
  };
}

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

export function ProjectDetail({ project }: ProjectDetailProps) {
  return (
    <article className="max-w-4xl mx-auto">
      {/* Back Button */}
      <div className="mb-8">
        <Link href="/projects">
          <Button variant="ghost" className="pl-0">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Quay lại Dự án
          </Button>
        </Link>
      </div>

      {/* Header */}
      <header className="space-y-6 mb-12">
        <div className="flex items-center space-x-3">
          <div
            className={`w-3 h-3 rounded-full ${
              statusConfig[project.status as keyof typeof statusConfig].color
            }`}
          ></div>
          <Badge
            variant={
              statusConfig[project.status as keyof typeof statusConfig].variant
            }
          >
            {statusConfig[project.status as keyof typeof statusConfig].label}
          </Badge>
        </div>

        <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
          {project.title}
        </h1>
        <p className="text-xl text-muted-foreground">{project.description}</p>

        {/* Project Info */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Calendar className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">Ngày bắt đầu</div>
              <div className="font-semibold">{project.date}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">Thời gian</div>
              <div className="font-semibold">{project.duration}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">Thành viên</div>
              <div className="font-semibold">{project.teamSize} người</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Briefcase className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">Vai trò</div>
              <div className="font-semibold text-xs">{project.role}</div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          {project.githubUrl && (
            <Button variant="outline" asChild>
              <Link href={project.githubUrl} target="_blank">
                <Github className="h-4 w-4 mr-2" />
                Source Code
              </Link>
            </Button>
          )}
          {project.liveUrl && (
            <Button asChild>
              <Link href={project.liveUrl} target="_blank">
                <ExternalLink className="h-4 w-4 mr-2" />
                Xem Demo
              </Link>
            </Button>
          )}
        </div>
      </header>

      {/* Project Image */}
      <div className="mb-12">
        <Image
          src={project.image || "/placeholder.svg"}
          alt={project.title}
          width={800}
          height={400}
          className="w-full h-[400px] object-cover rounded-lg"
        />
      </div>

      {/* Technologies */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Công nghệ sử dụng</h2>
        <div className="flex flex-wrap gap-3">
          {project.technologies.map((tech) => (
            <Badge key={tech} variant="secondary" className="text-sm py-1 px-3">
              {tech}
            </Badge>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="prose prose-lg max-w-none dark:prose-invert">
        <div
          dangerouslySetInnerHTML={{
            __html: project.fullDescription.replace(/\n/g, "<br>")
          }}
        />
      </div>
    </article>
  );
}
