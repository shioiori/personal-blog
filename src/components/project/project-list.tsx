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
import { useTranslations } from "next-intl";
import { getProjectList } from "@/src/service/project";
import moment from "moment";
import { Project } from "../declaration/project";
export function ProjectList({ projects }: { projects: Project[] }) {
  const t = useTranslations("Project");
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
              {statusProjects.length}{" "}
              {statusProjects.length > 1 ? t("projects") : t("project")}
            </Badge>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {statusProjects.map((project) => (
              <Card
                key={project.id}
                className="group hover:shadow-lg transition-all duration-300"
              >
                <div className="relative overflow-hidden rounded-t-lg">
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
                    <Link href={`/projects/${project.slug}`}>
                      {project.title}
                    </Link>
                  </CardTitle>
                  <div className="flex items-center text-sm text-muted-foreground space-x-4">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {moment(project.startDate).format("DD/MM/YYYY")}
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      {project.teamSize}{" "}
                      {(project.teamSize || 1) > 1 ? t("people") : t("person")}
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
                    <Link href={`/projects/${project.slug}`}>
                      <Button variant="default" size="sm">
                        {t("detail")}
                      </Button>
                    </Link>
                    {project.githubUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={project.githubUrl} target="_blank">
                          {t("sourceCode")}
                        </Link>
                      </Button>
                    )}
                    {project.liveUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={project.liveUrl} target="_blank">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          {t("demo")}
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
