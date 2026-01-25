const requestQueues = new Map();

export const createRequestQueue = ({
  endpoint,
  maxConcurrent = 5,
  timeoutMs = 60000,
  actionName = 'REQUEST_QUEUE',
  shouldApply = () => true,
  getResourceId = (req) => req.user?.id || req.ip
}) => {
  return async (req, res, next) => {
    if (!shouldApply(req)) {
      return next();
    }

    const resourceId = getResourceId(req);
    const queueKey = `${endpoint}:${resourceId}`;

    if (!requestQueues.has(queueKey)) {
      requestQueues.set(queueKey, {
        queue: [],
        active: 0,
        maxConcurrent
      });
    }

    const queueData = requestQueues.get(queueKey);

    if (queueData.active >= maxConcurrent) {
      return new Promise((resolve) => {
        queueData.queue.push({ req, res, next, resolve });
      });
    }

    queueData.active++;
    next();

    res.on('finish', () => {
      queueData.active--;
      if (queueData.queue.length > 0) {
        const { req: queuedReq, res: queuedRes, next: queuedNext, resolve } = queueData.queue.shift();
        queueData.active++;
        resolve();
        queuedNext();
      }
    });
  };
};
