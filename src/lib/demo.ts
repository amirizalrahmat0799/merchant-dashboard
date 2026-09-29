/** True when the app is built for the hosted demo (no real gateway behind it). */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

/** API key of the seeded demo merchant (only meaningful in demo mode). */
export const DEMO_API_KEY = 'sk_test_demo_kedaikopi_cyberjaya'
