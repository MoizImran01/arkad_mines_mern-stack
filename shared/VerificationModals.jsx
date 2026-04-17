import React from 'react';
import { FiLock, FiX, FiAlertTriangle } from "react-icons/fi";

const PASSWORD_INPUT_STYLE = {
  width: '100%', padding: '10px', marginTop: '8px',
  border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px'
};

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
        <h3><FiLock /> Confirm Your Password</h3>
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
