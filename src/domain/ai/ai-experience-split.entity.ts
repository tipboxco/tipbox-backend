export class AiExperienceSplit {
  constructor(
    public id: string,
    public userId: string,
    public productId: string | null,
    public originalExperience: string,
    public priceAndShopping: string | null,
    public productAndUsage: string | null,
    public priceAndShoppingRating: number | null,
    public productAndUsageRating: number | null,
    public isEdited: boolean,
    public model: string,
    public promptVersion: string,
    public tokensUsed: number | null,
    public processingTimeMs: number | null,
    public createdAt: Date,
    public updatedAt: Date
  ) {}
}

