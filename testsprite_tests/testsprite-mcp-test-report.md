# TestSprite AI Testing Report (MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** tipbox-backend
- **Date:** 2025-11-26
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

### Requirement R1 – Login must authenticate valid users and reject invalid ones

#### Test TC001 – auth login with valid credentials
- **Test Code:** [TC001_auth_login_with_valid_credentials.py](./tmp/TC001_auth_login_with_valid_credentials.py)
- **Status:** ✅ Passed
- **Test Visualization:** https://www.testsprite.com/dashboard/mcp/tests/f79bc5cc-901e-465d-8688-e09c48961114/5ac72588-a113-4d29-a4d7-b64d16b27a44
- **Findings:** Seeded credentials successfully returned 200 + JWT, confirming login happy-path is restored.

#### Test TC002 – auth login with invalid credentials
- **Test Code:** [TC002_auth_login_with_invalid_credentials.py](./tmp/TC002_auth_login_with_invalid_credentials.py)
- **Status:** ✅ Passed
- **Test Visualization:** https://www.testsprite.com/dashboard/mcp/tests/f79bc5cc-901e-465d-8688-e09c48961114/efdbbe53-38e3-4026-b827-20e0b4db1323
- **Findings:** Endpoint correctly rejected bogus credentials with 401.

---

### Requirement R2 – Posts API must allow authenticated users to create and persist posts (including media) while enforcing validation

#### Test TC005 – posts free post creation with valid data and authentication
- **Test Code:** [TC005_posts_free_post_creation_with_valid_data_and_authentication.py](./tmp/TC005_posts_free_post_creation_with_valid_data_and_authentication.py)
- **Status:** ❌ Failed
- **Test Visualization:** https://www.testsprite.com/dashboard/mcp/tests/f79bc5cc-901e-465d-8688-e09c48961114/1550aee5-b5ce-4c70-89c6-afd92deed859
- **Findings:** `/posts/free` returned 500; logs show Prisma `content_posts_user_id_fkey` violation → API cannot resolve authenticated user in DB, so creation aborts.

#### Test TC006 – posts free post creation without authentication
- **Test Code:** [TC006_posts_free_post_creation_without_authentication.py](./tmp/TC006_posts_free_post_creation_without_authentication.py)
- **Status:** ✅ Passed
- **Test Visualization:** https://www.testsprite.com/dashboard/mcp/tests/f79bc5cc-901e-465d-8688-e09c48961114/13a0ff2d-db57-4fea-9acc-92fb419daee6
- **Findings:** Endpoint correctly returned 401 when token is missing.

#### Test TC007 – posts free post creation with invalid data
- **Test Code:** [TC007_posts_free_post_creation_with_invalid_data.py](./tmp/TC007_posts_free_post_creation_with_invalid_data.py)
- **Status:** ❌ Failed
- **Test Visualization:** https://www.testsprite.com/dashboard/mcp/tests/f79bc5cc-901e-465d-8688-e09c48961114/27e9443a-7ce6-4599-88da-3e9364d4793a
- **Findings:** Expected 400 for malformed payload, but API responded 500—suggests validation or context lookup exceptions aren’t caught.

#### Test TC010 – posts image upload persists to MinIO
- **Test Code:** [TC010_posts_image_upload_persists_to_MinIO.py](./tmp/TC010_posts_image_upload_persists_to_MinIO.py)
- **Status:** ❌ Failed
- **Test Visualization:** https://www.testsprite.com/dashboard/mcp/tests/f79bc5cc-901e-465d-8688-e09c48961114/ef71a30a-dccc-438a-95c7-71f2413cb355
- **Findings:** Could not reach MinIO because upstream post creation failed (500). Need stable post creation before storage validation.

#### Test TC011 – posts database persistence check
- **Test Code:** [TC011_posts_database_persistence_check.py](./tmp/TC011_posts_database_persistence_check.py)
- **Status:** ❌ Failed
- **Test Visualization:** https://www.testsprite.com/dashboard/mcp/tests/f79bc5cc-901e-465d-8688-e09c48961114/99f5782a-b420-4af0-9669-7636c7f9560e
- **Findings:** POST never succeeded, so persistence/readback couldn’t be validated.

---

### Requirement R3 – Boost options must be retrievable with valid credentials and blocked otherwise

#### Test TC008 – posts get boost options with authentication
- **Test Code:** [TC008_posts_get_boost_options_with_authentication.py](./tmp/TC008_posts_get_boost_options_with_authentication.py)
- **Status:** ❌ Failed
- **Test Visualization:** https://www.testsprite.com/dashboard/mcp/tests/f79bc5cc-901e-465d-8688-e09c48961114/7b4d8688-0262-4fee-8a4f-f908dec40246
- **Findings:** API returned items missing the `name` field. Either seed data lacks names or serialization omits them.

#### Test TC009 – posts get boost options without authentication
- **Test Code:** [TC009_posts_get_boost_options_without_authentication.py](./tmp/TC009_posts_get_boost_options_without_authentication.py)
- **Status:** ✅ Passed
- **Test Visualization:** https://www.testsprite.com/dashboard/mcp/tests/f79bc5cc-901e-465d-8688-e09c48961114/a6c9aeab-6448-4106-9857-02932b0d290a
- **Findings:** Endpoint properly enforced 401 when unauthenticated.

---

## 3️⃣ Coverage & Matching Metrics

- **Overall Pass Rate:** **44.44 %** (4 / 9 tests)

| Requirement | Total Tests | ✅ Passed | ❌ Failed |
|-------------|-------------|----------|-----------|
| R1 – Login  | 2           | 2        | 0         |
| R2 – Posts creation & media | 5     | 1        | 4         |
| R3 – Boost options auth | 2       | 1        | 1         |

---

## 4️⃣ Key Gaps / Risks

1. **Posts API unusable:** `/posts/free` consistently returns 500 due to user FK violations. Need to ensure the JWT subject exists in DB (seed after cleanups or stop clearing the user before TestSprite runs).
2. **Validation not graceful:** Invalid payloads also yield 500 (TC007), masking client errors. Tighten DTO validation and handle bad context types before Prisma calls.
3. **Boost option metadata incomplete:** at least one entry lacks `name`, breaking consumers (TC008). Revisit `postService.getBoostOptions()` and seed fixtures.
4. **MinIO flow blocked upstream:** Until post creation succeeds, storage verification (TC010) can’t run. Consider providing a dedicated media upload endpoint that doesn’t depend on a previously created post for testing.

---

