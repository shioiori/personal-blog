import { ProjectList } from "@/src/components/project/project-list";

export default function ProjectsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Dự án
        </h1>
        <p className="text-xl text-muted-foreground">
          Các dự án cá nhân đã/đang/sắp triển khai
        </p>
      </div>
      {/* <ProjectList /> */}
    </div>
  );
}
