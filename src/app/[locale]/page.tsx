import { PersonalInfo } from "@/src/components/home/PersonalInfo";
import { LatestPosts } from "@/src/components/aboutme/LatestPosts";

export default function HomePage() {
  return (
    <div className="space-y-12">
      <PersonalInfo />
      <LatestPosts />
    </div>
  );
}
