import { useState } from "react";
import { authApi } from "./lib/api";

export default function App() {
  const [message, setMessage] = useState("No request yet");

  const checkMe = async () => {
    try {
      const response = await authApi.me();
      setMessage(`Logged in as ${response.data.user.email}`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Request failed");
    }
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Frontend Session Test</h1>
      <p>This page tests whether the frontend can reach the backend.</p>
      <button onClick={checkMe}>Check Current User</button>
      <p>{message}</p>
    </main>
  );
}
