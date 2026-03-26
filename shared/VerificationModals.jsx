import React from 'react';
import ReCAPTCHA from "react-google-recaptcha";
import { FiLock, FiX, FiAlertTriangle } from "react-icons/fi";

const RECAPTCHA_SITE_KEY = "6LfIkB0sAAAAANTjmfzZnffj2xE1POMF-Tnl3jYC";

const PASSWORD_INPUT_STYLE = {
  width: '100%', padding: '10px', marginTop: '8px',
  border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px'
};

export const CaptchaModal = ({
  onSubmit, onClose, isSubmitting,
  captchaPassword, setCaptchaPassword,
  recaptchaRef, onCaptchaChange, onCaptchaExpired, captchaToken,
  securityMessage, submitLabel = "Confirm & Submit Payment",
  WrapperTag = "div", wrapperProps = {},
}) => (
  <WrapperTag
    className="modal-overlay"
    style={WrapperTag === "div" ? { zIndex: 10000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)' } : undefined}
    role="dialog" aria-modal="true"
    {...wrapperProps}
  >
    {wrapperProps.backdrop}
    <div className="modal-content" role="document" {...(wrapperProps.contentProps || {})}>
      <div className="modal-header">
        <h3><FiLock style={{ marginRight: '8px', verticalAlign: 'middle' }} /> CAPTCHA Verification Required</h3>
        {!isSubmitting && <button onClick={onClose}><FiX /></button>}
      </div>
      <div className="modal-body" {...(wrapperProps.bodyProps || {})}>
        <p style={{ color: '#e74c3c', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiAlertTriangle size={22} style={{ flexShrink: 0 }} />
          {securityMessage || "For security purposes, please complete the CAPTCHA verification and enter your password to submit this payment."}
        </p>
        <form onSubmit={onSubmit}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <span style={{ marginBottom: '10px', display: 'block' }}>CAPTCHA Verification:</span>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
              <ReCAPTCHA ref={recaptchaRef} sitekey={RECAPTCHA_SITE_KEY} onChange={onCaptchaChange} onExpired={onCaptchaExpired} theme="light" />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label htmlFor="captcha-password">Enter Your Password:</label>
            <input id="captcha-password" type="password" value={captchaPassword} onChange={(e) => setCaptchaPassword(e.target.value)} placeholder="Enter your password" autoFocus required style={PASSWORD_INPUT_STYLE} />
          </div>
          <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            {!isSubmitting && <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>}
            <button type="submit" className="btn-primary" disabled={isSubmitting || !captchaToken || !captchaPassword.trim()} style={{ backgroundColor: '#2f5242' }}>
              {isSubmitting ? "Submitting..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  </WrapperTag>
);

export const MfaModal = ({
  onSubmit, onClose, isSubmitting,
  mfaPassword, setMfaPassword,
  securityMessage, submitLabel = "Confirm & Submit Payment",
  WrapperTag = "div", wrapperProps = {},
}) => (
  <WrapperTag className="modal-overlay" role="dialog" aria-modal="true" {...wrapperProps}>
    {wrapperProps.backdrop}
    <div className="modal-content" role="document" {...(wrapperProps.contentProps || {})}>
      <div className="modal-header">
        <h3><FiLock /> Multi-Factor Authentication Required</h3>
        {!isSubmitting && <button onClick={onClose} aria-label="Close modal"><FiX /></button>}
      </div>
      <div className="modal-body" {...(wrapperProps.bodyProps || {})}>
        <p style={{ color: '#e74c3c', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiAlertTriangle size={22} style={{ flexShrink: 0 }} />
          {securityMessage || "For security purposes, please confirm your password to submit this payment."}
        </p>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="mfa-password">Enter Your Password:</label>
            <input id="mfa-password" type="password" value={mfaPassword} onChange={(e) => setMfaPassword(e.target.value)} placeholder="Enter your password" autoFocus required style={PASSWORD_INPUT_STYLE} />
          </div>
          <div className="modal-footer">
            {!isSubmitting && <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>}
            <button type="submit" className="btn-primary" disabled={isSubmitting || !mfaPassword.trim()}>
              {isSubmitting ? "Submitting..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  </WrapperTag>
);
