import { VoteType } from './vote-type.enum';

export class ContentCommentVote {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly commentId: number,
    public readonly voteType: VoteType,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  belongsToComment(commentId: number): boolean {
    return this.commentId === commentId;
  }

  isUpvote(): boolean {
    return this.voteType === VoteType.UPVOTE;
  }

  isDownvote(): boolean {
    return this.voteType === VoteType.DOWNVOTE;
  }

  getVoteDisplayName(): string {
    return this.isUpvote() ? 'Beğeni' : 'Beğenmeme';
  }

  getVoteIcon(): string {
    return this.isUpvote() ? '👍' : '👎';
  }

  getVoteValue(): number {
    return this.isUpvote() ? 1 : -1;
  }
}