import {
  Download,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  Code,
  Briefcase
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Progress } from "@/src/components/ui/progress";
import Image from "next/image";
import { Education, Experience } from "../declaration/aboutme";

const skills = [
  { name: "JavaScript/TypeScript", level: 90 },
  { name: "React/Next.js", level: 95 },
  { name: "Node.js", level: 85 },
  { name: "Python", level: 80 },
  { name: "UI/UX Design", level: 75 },
  { name: "Database (SQL/NoSQL)", level: 85 }
];

const experiences: Experience[] = [
  {
    title: "Senior Full-stack Developer",
    company: "Tech Company ABC",
    period: "2022 - Hiện tại",
    description:
      "Phát triển và duy trì các ứng dụng web quy mô lớn, leading team 5 developers.",
    technologies: ["React", "Next.js", "Node.js", "PostgreSQL"]
  },
  {
    title: "Frontend Developer",
    company: "Startup XYZ",
    period: "2020 - 2022",
    description:
      "Xây dựng giao diện người dùng cho các sản phẩm SaaS, tối ưu hóa performance.",
    technologies: ["React", "Vue.js", "TypeScript", "Tailwind CSS"]
  },
  {
    title: "Junior Developer",
    company: "Agency DEF",
    period: "2019 - 2020",
    description:
      "Phát triển website cho khách hàng, học hỏi và áp dụng best practices.",
    technologies: ["HTML", "CSS", "JavaScript", "WordPress"]
  }
];

const education: Education[] = [
  {
    degree: "Cử nhân Công nghệ Thông tin",
    school: "Đại học Bách Khoa TP.HCM",
    period: "2015 - 2019",
    gpa: "3.8/4.0"
  }
];

const certifications: string[] = [
  "AWS Certified Developer",
  "Google Cloud Professional",
  "Meta React Developer",
  "MongoDB Certified Developer"
];

export function AboutMe() {
  return (
    <div className="space-y-12">
      {/* Header Section */}
      <div className="text-center space-y-6">
        <div className="relative inline-block">
          <Image
            src="/placeholder.svg?height=150&width=150"
            alt="Profile"
            width={150}
            height={150}
            className="rounded-full mx-auto border-4 border-primary/20"
          />
          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-background"></div>
        </div>
        <div>
          <h1 className="text-4xl font-bold mb-2">Tên của bạn</h1>
          <p className="text-xl text-muted-foreground mb-4">
            Senior Full-stack Developer
          </p>
          <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
            <div className="flex items-center">
              <Mail className="h-4 w-4 mr-2" />
              your.email@example.com
            </div>
            <div className="flex items-center">
              <Phone className="h-4 w-4 mr-2" />
              +84 123 456 789
            </div>
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-2" />
              TP.HCM, Việt Nam
            </div>
          </div>
        </div>
        <Button size="lg">
          <Download className="h-4 w-4 mr-2" />
          Tải CV
        </Button>
      </div>

      {/* About Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Code className="h-5 w-5 mr-2" />
            Giới thiệu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            Tôi là một Full-stack Developer với hơn 5 năm kinh nghiệm trong việc
            phát triển các ứng dụng web hiện đại. Đam mê công nghệ và luôn học
            hỏi những xu hướng mới trong ngành IT.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Chuyên môn chính của tôi bao gồm React, Next.js, Node.js và các công
            nghệ cloud. Tôi có kinh nghiệm làm việc với cả startup và công ty
            lớn, từ việc xây dựng MVP đến scale hệ thống phục vụ hàng triệu
            người dùng.
          </p>
        </CardContent>
      </Card>

      {/* Skills Section */}
      <Card>
        <CardHeader>
          <CardTitle>Kỹ năng</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {skills.map((skill) => (
              <div key={skill.name} className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">{skill.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {skill.level}%
                  </span>
                </div>
                <Progress value={skill.level} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Experience Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Briefcase className="h-5 w-5 mr-2" />
            Kinh nghiệm làm việc
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {experiences.map((exp, index) => (
              <div
                key={index}
                className="relative pl-6 border-l-2 border-muted"
              >
                <div className="absolute -left-2 top-0 w-4 h-4 bg-primary rounded-full"></div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{exp.title}</h3>
                    <Badge variant="outline">{exp.period}</Badge>
                  </div>
                  <p className="text-primary font-medium">{exp.company}</p>
                  <p className="text-muted-foreground">{exp.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {exp.technologies.map((tech) => (
                      <Badge key={tech} variant="secondary" className="text-xs">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Education & Certifications */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Học vấn
            </CardTitle>
          </CardHeader>
          <CardContent>
            {education.map((edu, index) => (
              <div key={index} className="space-y-2">
                <h3 className="font-semibold">{edu.degree}</h3>
                <p className="text-primary">{edu.school}</p>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{edu.period}</span>
                  <span>GPA: {edu.gpa}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Award className="h-5 w-5 mr-2" />
              Chứng chỉ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {certifications.map((cert, index) => (
                <div key={index} className="flex items-center">
                  <Award className="h-4 w-4 mr-3 text-primary" />
                  <span>{cert}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
