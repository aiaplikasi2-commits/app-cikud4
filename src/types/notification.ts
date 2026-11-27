export type AdminNotificationType =
  | 'STUDENT_UPDATED'
  | 'TEACHER_PROFILE_UPDATED'
  | 'AGENDA_CREATED';

export interface AdminNotificationRecord {
  id: string;
  type: AdminNotificationType;
  actorUserId: string;
  actorName: string;
  actorUsername: string;
  title: string;
  summary: string;
  targetId: string;
  targetName: string;
  changedFields: string[];
  eventDate: string;
  createdAt: string;
  readAt: string | null;
}

export interface AdminNotificationStoreSnapshot {
  items: AdminNotificationRecord[];
  deletedIds: string[];
}

export interface AdminNotificationListResponse {
  notifications: AdminNotificationRecord[];
  unreadCount: number;
}
