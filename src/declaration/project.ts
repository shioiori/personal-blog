import { ProjectStatus } from "../enums";

export interface Project {
  id: string;
  title: string;
  description?: string;
  startDate?: Date;
  status: ProjectStatus;
  technologies: string[];
  githubUrl?: string;
  liveUrl?: string;
  teamSize?: number;
  duration?: string;
  slug: string;
  content: string;
}
