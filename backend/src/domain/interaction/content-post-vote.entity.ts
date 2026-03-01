import { VoteType } from './vote-type.enum';

export class ContentPostVote {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly postId: string,
    public readonly voteType: VoteType,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  belongsToUser(userId: string): boolean {
    return this.userId === userId;
  }

  isUpvote(): boolean {
    return this.voteType === VoteType.UPVOTE;
  }
}
