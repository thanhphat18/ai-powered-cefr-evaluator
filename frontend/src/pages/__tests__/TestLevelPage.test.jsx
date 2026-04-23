import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import TestLevelPage from "../TestLevelPage";
import { testsApi } from "../../lib/api";

vi.mock("../../lib/api", () => ({
  testsApi: {
    getSession: vi.fn(),
    createSession: vi.fn(),
  },
}));

test("creates a C1 session when the student clicks a level card", async () => {
  testsApi.getSession.mockResolvedValue({ data: { session: null } });
  testsApi.createSession.mockResolvedValue({
    data: { session: { selectedLevel: "C1" } },
  });

  render(
    <MemoryRouter>
      <TestLevelPage />
    </MemoryRouter>
  );

  await userEvent.click(await screen.findByRole("button", { name: /choose c1/i }));
  expect(testsApi.createSession).toHaveBeenCalledWith({ level: "C1" });
});
