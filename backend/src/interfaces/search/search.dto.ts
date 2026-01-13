export interface SearchUserData {
  id: string;
  name: string;
  avatar: string | null;
  cosmetic: string;
}

export interface SearchBrandData {
  id: string;
  name: string;
  category: string | null;
  logo: string | null;
}

export interface SearchProductData {
  id: string;
  name: string;
  model: string;
  specs: string;
  image: string | null;
}

export interface SearchData {
  userData: SearchUserData[];
  brandData: SearchBrandData[];
  productData: SearchProductData[];
}


