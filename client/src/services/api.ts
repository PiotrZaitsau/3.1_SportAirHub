import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  User, 
  AuthResponse, 
  LoginData, 
  RegisterData, 
  PasswordResetData,
  PasswordResetConfirmData,
  ApiResponse,
  Court,
  Booking,
  BookingForm
} from '../types';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  logout: async (): Promise<ApiResponse> => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  getProfile: async (): Promise<ApiResponse & { data: { user: User } }> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  refreshToken: async (): Promise<AuthResponse> => {
    const response = await api.post('/auth/refresh');
    return response.data;
  },
};

// Courts API
export const courtsAPI = {
  getCourts: async (params?: { type?: string; available?: boolean; date?: string }): Promise<ApiResponse & { data: { courts: Court[] } }> => {
    const response = await api.get('/courts', { params });
    return response.data;
  },

  getCourt: async (id: string): Promise<ApiResponse & { data: { court: Court } }> => {
    const response = await api.get(`/courts/${id}`);
    return response.data;
  },
};

// Bookings API
export const bookingsAPI = {
  getBookings: async (params?: { 
    page?: number; 
    limit?: number; 
    status?: string; 
    startDate?: string; 
    endDate?: string; 
  }): Promise<ApiResponse & { data: { bookings: Booking[] } }> => {
    const response = await api.get('/bookings', { params });
    return response.data;
  },

  createBooking: async (data: BookingForm): Promise<ApiResponse & { data: { booking: Booking } }> => {
    const response = await api.post('/bookings', data);
    return response.data;
  },

  cancelBooking: async (id: string, reason?: string): Promise<ApiResponse> => {
    const response = await api.delete(`/bookings/${id}`, { data: { reason } });
    return response.data;
  },
};

// Users API
export const usersAPI = {
  getProfile: async (): Promise<ApiResponse & { data: { user: User } }> => {
    const response = await api.get('/users/profile');
    return response.data;
  },

  updateProfile: async (data: Partial<User>): Promise<ApiResponse & { data: { user: User } }> => {
    const response = await api.put('/users/profile', data);
    return response.data;
  },
};

export default api; 