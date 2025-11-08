export interface CreateExpertRequestDto {
  description: string;
  category?: string;
  tipsAmount?: number;
  mediaUrls?: Array<{ url: string; type: 'IMAGE' | 'VIDEO' }>;
}

export interface UpdateExpertRequestTipsDto {
  tipsAmount: number;
}

export interface ExpertRequestMediaResponse {
  id: string;
  mediaUrl: string;
  mediaType: string;
  uploadedAt: string;
}

export interface ExpertRequestResponse {
  id: string;
  userId: string;
  description: string;
  category: string | null;
  tipsAmount: number;
  status: string;
  answeredAt: string | null;
  createdAt: string;
  updatedAt: string;
  media?: ExpertRequestMediaResponse[];
}

export interface ExpertAnswerUser {
  id: string;
  name: string;
  title: string[];
  avatar: string | null;
}

export interface ExpertAnswerResponse {
  question: {
    description: string;
  };
  answer: {
    user: ExpertAnswerUser;
    content: string;
  };
}

export interface ExpertAnsweredDetailResponse {
  id: string;
  description: string;
  category: string | null;
  tipsAmount: number;
  createdAt: string;
  answeredAt: string;
  media?: ExpertRequestMediaResponse[];
  answers: Array<{
    id: string;
    user: ExpertAnswerUser;
    content: string;
    createdAt: string;
  }>;
}

export interface AcceptExpertAnswerDto {
  answerId?: string; // Specific answer to accept, if multiple answers exist
}

export interface ExpertRequestStatusResponse {
  id: string;
  status: 'PENDING' | 'BROADCASTING' | 'EXPERT_FOUND' | 'ANSWERED' | 'CLOSED';
  description: string;
  category: string | null;
  tipsAmount: number;
  estimatedWaitTimeMinutes: number | null;
  expertFound: {
    expertUserId: string;
    expertName: string;
    expertTitle: string[];
    expertAvatar: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpertCategoriesResponse {
  categories: Array<{
    value: string;
    label: string;
  }>;
}

export interface CreateExpertAnswerDto {
  content: string;
}

export interface ExpertAnswerDetailResponse {
  id: string;
  requestId: string;
  expertUserId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  request: {
    id: string;
    description: string;
    tipsAmount: number;
    status: string;
    userId: string;
  };
  expertUser: ExpertAnswerUser;
}

export interface MyExpertRequestsResponse {
  answered: ExpertRequestResponse[];
  pending: ExpertRequestResponse[];
}

