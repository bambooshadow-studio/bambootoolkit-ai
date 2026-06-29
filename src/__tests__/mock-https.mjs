// Mock node:https for testing
const mockResponses = [];
let recordedCalls = [];
let mockError = null;

export function __reset() {
  mockResponses.length = 0;
  recordedCalls.length = 0;
  mockError = null;
}
export function __pushResponse(status, body) {
  mockResponses.push({ status, body });
}
export function __setError(err) {
  mockError = err;
}
export function __getCalls() {
  return recordedCalls;
}

export function request(options, callback) {
  if (mockError) {
    const req = {
      on: (event, handler) => {
        if (event === 'error') req._eh = handler;
        return req;
      },
      write: () => {},
      end: () => {
        setImmediate(() => { if (typeof req._eh === 'function') req._eh(mockError); });
      },
    };
    return req;
  }

  const resp = mockResponses.shift() ?? { status: 200, body: {} };
  const bodyStr = JSON.stringify(resp.body);
  const chunks = [Buffer.from(bodyStr, 'utf-8')];

  const mockRes = {
    on: (event, handler) => {
      if (event === 'data') for (const c of chunks) handler(c);
      if (event === 'end') handler();
      return mockRes;
    },
    statusCode: resp.status,
  };

  const req = {
    on: (event, handler) => {
      if (event === 'error') req._eh = handler;
      return req;
    },
    write: (data) => {
      recordedCalls.push({ options, body: data });
    },
    end: () => {
      if (callback) callback(mockRes);
    },
  };
  return req;
}
