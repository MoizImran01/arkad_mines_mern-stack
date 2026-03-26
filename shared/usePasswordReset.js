import { useState } from 'react';
import axios from 'axios';

const usePasswordReset = (url) => {
  const [resetStep, setResetStep] = useState(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const clearResetState = () => {
    setResetStep(null);
    setResetEmail("");
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const openForgotPassword = (setError, setSuccessMsg) => {
    clearResetState();
    setResetStep("email");
    setError("");
    setSuccessMsg("");
  };

  const backToLogin = (setError, setSuccessMsg) => {
    setResetStep(null);
    setError("");
    setSuccessMsg("");
  };

  const submitForgotPassword = async ({ setIsLoading, setError, setSuccessMsg, onNotFound, onResetSuccess }) => {
    setIsLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      if (resetStep === "email") {
        const response = await axios.post(`${url}/api/user/forgot-password`, { email: resetEmail });
        if (response.data.success) {
          setSuccessMsg("A 6-digit reset code has been sent to your email.");
          setResetStep("code");
        } else {
          setError(response.data.message);
        }
      } else if (resetStep === "code") {
        const response = await axios.post(`${url}/api/user/reset-password`, {
          email: resetEmail,
          code: resetCode,
          newPassword,
          confirmPassword,
        });
        if (response.data.success) {
          setSuccessMsg("Password reset successful! Redirecting to login...");
          const emailForLogin = resetEmail;
          const passForLogin = newPassword;
          setTimeout(() => {
            clearResetState();
            setSuccessMsg("");
            onResetSuccess(emailForLogin, passForLogin);
          }, 2000);
        } else {
          setError(response.data.message);
        }
      }
    } catch (err) {
      if (err.response?.data?.notFound) {
        onNotFound(err);
      } else {
        setError(err.response?.data?.message || "Network error. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    resetStep, setResetStep,
    resetEmail, setResetEmail,
    resetCode, setResetCode,
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    clearResetState,
    openForgotPassword,
    backToLogin,
    submitForgotPassword,
  };
};

export default usePasswordReset;
