import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const usePaymentVerification = (url, token) => {
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaPassword, setMfaPassword] = useState("");
  const [pendingPayment, setPendingPayment] = useState(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const resetMfaState = () => {
    setShowMfaModal(false);
    setMfaPassword("");
    setPendingPayment(null);
  };

  const detectVerificationNeeded = (errData) => {
    const errMsg = errData?.message?.toLowerCase() || '';
    const requiresMFA = errData?.requiresMFA === true || errData?.requiresReauth === true ||
      errMsg.includes('re-authentication') || errMsg.includes('password') || errMsg.includes('confirm this action');
    return { requiresMFA };
  };

  const triggerVerification = (pendingData) => {
    setPendingPayment(pendingData);
    setShowMfaModal(true);
  };

  const submitWithVerification = async (extraPayload, onSuccess) => {
    if (!pendingPayment) {
      toast.error("Error: Payment data not found. Please try again.");
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
      if (error.response?.data?.requiresMFA === true || error.response?.status === 401) {
        toast.error("Invalid password. Please check your password and try again.");
        setMfaPassword("");
      } else {
        toast.error(error.response?.data?.message || "Error submitting payment proof");
      }
      return false;
    } finally {
      setPaymentSubmitting(false);
    }
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
    showMfaModal,
    mfaPassword, setMfaPassword,
    pendingPayment, paymentSubmitting, setPaymentSubmitting,
    resetMfaState,
    detectVerificationNeeded, triggerVerification,
    handleMfaSubmit,
  };
};

export default usePaymentVerification;
