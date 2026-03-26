import { useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const usePaymentVerification = (url, token) => {
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaPassword, setCaptchaPassword] = useState("");
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaPassword, setMfaPassword] = useState("");
  const [pendingPayment, setPendingPayment] = useState(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const recaptchaRef = useRef(null);

  const handleCaptchaChange = (t) => setCaptchaToken(t);
  const handleCaptchaExpired = () => setCaptchaToken(null);

  const resetCaptchaState = () => {
    setShowCaptchaModal(false);
    setCaptchaToken(null);
    setCaptchaPassword("");
    recaptchaRef.current?.reset();
    setPendingPayment(null);
  };

  const resetMfaState = () => {
    setShowMfaModal(false);
    setMfaPassword("");
    setPendingPayment(null);
  };

  const detectVerificationNeeded = (errData) => {
    const errMsg = errData?.message?.toLowerCase() || '';
    const requiresCaptcha = errData?.requiresCaptcha === true || errMsg.includes('captcha');
    const requiresMFA = errData?.requiresMFA === true || errData?.requiresReauth === true ||
      errMsg.includes('re-authentication') || errMsg.includes('password') || errMsg.includes('confirm this action');
    return { requiresCaptcha, requiresMFA };
  };

  const triggerVerification = (pendingData, requiresCaptcha) => {
    setPendingPayment(pendingData);
    if (requiresCaptcha) setShowCaptchaModal(true);
    else setShowMfaModal(true);
  };

  const submitWithVerification = async (extraPayload, onSuccess) => {
    if (!pendingPayment) {
      toast.error("Error: Payment data not found. Please try again.");
      resetCaptchaState();
      resetMfaState();
      return;
    }

    setPaymentSubmitting(true);
    try {
      const payload = { ...pendingPayment, ...extraPayload };
      const response = await axios.post(
        `${url}/api/orders/payment/submit/${pendingPayment.orderId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success('Payment proof submitted successfully. Awaiting admin verification.');
        onSuccess();
        return true;
      } else {
        toast.error(response.data.message || "Failed to submit payment proof");
        return false;
      }
    } catch (error) {
      console.error("Error submitting verified payment:", error);
      if (error.response?.data?.requiresCaptcha === true) {
        toast.error("CAPTCHA verification failed. Please try again.");
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
      } else if (error.response?.data?.requiresMFA === true || error.response?.status === 401) {
        toast.error("Invalid password. Please check your password and try again.");
        if (extraPayload.captchaToken) setCaptchaPassword("");
        else setMfaPassword("");
      } else {
        toast.error(error.response?.data?.message || "Error submitting payment proof");
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
      }
      return false;
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleCaptchaSubmit = async (e, onSuccess) => {
    e.preventDefault();
    if (!captchaToken) { toast.error("Please complete the CAPTCHA verification."); return; }
    if (!captchaPassword.trim()) { toast.error("Please enter your password to confirm this payment submission."); return; }

    const success = await submitWithVerification(
      { captchaToken, passwordConfirmation: captchaPassword },
      () => { resetCaptchaState(); onSuccess(); }
    );
    return success;
  };

  const handleMfaSubmit = async (e, onSuccess) => {
    e.preventDefault();
    if (!mfaPassword.trim()) { toast.error("Please enter your password to confirm this payment submission."); return; }

    const success = await submitWithVerification(
      { passwordConfirmation: mfaPassword },
      () => { resetMfaState(); onSuccess(); }
    );
    return success;
  };

  return {
    showCaptchaModal, showMfaModal,
    captchaToken, captchaPassword, setCaptchaPassword,
    mfaPassword, setMfaPassword,
    pendingPayment, paymentSubmitting, setPaymentSubmitting,
    recaptchaRef,
    handleCaptchaChange, handleCaptchaExpired,
    resetCaptchaState, resetMfaState,
    detectVerificationNeeded, triggerVerification,
    handleCaptchaSubmit, handleMfaSubmit,
  };
};

export default usePaymentVerification;
