// Notification response from backend
export interface AppNotification {
  id:        number;
  userId:    number;
  title:     string;
  message:   string;
  type:      string;
  isRead:    boolean;
  createdAt: string;
}