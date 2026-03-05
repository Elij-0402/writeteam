import { expect, test } from "@playwright/test"

test("@smoke ai route rejects unauthenticated request", async ({ request }) => {
  const response = await request.post("/api/ai/write", {
    data: {
      intent: "write",
      projectId: "demo-project",
      context: "test",
    },
  })

  expect(response.status()).toBe(401)
})
