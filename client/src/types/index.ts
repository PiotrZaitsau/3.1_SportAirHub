// User Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'user' | 'admin' | 'manager';
  isVerified: boolean;
  profile: {
    avatar?: string;
    dateOfBirth?: string;
    emergencyContact?: {
      name: string;
      phone: string;
      relationship: string;
    };
    marketingConsent: boolean;
  };
  subscription: {
    isActive: boolean;
    type?: string;
    startDate?: string;
    endDate?: string;
    autoRenew: boolean;
  };
  passes: Pass[];
  loyaltyProgram: {
    level: 'bronze' | 'silver' | 'gold';
    totalPoints: number;
    thisYearPoints: number;
  };
  notificationPreferences: {
    email: {
      bookingConfirmation: boolean;
      bookingReminder: boolean;
      bookingCancellation: boolean;
      subscriptionExpiring: boolean;
      passExpiring: boolean;
      promotional: boolean;
    };
    push: {
      bookingConfirmation: boolean;
      bookingReminder: boolean;
      bookingCancellation: boolean;
    };
    promotional: boolean;
  };
  lastActive: string;
}

// Pass Types
export interface Pass {
  _id: string;
  passType: string;
  purchaseDate: string;
  expiryDate: string;
  totalVisits: number;
  remainingVisits: number;
  isActive: boolean;
}

// Court Types
export interface Court {
  id: string;
  name: string;
  type: 'tennis' | 'padel' | 'squash' | 'badminton';
  location: string;
  description?: string;
  pricePerHour: number;
  images: string[];
  features: string[];
  isActive: boolean;
  capacity: {
    minPlayers: number;
    maxPlayers: number;
  };
  pricing: {
    guest: number;
    member: number;
    corporate: number;
  };
  dynamicPricing: {
    enabled: boolean;
    peakHours: {
      start: number;
      end: number;
    };
    peakMultiplier: number;
  };
  equipment: Array<{
    name: string;
    available: number;
    price: number;
  }>;
  iotSensors: Array<{
    deviceId: string;
    type: string;
    lastReading?: {
      temperature?: number;
      humidity?: number;
      airQuality?: number;
      timestamp: string;
    };
  }>;
}

// Booking Types
export interface Booking {
  id: string;
  userId: string;
  courtId: string;
  court?: Court;
  startTime: string;
  endTime: string;
  duration: number;
  totalPrice: number;
  originalPrice: number;
  discount: number;
  status: 'pending_payment' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  players: Array<{
    name: string;
    email?: string;
    phone?: string;
  }>;
  equipment: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  notes?: string;
  qrCode?: string;
  paymentMethod?: string;
  passUsed?: string;
  pricingTier: 'guest' | 'member' | 'corporate';
  loyaltyPointsEarned: number;
  checkIn: {
    checkedIn: boolean;
    checkInTime?: string;
  };
  reminders: {
    twentyFourHour: boolean;
    oneHour: boolean;
  };
  cancellation?: {
    cancelledAt: string;
    reason: string;
    refundAmount: number;
    refundStatus: 'pending' | 'completed' | 'not_applicable';
  };
  payment?: {
    paymentIntentId?: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    paidAt?: string;
    amount: number;
  };
}

// Subscription Types
export interface Subscription {
  id: string;
  type: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  features: string[];
  maxUsers: number;
  currentUsers: number;
  isActive: boolean;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

// Form Types
export interface LoginForm {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth?: string;
  acceptedTerms: boolean;
  marketingConsent?: boolean;
}

export interface BookingForm {
  courtId: string;
  startTime: string;
  duration: number;
  players: Array<{
    name: string;
    email?: string;
    phone?: string;
  }>;
  equipment: Array<{
    name: string;
    quantity: number;
  }>;
  notes?: string;
  usePass?: boolean;
  paymentMethod?: string;
}

// Time Slot Types
export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  price?: number;
}

export interface AvailabilityResponse {
  court: {
    id: string;
    name: string;
    type: string;
  };
  date: string;
  availableSlots: TimeSlot[];
}

// Analytics Types
export interface RealtimeStats {
  activeUsers: number;
  todayBookings: number;
  todayRevenue: number;
  courtUtilization: Record<string, {
    name: string;
    utilization: number;
    bookingsCount: number;
    revenue: number;
  }>;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'booking_confirmed' | 'booking_reminder' | 'booking_cancelled' | 'system' | 'welcome' | 'promotion';
  title: string;
  message: string;
  data?: any;
  timestamp: string;
  read: boolean;
}

// Payment Types
export interface PaymentIntent {
  clientSecret: string;
  paymentIntentId: string;
}

// Theme Types (for SportAirHub color scheme)
export interface SportAirHubTheme {
  palette: {
    primary: {
      main: string;
      light: string;
      dark: string;
    };
    secondary: {
      main: string;
      light: string;
      dark: string;
    };
    background: {
      default: string;
      paper: string;
      accent: string;
    };
    text: {
      primary: string;
      secondary: string;
    };
  };
}

// Promo Code Types
export interface PromoCode {
  id: string;
  code: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  description: string;
  validFrom: string;
  validTo: string;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
  applicableServices: string[];
  minimumAmount?: number;
}

// Equipment Types
export interface Equipment {
  id: string;
  name: string;
  type: string;
  pricePerHour: number;
  available: number;
  total: number;
  description?: string;
  image?: string;
}

// Error Types
export interface FormErrors {
  [key: string]: string;
}

export interface ApiError {
  message: string;
  status: number;
  errors?: FormErrors;
}

// Auth related types
export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  dateOfBirth?: string;
}

export interface AuthResponse extends ApiResponse {
  data: {
    user: User;
    token: string;
  };
}

export interface PasswordResetData {
  email: string;
}

export interface PasswordResetConfirmData {
  token: string;
  password: string;
} 