"use client";

import {
  Calendar,
  Clock,
  ArrowLeft,
  ExternalLink,
  Github,
  Users
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent } from "@/src/components/ui/card";
import Link from "next/link";
import { getProject } from "@/src/service/project";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Project } from "../declaration/project";
import { notFound } from "next/navigation";
import moment from "moment";

export function ProjectDetail({ slug }: { slug: string }) {
  const t = useTranslations("Project");
  const b = useTranslations("Common");
  const [project, setProject] = useState<Project>();

  const statusConfig = {
    completed: {
      label: t("completed"),
      variant: "default" as const,
      color: "bg-green-500"
    },
    ongoing: {
      label: t("ongoing"),
      variant: "secondary" as const,
      color: "bg-blue-500"
    },
    upcoming: {
      label: t("upcoming"),
      variant: "outline" as const,
      color: "bg-orange-500"
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const project = (await getProject(slug)) as Project;
    if (!project) {
      notFound();
    }
    setProject(project);
  }

  return (
    project && (
      <article className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/projects">
            <Button variant="ghost" className="pl-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {b("back")}
            </Button>
          </Link>
        </div>

        <header className="space-y-6 mb-12">
          <div className="flex items-center space-x-3">
            <div
              className={`w-3 h-3 rounded-full ${
                statusConfig[project.status as keyof typeof statusConfig].color
              }`}
            ></div>
            <Badge
              variant={
                statusConfig[project.status as keyof typeof statusConfig]
                  .variant
              }
            >
              {statusConfig[project.status as keyof typeof statusConfig].label}
            </Badge>
          </div>

          <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
            {project.title}
          </h1>
          <p className="text-xl text-muted-foreground">{project.description}</p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Calendar className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">
                  {t("startDate")}
                </div>
                <div className="font-semibold">
                  {moment(project.startDate).format("DD/MM/YYYY")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">Thời gian</div>
                <div className="font-semibold">
                  {project.duration || "-----"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">
                  {t("teamSize")}
                </div>
                <div className="font-semibold">
                  {project.teamSize}{" "}
                  {(project.teamSize || 1) > 1 ? t("people") : t("person")}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex space-x-4">
            {project.githubUrl && (
              <Button variant="outline" asChild>
                <Link href={project.githubUrl} target="_blank">
                  <Github className="h-4 w-4 mr-2" />
                  {t("sourceCode")}
                </Link>
              </Button>
            )}
            {project.liveUrl && (
              <Button asChild>
                <Link href={project.liveUrl} target="_blank">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t("liveSite")}
                </Link>
              </Button>
            )}
          </div>
        </header>
        <div className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">{t("technologies")}</h2>
          <div className="flex flex-wrap gap-3">
            {project.technologies.map((tech) => (
              <Badge
                key={tech}
                variant="secondary"
                className="text-sm py-1 px-3"
              >
                {tech}
              </Badge>
            ))}
          </div>
        </div>

        <div className="prose prose-lg max-w-none dark:prose-invert">
          <div
            dangerouslySetInnerHTML={{
              __html: project.content.replace(/\n/g, "<br>")
            }}
          />
        </div>
      </article>
    )
  );
}
