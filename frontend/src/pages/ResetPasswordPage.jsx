import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { authApi } from "../lib/api";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = useParams();
  const {
    register,
    getValues,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async ({ password }) => {
    try {
      await authApi.resetPassword(token, { password });
      navigate("/login", {
        replace: true,
        state: {
          successMessage: "Password reset successful. You can now log in with your new password.",
        },
      });
    } catch (err) {
      setError("root.serverError", {
        type: "server",
        message: err.response?.data?.message || "Unable to reset password",
      });
    }
  };

  if (!token) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">Password Help</p>
          <h1>Invalid Link</h1>
          <p className="auth-subtitle">
            This password reset link is missing a token.
          </p>
          <p className="auth-switch">
            Request a new one <Link to="/forgot-password">here</Link>.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">New Password</p>
        <h1>Reset Password</h1>
        <p className="auth-subtitle">
          Choose a new password for your account. This reset link expires after
          15 minutes.
        </p>

        <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-field">
            <label htmlFor="reset-password">New Password</label>
            <input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a new password"
              {...register("password", {
                required: "Password is required",
                minLength: {
                  value: 6,
                  message: "Password must be at least 6 characters",
                },
              })}
            />
            {errors.password ? <p className="form-error">{errors.password.message}</p> : null}
          </div>

          <div className="form-field">
            <label htmlFor="reset-confirm-password">Confirm Password</label>
            <input
              id="reset-confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              {...register("confirmPassword", {
                required: "Please confirm your password",
                validate: (value) =>
                  value === getValues("password") || "Passwords do not match",
              })}
            />
            {errors.confirmPassword ? (
              <p className="form-error">{errors.confirmPassword.message}</p>
            ) : null}
          </div>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Resetting password..." : "Reset Password"}
          </button>
        </form>

        {errors.root?.serverError ? (
          <p className="auth-alert" role="alert">
            {errors.root.serverError.message}
          </p>
        ) : null}

        <p className="auth-switch">
          Need a new link? <Link to="/forgot-password">Request another reset</Link>
        </p>
      </section>
    </main>
  );
}
