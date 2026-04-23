import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { expect, test, vi } from "vitest";
import DashboardPage from "../DashboardPage";

vi.mock("../../context/useAuth", () => ({
  useAuth: () => ({
    user: {
      role: "student",
      username: "Student One",
      email: "student@example.com",
      summary: {
        highestScore: 72,
        testsTaken: 1,
        testLibrary: [],
      },
    },
  }),
}));

function LocationDisplay() {
  const location = useLocation();

  return <p data-testid="location-display">{location.pathname}</p>;
}

test("launches the student test flow from the level picker route", async () => {
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <>
              <DashboardPage />
              <LocationDisplay />
            </>
          }
        />
        <Route
          path="/test/start"
          element={
            <>
              <p>Level picker</p>
              <LocationDisplay />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );

  await userEvent.click(screen.getByRole("button", { name: /start test/i }));

  expect(await screen.findByText("Level picker")).toBeInTheDocument();
  expect(screen.getByTestId("location-display")).toHaveTextContent("/test/start");
});
