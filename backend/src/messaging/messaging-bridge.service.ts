import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';

/** Diğer modüllerden Mesaj Merkezi’ne hafif köprü (nöbet, tahta, optik, ders dağıtım). */
@Injectable()
export class MessagingBridgeService {
  private readonly logger = new Logger(MessagingBridgeService.name);

  constructor(private readonly notifications: NotificationsService) {}

  async notifyTeachersInbox(
    schoolId: string,
    teacherIds: string[],
    title: string,
    body: string,
    eventType: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    for (const userId of teacherIds) {
      await this.notifications.createInboxEntry({
        user_id: userId,
        event_type: eventType,
        title,
        body,
        target_screen: 'mesaj-merkezi',
        metadata: { school_id: schoolId, ...metadata },
      });
    }
    this.logger.log(`Bridge inbox: ${eventType} → ${teacherIds.length} öğretmen`);
  }
}
