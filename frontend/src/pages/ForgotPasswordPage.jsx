import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { authApi } from "../lib/api";

export default function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    defaultValues: {
      email: "",
    },
  });

  const [statusMessage, setStatusMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");

  const onSubmit = async ({ email }) => {
    try {
      const response = await authApi.forgotPassword({ email });
      setStatusMessage(response.data.message);
      setResetUrl(response.data.resetUrl || "");
      reset();
    } catch (err) {
      setError("root.serverError", {
        type: "server",
        message: err.response?.data?.message || "Unable to process password reset",
      });
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Password Help</p>
        <h1>Forgot Password</h1>
        <p className="auth-subtitle">
          Enter your account email and we will prepare a secure reset link for
          you.
        </p>

        <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-field">
            <label htmlFor="forgot-password-email">Email</label>
            <input
              id="forgot-password-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register("email", {
                required: "Email is required",
              })}
            />
            {errors.email ? <p className="form-error">{errors.email.message}</p> : null}
          </div>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Preparing reset link..." : "Send Reset Link"}
          </button>
        </form>

        {statusMessage ? (
          <div className="auth-info" role="status">
            <p>{statusMessage}</p>
            {resetUrl ? (
              <p>
                Email delivery is not configured yet, so this local preview link
                can be used to continue:
                {" "}
                <a href={resetUrl}>{resetUrl}</a>
              </p>
            ) : null}
          </div>
        ) : null}

        {errors.root?.serverError ? (
          <p className="auth-alert" role="alert">
            {errors.root.serverError.message}
          </p>
        ) : null}

        <p className="auth-switch">
          Remembered it? <Link to="/login">Back to Login</Link>
        </p>
      </section>
    </main>
  );
}
