import { logAudit, getClientIp, normalizeRole, getUserAgent, logError } from "../logger/auditLogger.js";

/**
 * Payment Processing Queue Middleware
 * Queues image processing operations to prevent resource exhaustion
 * Limits concurrent payment processing requests
 */

// Track active payment processing requests
const activePaymentProcessing = new Map();

// Configuration
const MAX_CONCURRENT_PAYMENT_PROCESSING = 3; // Max concurrent payment processing operations
const PROCESSING_TIMEOUT_MS = 30000; // 30 seconds timeout for payment processing

/**
 * Payment Processing Queue Middleware
 * Limits concurrent payment processing to prevent resource exhaustion
 */
export const queuePaymentProcessing = async (req, res, next) => {
  const endpoint = '/api/orders/payment/submit/:orderId';
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const userId = req.user?.id;
  const orderId = req.params.orderId;
  
  try {
    // Get or initialize active processing counter
    if (!activePaymentProcessing.has(endpoint)) {
      activePaymentProcessing.set(endpoint, {
        count: 0,
        queue: [],
        lastReset: Date.now()
      });
    }

    const queueState = activePaymentProcessing.get(endpoint);

    // Check if we're at concurrent processing limit
    if (queueState.count >= MAX_CONCURRENT_PAYMENT_PROCESSING) {
      await logAudit({
        userId: userId || null,
        role: normalizeRole(req.user?.role),
        action: 'PAYMENT_PROCESSING_QUEUE_FULL',
        status: 'FAILED_VALIDATION',
        resourceId: orderId,
        clientIp,
        userAgent,
        requestPayload: {
          method: req.method,
          path: req.path,
          endpoint,
          orderId,
          activeProcessing: queueState.count,
          maxConcurrent: MAX_CONCURRENT_PAYMENT_PROCESSING
        },
        details: `Payment processing queue full: ${queueState.count}/${MAX_CONCURRENT_PAYMENT_PROCESSING} concurrent operations`
      });

      return res.status(503).json({
        success: false,
        message: "Server is currently processing other payment requests. Please try again in a few moments.",
        serviceUnavailable: true,
        retryAfter: 5 // Suggest retry after 5 seconds
      });
    }

    // Increment active processing counter
    queueState.count++;

    // Set request timeout
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        queueState.count--;
        logError(new Error('Payment processing timeout'), {
          action: 'PAYMENT_PROCESSING_TIMEOUT',
          userId: userId || null,
          orderId: orderId,
          clientIp,
          details: `Payment processing timeout after ${PROCESSING_TIMEOUT_MS}ms for order ${orderId}`
        });
        
        if (!res.headersSent) {
          res.status(504).json({
            success: false,
            message: "Payment processing request timed out. Please try again."
          });
        }
      }
    }, PROCESSING_TIMEOUT_MS);

    // Wrap response to decrement counter and clear timeout when request completes
    const originalJson = res.json.bind(res);
    const originalEnd = res.end.bind(res);
    const originalSend = res.send.bind(res);

    let responseSent = false;

    const cleanup = () => {
      if (!responseSent) {
        responseSent = true;
        clearTimeout(timeoutId);
        if (queueState.count > 0) {
          queueState.count--;
        }
      }
    };

    res.json = function(body) {
      cleanup();
      return originalJson(body);
    };

    res.end = function(...args) {
      cleanup();
      return originalEnd(...args);
    };

    res.send = function(...args) {
      cleanup();
      return originalSend(...args);
    };

    // Handle errors and cleanup
    res.on('close', cleanup);
    res.on('finish', cleanup);
    res.on('error', (err) => {
      cleanup();
      logError(err, {
        action: 'PAYMENT_PROCESSING_ERROR',
        userId: userId || null,
        orderId: orderId,
        clientIp,
        details: `Error during payment processing for order ${orderId}`
      });
    });

    // Process request
    next();

  } catch (error) {
    // If queue management fails, log but allow request (fail open)
    logError(error, {
      action: 'PAYMENT_PROCESSING_QUEUE_ERROR',
      userId: userId || null,
      orderId: orderId,
      clientIp,
      details: `Error in payment processing queue: ${error.message}`
    });

    next(); // Fail open
  }
};

