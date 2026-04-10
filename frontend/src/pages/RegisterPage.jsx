import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const {
    register: registerField,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data) => {
    try {
      await register(data);
      navigate("/dashboard");
    } catch (err) {
      setError("root.serverError", {
        type: "server",
        message: err.response?.data?.message || "Registration failed",
      });
    }
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Register</h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <input
            type="text"
            placeholder="Username"
            {...registerField("username", {
              required: "Username is required",
              minLength: {
                value: 3,
                message: "Username must be at least 3 characters",
              },
            })}
          />
          {errors.username ? <p>{errors.username.message}</p> : null}
        </div>

        <div>
          <input
            type="email"
            placeholder="Email"
            {...registerField("email", {
              required: "Email is required",
            })}
          />
          {errors.email ? <p>{errors.email.message}</p> : null}
        </div>

        <div>
          <input
            type="password"
            placeholder="Password"
            {...registerField("password", {
              required: "Password is required",
              minLength: {
                value: 6,
                message: "Password must be at least 6 characters",
              },
            })}
          />
          {errors.password ? <p>{errors.password.message}</p> : null}
        </div>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Register"}
        </button>
      </form>

      {errors.root?.serverError ? <p>{errors.root.serverError.message}</p> : null}

      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </main>
  );
}
