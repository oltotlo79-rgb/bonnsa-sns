import Image from 'next/image'
import Link from 'next/link'

type UserCardProps = {
  user: {
    id: string
    nickname: string
    avatar_url: string | null
    bio: string | null
  }
}

export function UserCard({ user }: UserCardProps) {
  return (
    <Link
      href={`/users/${user.id}`}
      className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors"
    >
      <div className="w-12 h-12 rounded-full bg-muted overflow-hidden flex-shrink-0">
        {user.avatar_url ? (
          <Image
            src={user.avatar_url}
            alt={user.nickname}
            width={48}
            height={48}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg text-muted-foreground">
            {user.nickname.charAt(0)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{user.nickname}</p>
        {user.bio && (
          <p className="text-sm text-muted-foreground line-clamp-2">{user.bio}</p>
        )}
      </div>
    </Link>
  )
}
