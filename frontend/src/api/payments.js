import axios from 'axios'

export const fetchPayment = (token) =>
  axios.get(`/api/payments/${token}/`).then(r => r.data)

export const startPayment = (token) =>
  axios.post(`/api/payments/${token}/start/`).then(r => r.data)

// Tylko lokalnie (P24_MODE=fake): wynik symulowanej płatności
export const fakeConfirmPayment = (token, session, success) =>
  axios.post(`/api/payments/${token}/fake-confirm/`, { session, success })
