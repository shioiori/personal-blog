import { Avatar, AvatarFallback } from "@radix-ui/react-avatar";

export const CommentList = ({ comments }: { comments: any[] }) => {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {comments.map((comment) => (
        <div key={comment.id} className="flex space-x-4">
          <Avatar>
            <AvatarFallback className="bg-primary/10 text-primary inline-block size-8 rounded-full ring-2 ring-white flex items-center justify-center p-5">
              {getInitials(comment.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <div className="flex items-center space-x-2">
              <span className="font-semibold">{comment.name}</span>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">
                {comment.date}
              </span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {comment.content}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
