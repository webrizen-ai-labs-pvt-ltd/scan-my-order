export const getSessionId = () => {
  let sessionId = localStorage.getItem('smo_session_id');
  if (!sessionId) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      sessionId = crypto.randomUUID();
    } else {
      sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    localStorage.setItem('smo_session_id', sessionId);
  }
  return sessionId;
};
