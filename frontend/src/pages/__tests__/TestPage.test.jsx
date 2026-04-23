import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import TestPage from "../TestPage";
import { testsApi } from "../../lib/api";

vi.mock("../../lib/api", () => ({
  testsApi: {
    getSession: vi.fn(),
    submitSession: vi.fn(),
  },
}));

vi.mock("../../context/useAuth", () => ({
  useAuth: () => ({
    user: { role: "student" },
    refreshUser: vi.fn(),
  }),
}));

test("redirects students to the level picker when no active session exists", async () => {
  testsApi.getSession.mockResolvedValue({ data: { session: null } });

  render(
    <MemoryRouter initialEntries={["/test"]}>
      <TestPage />
    </MemoryRouter>
  );

  expect(await screen.findByText(/redirecting to start test/i)).toBeInTheDocument();
});
