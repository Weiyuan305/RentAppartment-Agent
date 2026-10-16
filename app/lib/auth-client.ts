"use client";
import { createAuthClient } from "better-auth/react";
import { createSessionFetch } from "./auth-session-fetch";
export const authClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: { customFetchImpl: createSessionFetch() },
});
