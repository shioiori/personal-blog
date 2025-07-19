import { PersonalInfo } from "@/src/components/home/personal-info";
import { LatestPosts } from "@/src/components/aboutme/latest-posts";

export default function HomePage() {
  return (
    <div className="space-y-12">
      <PersonalInfo />
      <LatestPosts />
    </div>
  );
}
