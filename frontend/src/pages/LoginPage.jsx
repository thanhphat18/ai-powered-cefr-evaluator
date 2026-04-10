import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../context/useAuth";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const successMessage = location.state?.successMessage;

  const {
    register: registerField,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data) => {
    try {
      await login(data);
      navigate("/dashboard");
    } catch (err) {
      setError("root.serverError", {
        type: "server",
        message: err.response?.data?.message || "Login failed",
      });
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Secure Access</p>
        <h1>Login</h1>
        <p className="auth-subtitle">
          Step into your CEFR evaluation workspace and continue exactly where you
          left off.
        </p>

        <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...registerField("email", {
                required: "Email is required",
              })}
            />
            {errors.email ? <p className="form-error">{errors.email.message}</p> : null}
          </div>

          <div className="form-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              {...registerField("password", {
                required: "Password is required",
              })}
            />
            {errors.password ? <p className="form-error">{errors.password.message}</p> : null}
          </div>

          <p className="auth-helper">
            <Link to="/forgot-password">Forgot your password?</Link>
          </p>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Logging in..." : "Login"}
          </button>
        </form>

        {successMessage ? (
          <p className="auth-info" role="status">
            {successMessage}
          </p>
        ) : null}

        {errors.root?.serverError ? (
          <p className="auth-alert" role="alert">
            {errors.root.serverError.message}
          </p>
        ) : null}

        <p className="auth-switch">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </section>
    </main>
  );
}
