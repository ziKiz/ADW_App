import axios from 'axios';
import { getUser } from '../utils/auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

client.interceptors.request.use((config) => {
  const user = getUser();
  if (user) {
    config.headers['x-user-role'] = user.role;
    config.headers['x-user-id'] = String(user.id);
    config.headers['x-user-name'] = user.full_name || user.username || user.email;
  }
  return config;
});

export default client;
