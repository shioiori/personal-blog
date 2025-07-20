"use client";

import { Project } from "@/src/components/declaration/project";
import { ProjectList } from "@/src/components/project/project-list";
import { getProjectList } from "@/src/service/project";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export default function ProjectsPage() {
  const t = useTranslations("Project");
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const projects = await getProjectList();
    setProjects(projects);
  };
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          {t("title")}
        </h1>
        <p className="text-xl text-muted-foreground">{t("description")}</p>
      </div>
      <ProjectList projects={projects} />
    </div>
  );
}
