# Suggested Users (Önerilen Kullanıcılar) Özelliği

## 📋 Genel Bakış

Frontend'deki "Suggested Users" bölümü için backend API endpoint'i. Her kullanıcıya özel, trust etmediği kullanıcıları önerir. Pagination, search ve mutual trust count desteği ile.

## 🔗 API Endpoint

### GET /users/suggested

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `limit` (optional, default: 20, max: 50): Döndürülecek maksimum kullanıcı sayısı
- `cursor` (optional): Pagination için cursor (son kullanıcının ID'si)
- `q` (optional): Kullanıcı adı veya isim araması için search query

**Request Examples:**
```bash
# Basic request
GET /users/suggested?limit=20

# With pagination
GET /users/suggested?limit=15&cursor=user-123

# With search
GET /users/suggested?q=michael&limit=10

# Combined
GET /users/suggested?q=michael&limit=10&cursor=user-456
```

**Response Format:**
```json
{
  "items": [
    {
      "id": "user-123",
      "userName": "michael_clark",
      "name": "Michael Clark",
      "avatar": "https://cdn.tipbox.com/avatars/user-123.jpg",
      "titles": [
        "Technology Enthusiast",
        "Hardware Expert",
        "Digital Innovation Specialist"
      ],
      "isTrusted": false,
      "mutualTrustCount": 3,
      "stats": {
        "trust": 245,
        "truster": 189,
        "posts": 87
      }
    }
  ],
  "pagination": {
    "nextCursor": "user-456",
    "hasMore": true
  }
}
```

## 🎯 Özellikler

### Hariç Tutulan Kullanıcılar
- ✅ Kullanıcının kendisi
- ✅ Zaten trust edilmiş kullanıcılar (`trust_relations`)
- ✅ Engellenmiş kullanıcılar (`user_blocks`)
- ✅ Susturulmuş kullanıcılar (`user_mutes`)

### Öneri Algoritması
1. **Filtering:**
   - Exclude listesini oluştur (trust/block/mute)
   - displayName null olmayan kullanıcılar
   - Search query varsa isim/username'e göre filtrele

2. **Sorting:**
   - `trusterCount` DESC (popülerlik)
   - `postsCount` DESC (aktiflik)
   - `userId` DESC (consistent ordering)

3. **Pagination:**
   - Cursor-based pagination
   - limit + 1 ile hasMore kontrolü
   - Next cursor: son item'ın userId'si

4. **Enrichment:**
   - Avatar bilgisi (paralel)
   - Title bilgisi (paralel, max 5)
   - Mutual trust count (paralel)

### Mutual Trust Count
Suggested user'ın trust ettiği kişilerden kaç tanesini current user da trust ediyor.

**UI'da gösterim:**
- "3 ortak arkadaş"
- "5 mutual connections"

### isTrusted Field
Suggested users'da her zaman `false` (zaten trust edilmemiş olanlar öneriliyor).

### Performans Optimizasyonları
- ✅ Sadece gerekli alanlar select edilir
- ✅ Avatar, title ve mutual trust sorguları **paralel** çalışır (`Promise.all`)
- ✅ Map yapısı ile O(1) lookup performansı
- ✅ Cursor-based pagination (efficient)
- ✅ Index kullanımı (userId, isActive vb.)

## 💾 Database Queries

### Ana Sorgular
1. `trust_relations` - Trust edilen kullanıcılar
2. `user_blocks` - Engellenmiş kullanıcılar  
3. `user_mutes` - Susturulmuş kullanıcılar
4. `profiles` - Önerilen kullanıcılar (excludes listesi dışında)
5. `user_avatars` - Avatar bilgileri
6. `user_titles` - Title bilgileri

### Örnek SQL İşleyişi
```sql
-- 1. Trust edilen kullanıcıları al
SELECT trusted_user_id FROM trust_relations WHERE truster_id = ?

-- 2. Engellenmiş/Mute edilmiş kullanıcıları al
SELECT blocked_user_id FROM user_blocks WHERE blocker_id = ?
SELECT muted_user_id FROM user_mutes WHERE muter_id = ?

-- 3. Önerilen kullanıcıları getir
SELECT * FROM profiles 
WHERE user_id NOT IN (excludedIds)
  AND display_name IS NOT NULL
ORDER BY truster_count DESC, posts_count DESC
LIMIT 20

-- 4. Avatar ve title bilgilerini paralel olarak getir
SELECT * FROM user_avatars WHERE user_id IN (userIds) AND is_active = true
SELECT * FROM user_titles WHERE user_id IN (userIds) ORDER BY earned_at DESC
```

## 📝 Implementation Details

### Service Method
**File:** `src/application/user/user.service.ts`

```typescript
async getSuggestedUsers(userId: string): Promise<Array<{
  id: string;
  userName: string | null;
  name: string | null;
  avatar: string | null;
  titles: string[];
  stats: {
    posts: number;
    trust: number;
    truster: number;
  };
}>>
```

### Router Endpoint
**File:** `src/interfaces/user/user.router.ts`

```typescript
router.get('/suggested', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const suggestions = await userService.getSuggestedUsers(userId);
  return res.json(suggestions);
}));
```

## 🔒 Security

- ✅ Bearer Token authentication zorunlu
- ✅ User ID token'dan alınır (güvenli)
- ✅ SQL Injection korumalı (Prisma ORM)
- ✅ Privacy ayarlarına uygun (blocked/muted kullanıcılar hariç)

## 📊 Response Fields

| Field | Type | Description | Nullable |
|-------|------|-------------|----------|
| `id` | string | Kullanıcı UUID | ❌ |
| `userName` | string | Kullanıcı adı (@username) | ✅ |
| `name` | string | Display name | ✅ |
| `avatar` | string | Avatar URL (resolved) | ✅ |
| `titles` | string[] | Kullanıcı unvanları (max 5) | ❌ |
| `isTrusted` | boolean | Trust edilmiş mi? (her zaman false) | ❌ |
| `mutualTrustCount` | number | Ortak trust sayısı | ❌ |
| `stats.posts` | number | Post sayısı | ❌ |
| `stats.trust` | number | Trust ettiği kişi sayısı | ❌ |
| `stats.truster` | number | Kendisini trust eden kişi sayısı | ❌ |
| `pagination.nextCursor` | string | Sonraki sayfa cursor'ı | ✅ |
| `pagination.hasMore` | boolean | Daha fazla sayfa var mı? | ❌ |

## 🧪 Test Scenarios

### Test Case 1: Normal Kullanıcı
```bash
curl -X GET http://localhost:3000/users/suggested \
  -H "Authorization: Bearer YOUR_TOKEN"
```
**Expected:** Max 10 kullanıcı, trust edilmemiş olanlar

### Test Case 2: Yeni Kullanıcı (Hiç Trust Yok)
**Expected:** Popüler 10 kullanıcı (truster count yüksek olanlar)

### Test Case 3: Trust Dolu Kullanıcı (Çoğu kullanıcıyı trust etmiş)
**Expected:** Kalan kullanıcılardan max 10 tanesi

### Test Case 4: Block/Mute Kullanımı
**Expected:** Engellenmiş ve mute edilmiş kullanıcılar listede görünmez

## 🚀 Frontend Entegrasyonu

### TypeScript Interfaces

```typescript
/** Suggested User - Önerilen kullanıcı tipi */
export interface SuggestedUser {
  id: string;
  userName: string | null;
  name: string | null;
  avatar: string | null;
  titles: string[];
  isTrusted: boolean;
  mutualTrustCount: number;
  stats: {
    trust: number;
    truster: number;
    posts: number;
  };
}

/** Suggested Users API Response */
export interface SuggestedUsersApiResponse {
  items: SuggestedUser[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}
```

### API Function (profileApi.ts)

```typescript
/**
 * Get Suggested Users endpoint function
 * Kullanıcıya önerilen kullanıcıları getirir
 * 
 * @param searchQuery - İsim veya kullanıcı adına göre arama (opsiyonel)
 * @param cursor - Pagination cursor (opsiyonel)
 * @param limit - Sayfa başına item sayısı (default: 20)
 * @returns SuggestedUsersApiResponse - Önerilen kullanıcılar ve pagination bilgisi
 */
export const getSuggestedUsers = async (
  searchQuery?: string,
  cursor?: string,
  limit: number = 20
): Promise<SuggestedUsersApiResponse> => {
  const params = new URLSearchParams();
  
  if (searchQuery) {
    params.append('q', searchQuery);
  }
  if (cursor) {
    params.append('cursor', cursor);
  }
  params.append('limit', limit.toString());

  try {
    const response = await apiService.getClient().get<SuggestedUsersApiResponse>(
      `/users/suggested?${params.toString()}`
    );
    
    console.log('[getSuggestedUsers] API Response:', {
      url: `/users/suggested?${params.toString()}`,
      itemsCount: response.data?.items?.length || 0,
      hasMore: response.data?.pagination?.hasMore,
      nextCursor: response.data?.pagination?.nextCursor,
    });
    
    return response.data;
  } catch (error: any) {
    console.error('[getSuggestedUsers] API Error:', {
      url: `/users/suggested?${params.toString()}`,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });
    throw error;
  }
};
```

### React Query Hook (hooks.ts)

```typescript
/**
 * Get Suggested Users query hook
 * Önerilen kullanıcıları getirir ve cache'ler
 * 
 * @param searchQuery - İsim veya kullanıcı adına göre arama (opsiyonel)
 * @returns React Query hook result with infinite scroll support
 */
export const useSuggestedUsers = (searchQuery?: string) => {
  return useInfiniteQuery<SuggestedUsersApiResponse, Error>({
    queryKey: ['profile', 'suggested', searchQuery],
    queryFn: ({ pageParam }) => 
      getSuggestedUsers(searchQuery, pageParam as string | undefined, 20),
    getNextPageParam: (lastPage) => 
      lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined,
    initialPageParam: undefined,
    staleTime: 5 * 60 * 1000, // 5 dakika
    gcTime: 10 * 60 * 1000, // 10 dakika
  });
};
```

### Component Usage

```typescript
import { useSuggestedUsers } from '../api/hooks';
import { addToTrustList } from '../api/profileApi';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const SuggestedUsersScreen = () => {
  const queryClient = useQueryClient();
  const { 
    data, 
    isLoading, 
    error, 
    fetchNextPage, 
    hasNextPage,
    isFetchingNextPage 
  } = useSuggestedUsers();
  
  const addTrustMutation = useMutation({
    mutationFn: addToTrustList,
    onSuccess: () => {
      // Suggested users listesini yenile
      queryClient.invalidateQueries({ queryKey: ['profile', 'suggested'] });
    },
  });

  const handleAddTrust = (userId: string) => {
    addTrustMutation.mutate(userId);
  };

  const allUsers = data?.pages.flatMap(page => page.items) ?? [];

  return (
    <FlatList
      data={allUsers}
      renderItem={({ item }) => (
        <UserCard 
          user={item} 
          onTrust={() => handleAddTrust(item.id)}
        />
      )}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isFetchingNextPage ? <Spinner /> : null}
    />
  );
};
```

## 📈 Scalability Considerations

### Current Implementation (Small-Medium Scale)
- ✅ Works well up to ~100K users
- ✅ Simple sorting by popularity
- ✅ Random shuffling for variety

### Future Improvements (Large Scale)
- 🔄 Machine Learning based recommendations
- 🔄 Collaborative filtering (benzer kullanıcılar)
- 🔄 Redis caching for popular suggestions
- 🔄 Background job for pre-computing suggestions
- 🔄 A/B testing for algorithm improvements

## 🔄 Swagger Documentation

Swagger UI'da otomatik olarak gösterilir:
- **URL:** `http://localhost:3000/api-docs`
- **Path:** `/users/suggested`
- **Tag:** Users
- **Security:** bearerAuth

OpenAPI specification otomatik olarak router dosyasındaki JSDoc yorumlarından oluşturulur.

## 📝 Database Schema

### Kullanılan Tablolar

```prisma
model TrustRelation {
  trusterId     String
  trustedUserId String
  
  @@unique([trusterId, trustedUserId])
  @@index([trusterId])
  @@index([trustedUserId])
}

model UserBlock {
  blockerId     String
  blockedUserId String
  
  @@unique([blockerId, blockedUserId])
}

model UserMute {
  muterId     String
  mutedUserId String
  
  @@unique([muterId, mutedUserId])
}

model Profile {
  userId        String @unique
  displayName   String?
  userName      String?
  postsCount    Int
  trustCount    Int
  trusterCount  Int
}

model UserAvatar {
  userId   String
  imageUrl String
  isActive Boolean
  
  @@index([userId, isActive])
}

model UserTitle {
  userId   String
  title    String
  earnedAt DateTime
  
  @@index([userId])
}
```

## 🐛 Known Issues

Şu an için bilinen bir issue yok.

## 📅 Version History

### v1.0.0 (2026-01-10)
- ✅ Initial implementation
- ✅ Basic recommendation algorithm
- ✅ Excludes trust/block/mute lists
- ✅ Popularity-based sorting with randomization
- ✅ Full Swagger documentation

## 👥 Maintainers

- Backend Team
- Feature Owner: Product Team

## 📞 Support

Issues için GitHub'da issue açabilir veya backend ekibine Slack'ten ulaşabilirsiniz.

