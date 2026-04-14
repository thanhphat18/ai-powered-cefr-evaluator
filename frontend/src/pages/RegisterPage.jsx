import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../context/useAuth";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const {
    register: registerField,
    getValues,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      trainingDataConsent: false,
    },
  });

  const onSubmit = async (data) => {
    const { username, email, password, trainingDataConsent } = data;

    try {
      const response = await register({
        username,
        email,
        password,
        trainingDataConsent,
      });

      if (response.data.user?.role === "admin") {
        navigate("/dashboard", {
          replace: true,
        });
        return;
      }

      navigate("/profile", {
        replace: true,
        state: {
          promptAvatarSetup: true,
          avatarSetupMessage:
            "Registration successful. Upload an avatar now, or skip and use the default image.",
        },
      });
    } catch (err) {
      setError("root.serverError", {
        type: "server",
        message: err.response?.data?.message || "Registration failed",
      });
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">New Journey</p>
        <h1>Register</h1>
        <p className="auth-subtitle">
          Create your account and launch into a calmer, sharper CEFR practice
          flow.
        </p>

        <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-field">
            <label htmlFor="register-username">Username</label>
            <input
              id="register-username"
              type="text"
              autoComplete="username"
              placeholder="Choose a username"
              {...registerField("username", {
                required: "Username is required",
                minLength: {
                  value: 3,
                  message: "Username must be at least 3 characters",
                },
              })}
            />
            {errors.username ? <p className="form-error">{errors.username.message}</p> : null}
          </div>

          <div className="form-field">
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
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
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a strong password"
              {...registerField("password", {
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
            <label htmlFor="register-confirm-password">Confirm Password</label>
            <input
              id="register-confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              {...registerField("confirmPassword", {
                required: "Please confirm your password",
                validate: (value) =>
                  value === getValues("password") || "Passwords do not match",
              })}
            />
            {errors.confirmPassword ? (
              <p className="form-error">{errors.confirmPassword.message}</p>
            ) : null}
          </div>

          <label className="admin-checkbox" htmlFor="register-training-consent">
            <input
              id="register-training-consent"
              type="checkbox"
              {...registerField("trainingDataConsent")}
            />
            Share anonymized test results to improve future recommendation models.
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Register"}
          </button>
        </form>

        {errors.root?.serverError ? (
          <p className="auth-alert" role="alert">
            {errors.root.serverError.message}
          </p>
        ) : null}

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}
