import { TestBed } from '@angular/core/testing';

import { PushNotificationService } from './push-notifications.service';

describe('PushNotificationsService', () => {
  let service: PushNotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PushNotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
