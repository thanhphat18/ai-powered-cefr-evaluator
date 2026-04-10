import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { authApi } from "../lib/api";
import {
  ALLOWED_AVATAR_MIME_TYPES,
  DEFAULT_AVATAR_URL,
  MAX_AVATAR_FILE_SIZE_BYTES,
  MAX_AVATAR_FILE_SIZE_LABEL,
} from "../lib/avatar";

function formatCompletedAt(value) {
  if (!value) {
    return "Pending";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to read file"));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error("Unable to read file"));
    };

    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const location = useLocation();
  const { user, refreshUser } = useAuth();
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState("");
  const [avatarMessage, setAvatarMessage] = useState(
    location.state?.avatarSetupMessage || ""
  );
  const [avatarError, setAvatarError] = useState("");
  const [pendingAvatarDataUrl, setPendingAvatarDataUrl] = useState("");
  const [pendingAvatarName, setPendingAvatarName] = useState("");
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [showAvatarPrompt, setShowAvatarPrompt] = useState(
    Boolean(location.state?.promptAvatarSetup)
  );

  const {
    register: registerField,
    getValues,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const currentAvatarUrl = user?.avatarUrl || DEFAULT_AVATAR_URL;
  const avatarPreviewUrl = pendingAvatarDataUrl || currentAvatarUrl;
  const profileSummary = user?.summary ?? {};
  const testLibrary = profileSummary.testLibrary ?? [];

  const handlePasswordEditorToggle = () => {
    setIsEditingPassword((current) => !current);
    setPasswordSuccessMessage("");
    clearErrors();
    reset();
  };

  const onSubmitPassword = async ({ currentPassword, newPassword }) => {
    setPasswordSuccessMessage("");

    try {
      const response = await authApi.changePassword({
        currentPassword,
        newPassword,
      });

      setPasswordSuccessMessage(
        response.data.message || "Password updated successfully"
      );
      setIsEditingPassword(false);
      clearErrors();
      reset();
    } catch (err) {
      setError("root.serverError", {
        type: "server",
        message: err.response?.data?.message || "Unable to update password",
      });
    }
  };

  const handleAvatarFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    setAvatarMessage("");
    setAvatarError("");

    if (!file) {
      return;
    }

    if (!ALLOWED_AVATAR_MIME_TYPES.includes(file.type)) {
      setPendingAvatarDataUrl("");
      setPendingAvatarName("");
      setAvatarError("Please upload a PNG, JPG, or WEBP image.");
      return;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE_BYTES) {
      setPendingAvatarDataUrl("");
      setPendingAvatarName("");
      setAvatarError(`Avatar image must be ${MAX_AVATAR_FILE_SIZE_LABEL} or smaller.`);
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPendingAvatarDataUrl(dataUrl);
      setPendingAvatarName(file.name);
      setAvatarMessage(`Selected ${file.name}. Save it to update your avatar.`);
    } catch {
      setPendingAvatarDataUrl("");
      setPendingAvatarName("");
      setAvatarError("We could not read that image. Please choose another file.");
    }
  };

  const handleSaveAvatar = async () => {
    if (!pendingAvatarDataUrl) {
      setAvatarMessage("");
      setAvatarError("Please choose an image before saving your avatar.");
      return;
    }

    setIsSavingAvatar(true);
    setAvatarMessage("");
    setAvatarError("");

    try {
      const response = await authApi.updateAvatar({
        avatarDataUrl: pendingAvatarDataUrl,
      });

      await refreshUser();
      setPendingAvatarDataUrl("");
      setPendingAvatarName("");
      setAvatarMessage(response.data.message || "Avatar updated successfully");
      setShowAvatarPrompt(false);
    } catch (err) {
      setAvatarError(err.response?.data?.message || "Unable to update avatar");
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleUseDefaultAvatar = async () => {
    setIsSavingAvatar(true);
    setAvatarMessage("");
    setAvatarError("");

    try {
      const response = await authApi.updateAvatar({
        useDefault: true,
      });

      await refreshUser();
      setPendingAvatarDataUrl("");
      setPendingAvatarName("");
      setAvatarMessage(response.data.message || "Default avatar selected");
      setShowAvatarPrompt(false);
    } catch (err) {
      setAvatarError(
        err.response?.data?.message || "Unable to switch back to the default avatar"
      );
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleSkipAvatarSetup = () => {
    setPendingAvatarDataUrl("");
    setPendingAvatarName("");
    setAvatarError("");
    setAvatarMessage(
      "Using the default avatar for now. You can upload a custom one later on this page."
    );
    setShowAvatarPrompt(false);
  };

  return (
    <main className="profile-page">
      <section className="profile-grid">
        <article className="profile-card">
          <p className="eyebrow">Private Space</p>
          <h1>Profile</h1>
          <p className="profile-subtitle">
            This page keeps the personal account information for the logged-in user
            and leaves room for their future test performance history.
          </p>

          {showAvatarPrompt ? (
            <p className="auth-info" role="status">
              Upload an avatar now, or skip and keep the default image until you are
              ready.
            </p>
          ) : null}

          <div className="profile-avatar-section">
            <div className="profile-avatar-shell">
              <img
                className="profile-avatar-image"
                src={avatarPreviewUrl}
                alt={`${user?.username || "User"} avatar`}
              />
            </div>

            <div className="profile-avatar-details">
              <h2>Profile Avatar</h2>
              <p className="profile-note">
                Upload a PNG, JPG, or WEBP image from your computer. Maximum file size:
                {" "}
                {MAX_AVATAR_FILE_SIZE_LABEL}.
              </p>

              <div className="form-field profile-file-field">
                <label htmlFor="profile-avatar-upload">Choose Local Image</label>
                <input
                  id="profile-avatar-upload"
                  type="file"
                  accept={ALLOWED_AVATAR_MIME_TYPES.join(",")}
                  onChange={handleAvatarFileChange}
                />
              </div>

              {pendingAvatarName ? (
                <p className="profile-selected-file">Selected file: {pendingAvatarName}</p>
              ) : null}

              <div className="profile-avatar-actions">
                <button
                  type="button"
                  onClick={handleSaveAvatar}
                  disabled={isSavingAvatar || !pendingAvatarDataUrl}
                >
                  {isSavingAvatar ? "Saving avatar..." : "Save avatar"}
                </button>
                <button
                  type="button"
                  className="profile-secondary-button"
                  onClick={handleUseDefaultAvatar}
                  disabled={isSavingAvatar}
                >
                  Use default avatar
                </button>
                {showAvatarPrompt ? (
                  <button
                    type="button"
                    className="profile-secondary-button"
                    onClick={handleSkipAvatarSetup}
                    disabled={isSavingAvatar}
                  >
                    Skip for now
                  </button>
                ) : null}
              </div>

              {avatarMessage ? (
                <p className="auth-info" role="status">
                  {avatarMessage}
                </p>
              ) : null}

              {avatarError ? (
                <p className="auth-alert" role="alert">
                  {avatarError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="profile-info-list">
            <div className="profile-info-row">
              <span className="profile-label">Name</span>
              <strong>{user?.username || "Unknown user"}</strong>
            </div>
            <div className="profile-info-row">
              <span className="profile-label">Email</span>
              <strong>{user?.email || "No email available"}</strong>
            </div>
            <div className="profile-info-row profile-password-row">
              <div>
                <span className="profile-label">Password</span>
                <strong aria-label="Password is hidden">••••••••••</strong>
              </div>
              <button
                type="button"
                className="profile-secondary-button"
                onClick={handlePasswordEditorToggle}
              >
                {isEditingPassword ? "Cancel" : "Edit password"}
              </button>
            </div>
          </div>

          {isEditingPassword ? (
            <form
              className="auth-form profile-password-form"
              onSubmit={handleSubmit(onSubmitPassword)}
            >
              <div className="form-field">
                <label htmlFor="current-password">Current Password</label>
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your current password"
                  {...registerField("currentPassword", {
                    required: "Current password is required",
                  })}
                />
                {errors.currentPassword ? (
                  <p className="form-error">{errors.currentPassword.message}</p>
                ) : null}
              </div>

              <div className="form-field">
                <label htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Choose a new password"
                  {...registerField("newPassword", {
                    required: "New password is required",
                    minLength: {
                      value: 6,
                      message: "New password must be at least 6 characters",
                    },
                    validate: (value) =>
                      value !== getValues("currentPassword") ||
                      "New password must be different from the current password",
                  })}
                />
                {errors.newPassword ? (
                  <p className="form-error">{errors.newPassword.message}</p>
                ) : null}
              </div>

              <div className="form-field">
                <label htmlFor="confirm-new-password">Confirm New Password</label>
                <input
                  id="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
                  {...registerField("confirmNewPassword", {
                    required: "Please confirm your new password",
                    validate: (value) =>
                      value === getValues("newPassword") || "Passwords do not match",
                  })}
                />
                {errors.confirmNewPassword ? (
                  <p className="form-error">{errors.confirmNewPassword.message}</p>
                ) : null}
              </div>

              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating password..." : "Save new password"}
              </button>
            </form>
          ) : null}

          {passwordSuccessMessage ? (
            <p className="auth-info" role="status">
              {passwordSuccessMessage}
            </p>
          ) : null}

          {errors.root?.serverError ? (
            <p className="auth-alert" role="alert">
              {errors.root.serverError.message}
            </p>
          ) : null}
        </article>

        <article className="profile-card profile-summary-card">
          <p className="eyebrow">Performance Summary</p>
          <div className="profile-stat-grid">
            <div className="profile-stat">
              <span className="profile-stat-value">{profileSummary.highestScore ?? 0}</span>
              <span className="profile-stat-label">Highest score</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">{profileSummary.testsTaken ?? 0}</span>
              <span className="profile-stat-label">Tests taken</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">{testLibrary.length}</span>
              <span className="profile-stat-label">Stored summaries</span>
            </div>
          </div>

          <p className="profile-note">
            These values are ready for the test module later, so each completed test can
            update the user profile and leave a saved summary in the private library.
          </p>
        </article>
      </section>

      <section className="profile-card profile-library-card">
        <p className="eyebrow">Test Library</p>
        {testLibrary.length ? (
          <div className="profile-library-list">
            {testLibrary.map((entry) => (
              <article className="profile-library-item" key={entry.id}>
                <div className="profile-library-head">
                  <h2>{entry.title}</h2>
                  <span className="profile-library-score">Score: {entry.score ?? 0}</span>
                </div>
                <p className="profile-library-summary">
                  {entry.summary || "A generated summary for this test will appear here."}
                </p>
                <p className="profile-library-date">
                  Completed: {formatCompletedAt(entry.completedAt)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="profile-empty-state">
            <h2>No test summaries stored yet</h2>
            <p>
              After a user completes a test, this area can work like a private library
              that keeps their result summary, score, and completion date.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
