# Survey API — Endpoint Update (2026-03-16)

> Survey submit flow changed from multi-step to single-request. This document covers the changes for app integration.

---

## Summary

| # | Method | Endpoint | Description | Status |
|---|--------|----------|-------------|--------|
| EP-01 | `GET` | `/api/surveys/{surveyId}/questions` | Get survey questions & options | Unchanged |
| EP-02 | `POST` | `/api/surveys/{surveyId}/submit` | Submit all answers & complete survey | **New** |
| ~~EP-03~~ | ~~`POST`~~ | ~~`/api/surveys/{surveyId}/questions/{questionId}/answer`~~ | ~~Submit individual answer~~ | **Removed** |
| ~~EP-04~~ | ~~`POST`~~ | ~~`/api/surveys/{surveyId}/complete`~~ | ~~Complete survey & earn points~~ | **Removed** |

All endpoints require `Bearer Token`.

---

## What Changed

### Before (old flow)
1. User answers each question → `POST /surveys/{surveyId}/questions/{questionId}/answer` (per question)
2. After all questions answered → `POST /surveys/{surveyId}/complete` (separate call)
3. Two separate API calls minimum, more if multiple questions

### After (new flow)
1. User answers all questions locally (no API calls during answering)
2. On final submit → `POST /surveys/{surveyId}/submit` (single call with all answers)
3. Points awarded and badges checked in the same response

---

## EP-01: Get Survey Questions (Unchanged)

```
GET /api/surveys/{surveyId}/questions
```

Returns all questions for a survey with the user's answer status.

### Response

```json
{
  "surveyId": "uuid",
  "questions": [
    {
      "id": "question-uuid",
      "text": "How satisfied are you with our product?",
      "type": "SINGLE_CHOICE",
      "options": [
        { "id": "opt-1", "text": "Very Satisfied" },
        { "id": "opt-2", "text": "Satisfied" },
        { "id": "opt-3", "text": "Neutral" },
        { "id": "opt-4", "text": "Dissatisfied" }
      ],
      "order": 1,
      "isAnswered": false
    },
    {
      "id": "question-uuid-2",
      "text": "Any additional feedback?",
      "type": "TEXT",
      "options": [],
      "order": 2,
      "isAnswered": false
    }
  ],
  "totalQuestions": 2
}
```

### Question Types
| Type | Description | `answerId` value |
|------|-------------|-----------------|
| `SINGLE_CHOICE` | Pick one option | Selected option's `id` |
| `MULTIPLE_CHOICE` | Pick multiple options | Selected option's `id` (one entry per selection) |
| `TEXT` | Free text input | The text string itself |

---

## EP-02: Submit Survey (New)

```
POST /api/surveys/{surveyId}/submit
```

Submits all answers at once, completes the survey, awards points, and checks badge eligibility. **This replaces both the old answer and complete endpoints.**

### Request Body

```json
{
  "answers": [
    { "questionId": "question-uuid-1", "answerId": "opt-2" },
    { "questionId": "question-uuid-2", "answerId": "Great product, love it!" }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `answers` | `Array` | Yes | Array of answer objects |
| `answers[].questionId` | `string (uuid)` | Yes | Question ID |
| `answers[].answerId` | `string` | Yes | Option ID (for choice questions) or text (for text questions) |

### Success Response (200)

```json
{
  "success": true,
  "message": "Survey completed successfully!",
  "awardedPoints": 10,
  "newTotalPoints": 30,
  "badgesEarned": [
    {
      "id": "badge-uuid",
      "name": "Survey Explorer (Bronze)",
      "description": "Completed your first surveys",
      "image": "https://cdn.example.com/badges/survey-explorer.png",
      "rarity": "COMMON"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Whether the submission was successful |
| `message` | `string` | Status message |
| `awardedPoints` | `number` | Points awarded for this survey (always 10) |
| `newTotalPoints` | `number` | User's new total survey points |
| `badgesEarned` | `Array` | Badges earned from this completion (can be empty) |

### Error Responses (200 with `success: false`)

```json
// Survey not active
{
  "success": false,
  "message": "This survey is not currently active."
}

// Already completed
{
  "success": false,
  "message": "You have already completed this survey."
}

// Missing answers
{
  "success": false,
  "message": "Please answer all questions. (1/3)"
}
```

### Validation Errors (400)

```json
// Missing answers array
{
  "success": false,
  "message": "answers array is required"
}

// Invalid answer format
{
  "success": false,
  "message": "Each answer must have questionId and answerId"
}
```

---

## App Integration Guide

### Hook Change

```typescript
// OLD
const useSubmitSurveyAnswer = () => { ... }  // per-question
const useCompleteSurvey = () => { ... }       // separate complete

// NEW
const useSubmitSurvey = () => {
  return useMutation({
    mutationFn: (data: { surveyId: string; answers: Answer[] }) =>
      api.post(`/surveys/${data.surveyId}/submit`, { answers: data.answers }),
  });
};
```

### Recommended Flow

```
1. Fetch questions     → GET /surveys/{surveyId}/questions
2. User answers locally → store in state: Map<questionId, answerId>
3. Final submit button  → POST /surveys/{surveyId}/submit { answers: [...] }
4. Show result screen   → awardedPoints, badgesEarned from response
```

### Key Points
- **No API calls while answering** — all answers accumulate in local state
- **Single submit at the end** — one request saves everything atomically
- **Transaction safety** — all answers + completion saved in a DB transaction (all or nothing)
- **Idempotent answers** — if user already answered some questions before, they get upserted

---

## Badge Thresholds

| Badge | Points Required |
|-------|----------------|
| Survey Explorer (Bronze) | 10 pts |
| Survey Master (Silver) | 25 pts |
| Survey Legend (Gold) | 50 pts |

Each survey awards **10 points** on completion.
