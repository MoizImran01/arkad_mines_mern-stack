import React from 'react';

export const StatusMessages = ({ error, successMsg }) => (
  <>
    {error && (
      <div className="error-message">
        <span className="error-icon">⚠</span>
        {error}
      </div>
    )}
    {successMsg && (
      <div className="success-message">
        <span className="success-icon">&#10003;</span>
        {successMsg}
      </div>
    )}
  </>
);

const ResetFormFields = ({
  resetStep, isLoading,
  resetEmail, setResetEmail,
  resetCode, setResetCode,
  newPassword, setNewPassword,
  confirmPassword, setConfirmPassword,
  clearError,
  emailLabel = "Email Address",
  emailPlaceholder = "your@email.com",
}) => (
  <div className="form-inputs">
    {resetStep === "email" && (
      <div className="input-group">
        <label htmlFor="reset-email">{emailLabel}</label>
        <input
          id="reset-email"
          type="email"
          placeholder={emailPlaceholder}
          value={resetEmail}
          onChange={(e) => { setResetEmail(e.target.value); clearError(); }}
          required
          disabled={isLoading}
        />
      </div>
    )}
    {resetStep === "code" && (
      <>
        <div className="input-group">
          <label htmlFor="reset-code">6-Digit Code</label>
          <input
            id="reset-code"
            type="text"
            placeholder="Enter the code from your email"
            value={resetCode}
            onChange={(e) => { setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6)); clearError(); }}
            required
            disabled={isLoading}
            maxLength={6}
            pattern="\d{6}"
            inputMode="numeric"
          />
        </div>
        <div className="input-group">
          <label htmlFor="new-password">New Password</label>
          <input
            id="new-password"
            type="password"
            placeholder="Min. 8 characters"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); clearError(); }}
            required
            disabled={isLoading}
            minLength={8}
          />
        </div>
        <div className="input-group">
          <label htmlFor="confirm-password">Confirm Password</label>
          <input
            id="confirm-password"
            type="password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); clearError(); }}
            required
            disabled={isLoading}
            minLength={8}
          />
        </div>
      </>
    )}
  </div>
);

export default ResetFormFields;
