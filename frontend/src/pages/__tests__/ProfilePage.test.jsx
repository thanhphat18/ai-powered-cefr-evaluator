import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import ProfilePage from "../ProfilePage";

vi.mock("../../context/useAuth", () => ({
  useAuth: () => ({
    user: {
      role: "student",
      username: "Student One",
      email: "student@example.com",
      summary: {
        highestScore: 84,
        testsTaken: 2,
        testLibrary: [
          {
            id: "test-1",
            title: "C1 Vocabulary Test",
            selectedLevel: "C1",
            score: 84,
            summary: "Strong collocation control with weaker wordform accuracy.",
            completedAt: "2026-04-24T03:00:00.000Z",
            breakdown: {
              types: [
                { type: "Meaning", correct: 9, total: 10 },
                { type: "Collocation", correct: 10, total: 10 },
                { type: "Wordform", correct: 6, total: 10 },
              ],
            },
            recommendation: {
              title: "Wordform control",
              summary: "Review affixes and derivation patterns next.",
              resources: {
                techniques: ["Build short affix drills", "Compare noun and adjective forms"],
              },
            },
          },
        ],
      },
    },
    refreshUser: vi.fn(),
  }),
}));

test("shows the saved test level and category breakdown in the student library", () => {
  render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  );

  expect(screen.getByText(/level: c1/i)).toBeInTheDocument();
  expect(screen.getByText(/meaning 9\/10/i)).toBeInTheDocument();
  expect(screen.getByText(/collocation 10\/10/i)).toBeInTheDocument();
  expect(screen.getByText(/wordform 6\/10/i)).toBeInTheDocument();
});
